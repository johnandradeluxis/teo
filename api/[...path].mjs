import crypto from 'node:crypto';
import {body,db,fail,handler,json,list,mutation,one,session,upsert} from './_lib.mjs';
import {nextReview,rankChunks,selectBalanced,simulationEligibility} from '../server/domain.mjs';

const rulesDefault={minimumScore:7,minimumActiveSeconds:60,requiredMastery:7,requireRealQuestions:false};
const clean=({id,userId,createdAt,updatedAt,...x})=>x;
const pick=(arr,id)=>arr.find(x=>x.id===id);

export default handler(async(req,res)=>{
  const path='/api/'+(Array.isArray(req.query?.path)?req.query.path.join('/'):String(req.query?.path||''));
  const user=await session(req); const method=req.method;
  if(method!=='GET')mutation(req,user);

  if(path==='/api/notes'&&method==='POST'){
    const d=await body(req);const text=String(d.text||'').trim();if(!text||text.length>20000)fail('Anotação inválida.');
    if(d.id){const old=await one('notes',d.id);if(!old||old.userId!==user.id)fail('Anotação não encontrada.',404);}
    const note=await upsert('notes',d.id||crypto.randomUUID(),user.id,{text,lessonId:d.lessonId||null,documentId:d.documentId||null,quote:String(d.quote||'').slice(0,5000)});return json(res,200,note);
  }
  if(path.startsWith('/api/notes/')&&method==='DELETE'){
    const id=path.split('/').pop(),old=await one('notes',id);if(!old||old.userId!==user.id)fail('Anotação não encontrada.',404);await db('DELETE FROM notes WHERE id=$1',[id]);return json(res,200,{ok:true});
  }
  if(path==='/api/favorites'&&method==='POST'){
    const d=await body(req),targetId=String(d.targetId||'').trim();if(!targetId||targetId.length>150)fail('Identificador inválido.');
    const old=(await list('favorites',user.id)).find(x=>x.targetId===targetId);if(old)await db('DELETE FROM favorites WHERE id=$1',[old.id]);else await upsert('favorites',crypto.randomUUID(),user.id,{targetId,kind:d.kind==='document'?'document':'lesson'});return json(res,200,{ok:true});
  }
  if(path==='/api/journey'){
    if(method==='GET'){const row=await one('personal_journey',user.id);return json(res,200,row?.secret||{testimony:{},calling:{},entries:[]});}
    if(method==='DELETE'){await db('DELETE FROM personal_journey WHERE id=$1',[user.id]);return json(res,200,{ok:true});}
    if(method==='POST'){const d=await body(req);if(JSON.stringify(d).length>80000)fail('Registro muito longo.');await upsert('personal_journey',user.id,user.id,d);return json(res,200,{ok:true,savedAt:new Date().toISOString()});}
  }
  if(path==='/api/study/start'&&method==='POST'){
    const d=await body(req),lesson=await one('lessons',d.lessonId);if(!lesson||lesson.status!=='published')fail('Aula indisponível.',404);
    return json(res,200,await upsert('study_sessions',crypto.randomUUID(),user.id,{lessonId:lesson.id,activeSeconds:0,lastHeartbeat:Date.now(),ended:false,interacted:false}));
  }
  if(path==='/api/study/heartbeat'&&method==='POST'){
    const d=await body(req),sess=await one('study_sessions',d.sessionId);if(!sess||sess.userId!==user.id)fail('Sessão não encontrada.',404);if(sess.ended)fail('Sessão encerrada.');
    const elapsed=Math.max(0,(Date.now()-Number(sess.lastHeartbeat||Date.now()))/1000),delta=d.active&&elapsed<=40?Math.min(30,elapsed):0;
    const updated=await upsert('study_sessions',sess.id,user.id,{...clean(sess),activeSeconds:Number(sess.activeSeconds||0)+delta,lastHeartbeat:Date.now(),interacted:!!sess.interacted||!!d.interacted});
    const pid=`${user.id}:${sess.lessonId}`,old=await one('student_progress',pid);
    await upsert('student_progress',pid,user.id,{...clean(old||{}),lessonId:sess.lessonId,position:Math.max(0,Math.min(1,Number(d.position)||0)),activeSeconds:Number(old?.activeSeconds||0)+delta,studied:true,interacted:!!old?.interacted||!!updated.interacted});
    return json(res,200,{activeSeconds:updated.activeSeconds});
  }
  if(path==='/api/study/complete'&&method==='POST'){
    const d=await body(req),sess=await one('study_sessions',d.sessionId);if(!sess||sess.userId!==user.id)fail('Sessão não encontrada.',404);const pid=`${user.id}:${sess.lessonId}`,progress=await one('student_progress',pid);if(!progress)fail('Inicie a leitura antes de concluir.');
    const qs=(await list('questions')).filter(q=>q.lessonId===sess.lessonId&&q.essential&&q.status==='published'),attempts=await list('question_attempts',user.id);if(!qs.length)fail('A aula precisa de uma atividade essencial publicada.');
    if(progress.activeSeconds<rulesDefault.minimumActiveSeconds||!progress.interacted||progress.position<.8)fail('Leia a aula, interaja e cumpra o tempo mínimo antes de concluir.');
    if(qs.some(q=>!attempts.some(a=>a.questionId===q.id&&a.score!==null)))fail('Responda às atividades essenciais.');
    await upsert('student_progress',pid,user.id,{...clean(progress),completed:true,completedAt:new Date().toISOString(),evaluated:true});await upsert('study_sessions',sess.id,user.id,{...clean(sess),ended:true});return json(res,200,{ok:true});
  }
  if(path==='/api/questions/answer'&&method==='POST'){
    const d=await body(req),q=await one('questions',d.questionId);if(!q||q.status!=='published')fail('Questão indisponível.',404);const attempt=await upsert('question_attempts',crypto.randomUUID(),user.id,{questionId:q.id,answer:d.answer,score:q.type==='discursive'?null:(String(d.answer)===String(q.correct)?10:0),feedback:null,diagnostic:false});return json(res,200,{...attempt,explanation:q.type==='discursive'?null:q.explanation,correct:q.type==='discursive'?null:q.correct});
  }
  if(path==='/api/diagnostic/start'&&method==='POST'){
    const qs=(await list('questions')).filter(q=>q.status==='published'&&q.type!=='discursive'),chosen=selectBalanced(qs,16);if(new Set(chosen.map(x=>x.axisId)).size<4)fail('O diagnóstico requer questões objetivas publicadas nos quatro eixos.',409);
    const run=await upsert('journey_milestones',crypto.randomUUID(),user.id,{kind:'diagnostic_run',questionIds:chosen.map(x=>x.id),finished:false});return json(res,200,{runId:run.id,questions:chosen.map(({correct,modelAnswer,explanation,...q})=>q)});
  }
  if(path==='/api/diagnostic/submit'&&method==='POST'){
    const d=await body(req),run=await one('journey_milestones',d.runId);if(!run||run.userId!==user.id||run.finished===true||run.kind!=='diagnostic_run')fail('Diagnóstico inválido.');
    const totals={};for(const qid of run.questionIds||[]){const q=await one('questions',qid);const score=String(d.answers?.[qid])===String(q.correct)?10:0;totals[q.axisId]??=[];totals[q.axisId].push(score);await upsert('question_attempts',crypto.randomUUID(),user.id,{questionId:qid,answer:d.answers[qid],score,diagnostic:true});}
    const areas=Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length]));await upsert('journey_milestones',run.id,user.id,{...clean(run),finished:true});const old=(await list('journey_milestones',user.id)).find(x=>x.kind==='diagnostic');await upsert('journey_milestones',old?.id||crypto.randomUUID(),user.id,{kind:'diagnostic',areas,completedAt:new Date().toISOString()});return json(res,200,{ok:true,areas});
  }
  if(path==='/api/library/search'&&method==='GET'){
    const q=String(req.query?.q||'').trim();if(!q)fail('Informe um termo para buscar.');const docs=(await list('documents')).filter(d=>d.status==='validated'&&(d.userId===user.id||(d.shared&&d.licenseConfirmed)));const ids=new Set(docs.map(d=>d.id));const chunks=(await list('document_chunks')).filter(c=>ids.has(c.documentId));return json(res,200,{method:'textual',sources:rankChunks(q,chunks).map(({embedding,...x})=>x)});
  }
  fail('Rota não encontrada.',404);
});
