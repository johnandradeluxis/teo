import {createServer} from 'node:http';
import {readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync} from 'node:fs';
import {resolve,dirname,extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {openStore} from './database.mjs';
import {hash,passwordHash,verifyPassword,getSession,createSession,authorize,owner} from './auth.mjs';
import {fail,string,number,validateLesson,calculatePlan,nextReview,weightedGrade,simulationEligibility,selectBalanced,chunkPages,rankChunks,STATUSES} from './domain.mjs';
import {generate,validateCitations,availableModels,embed,validateEndpoint} from './ai.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runFile=promisify(execFile);
const isDirect=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
export function createApp({directory=resolve(process.env.TEO_DATA_DIR||join(root,'data')),host=process.env.HOST||'127.0.0.1'}={}) {
  const s=openStore(directory);mkdirSync(join(directory,'documents'),{recursive:true});
  let bootstrap=process.env.TEO_BOOTSTRAP_TOKEN;
  const bootPath=join(directory,'bootstrap-code.txt');
  if(!s.db.prepare('SELECT id FROM users LIMIT 1').get()) {if(!bootstrap){if(!existsSync(bootPath))writeFileSync(bootPath,randomBytes(24).toString('base64url'),{mode:0o600});bootstrap=readFileSync(bootPath,'utf8').trim();}}
  const rates=new Map();
  const safeQuestion=q=>{const {correct,modelAnswer,explanation,...rest}=q;return rest;};
  const accessibleDocs=user=>s.list('documents').filter(d=>d.userId===user.id||(d.shared&&d.status==='validated'&&d.licenseConfirmed));
  const publishedLessons=user=>s.list('lessons').filter(l=>user.role==='admin'||l.status==='published');
  const sourcesFor=user=>s.list('document_chunks').filter(c=>accessibleDocs(user).some(d=>d.id===c.documentId&&d.status==='validated'));
  const documentLocked=id=>{const ids=s.list('document_chunks').filter(c=>c.documentId===id).map(c=>c.id);return s.list('lessons').some(l=>l.status==='published'&&l.sourceIds?.some(x=>ids.includes(x)));};
  const audit=(user,action,id)=>s.put('audit_logs',{action,targetId:id},user.id);
  const plan=user=>calculatePlan({preferences:s.get('study_preferences',user.id)||{},disciplines:s.list('disciplines'),lessons:s.list('lessons'),mastery:s.list('mastery_records',user.id),diagnostic:s.list('journey_milestones',user.id).find(x=>x.kind==='diagnostic')});
  const eligibility=user=>simulationEligibility({lessons:s.list('lessons'),progress:s.list('student_progress',user.id),attempts:s.list('question_attempts',user.id),mastery:s.list('mastery_records',user.id),questions:s.list('questions'),rules:s.setting('rules')});
  const answerAttempt=(user,q,answer,extra={})=>{
    let score=null;
    if(q.type==='objective'||q.type==='true_false')score=String(answer)===String(q.correct)?10:0;
    if(q.type==='matching')score=JSON.stringify(answer)===JSON.stringify(q.correct)?10:0;
    const old=s.list('mastery_records',user.id).find(m=>m.disciplineId===q.disciplineId);
    const review=score===null?null:nextReview(score,old?.stage||0);
    const attempt=s.put('question_attempts',{questionId:q.id,disciplineId:q.disciplineId,axisId:q.axisId,answer,score,review,...extra},user.id);
    if(score!==null)updateMastery(user,q,score,review);
    return attempt;
  };
  const updateMastery=(user,q,score,review)=>{
    const history=s.list('question_attempts',user.id).filter(a=>a.disciplineId===q.disciplineId&&a.score!==null).slice(-8);
    const average=history.length?history.reduce((sum,x)=>sum+x.score,0)/history.length:score;
    s.put('mastery_records',{disciplineId:q.disciplineId,score:Math.round(average*100)/100,...review},user.id,`${user.id}:${q.disciplineId}`);
  };
  const retrieve=async(user,query)=>{
    const chunks=sourcesFor(user);let selected;let method='textual';
    if(s.setting('ai').embeddingModel&&chunks.some(c=>c.embedding)){
      const vectors=await embed(s,user.id,[query]);const v=vectors?.[0];
      if(v){const cosine=(a,b)=>a.length===b.length?a.reduce((sum,x,i)=>sum+x*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)||1):-1;selected=chunks.filter(c=>c.embedding).map(c=>({...c,relevance:cosine(v,c.embedding)})).filter(c=>c.relevance>.15).sort((a,b)=>b.relevance-a.relevance).slice(0,6);method='semantic';}
    }
    selected??=rankChunks(query,chunks);
    return {method,sources:selected.map(c=>{const d=s.get('documents',c.documentId);return {id:c.id,documentId:d.id,document:d.title,page:c.page,section:c.section,text:c.text,relevance:c.relevance};})};
  };
  async function body(req,max=120000) {let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>max)fail('Arquivo ou solicitação acima do limite.',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail('JSON inválido.');}}
  function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
  async function api(req,res,url) {
    const path=url.pathname,user=getSession(s,req),method=req.method;
    if(method!=='GET'){
      const origin=req.headers.origin,expected=process.env.APP_ORIGIN||`http://${req.headers.host}`;
      if(origin&&origin!==expected)fail('Origem não autorizada.',403);
      if(user&&req.headers['x-csrf-token']!==user.csrf)fail('Sessão de formulário expirada. Atualize a página.',403);
    }
    const key=`${req.socket.remoteAddress}:${path}`;
    const now=Date.now(),rate=rates.get(key)||{count:0,at:now};if(now-rate.at>60000){rate.count=0;rate.at=now;}rate.count++;rates.set(key,rate);
    if(rate.count>(path.startsWith('/api/auth')?20:200))fail('Muitas solicitações. Aguarde um minuto.',429);
    if(rates.size>2000)for(const [k,v]of rates)if(now-v.at>60000)rates.delete(k);
    if(path==='/api/health')return json(res,{ok:true,version:'0.1.0',database:'sqlite',aiConfigured:s.setting('ai').provider!=='none'});
    if(path==='/api/auth/session')return json(res,{user:user?{id:user.id,email:user.email,role:user.role,csrf:user.csrf}:null,setup:!s.db.prepare('SELECT id FROM users LIMIT 1').get(),publicSignup:s.setting('rules').publicSignup});
    if(path==='/api/auth/register'&&method==='POST'){
      const data=await body(req);const email=string(data.email,'E-mail',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('E-mail inválido.');
      const first=!s.db.prepare('SELECT id FROM users LIMIT 1').get();
      if(first&&data.bootstrap!==bootstrap)fail('Código de instalação inválido. Consulte data/bootstrap-code.txt no servidor.',403);
      if(!first&&!s.setting('rules').publicSignup)fail('Cadastro público desativado.',403);
      const password=passwordHash(data.password);const id=randomUUID();
      try{s.transaction(()=>{const stillFirst=!s.db.prepare('SELECT id FROM users LIMIT 1').get();if(first!==stillFirst)fail('A instalação já foi concluída.');s.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,email,password,first?'admin':'student',new Date().toISOString());s.put('profiles',{name:string(data.name,'Nome',120),onboarded:false},id,id);});}catch(e){if(e.message.includes('UNIQUE'))fail('Não foi possível criar a conta com esses dados.');throw e;}
      if(first&&existsSync(bootPath))unlinkSync(bootPath);
      const csrf=createSession(s,id,res,process.env.COOKIE_SECURE==='true');return json(res,{ok:true,csrf},201);
    }
    if(path==='/api/auth/login'&&method==='POST'){
      const data=await body(req);const row=s.db.prepare('SELECT * FROM users WHERE email=?').get(String(data.email).toLowerCase());
      // Custo de derivação também em e-mails desconhecidos, reduzindo enumeração temporal.
      const digest=row?.password_hash||'00000000000000000000000000000000:'+ '00'.repeat(64);
      const valid=verifyPassword(String(data.password),digest);if(!row||!valid)fail('E-mail ou senha inválidos.',401);
      const csrf=createSession(s,row.id,res,process.env.COOKIE_SECURE==='true');return json(res,{ok:true,csrf});
    }
    if(path==='/api/auth/recover'&&method==='POST'){
      const data=await body(req);const row=s.db.prepare('SELECT id FROM users WHERE email=?').get(String(data.email).toLowerCase());
      if(row){const token=randomBytes(32).toString('base64url');s.db.prepare('DELETE FROM reset_tokens WHERE user_id=?').run(row.id);s.db.prepare('INSERT INTO reset_tokens VALUES(?,?,?)').run(hash(token),row.id,Date.now()+1800000);mkdirSync(join(directory,'private-outbox'),{recursive:true});writeFileSync(join(directory,'private-outbox',`${row.id}.txt`),`${process.env.APP_ORIGIN||'http://localhost:3000'}/?reset=${token}`,{mode:0o600});}
      return json(res,{message:'Se a conta existir, o operador encontrará um link válido por 30 minutos na caixa privada do servidor. A entrega por e-mail ainda requer integração.'});
    }
    if(path==='/api/auth/reset'&&method==='POST'){
      const data=await body(req),row=s.db.prepare('SELECT * FROM reset_tokens WHERE token_hash=? AND expires_at>?').get(hash(String(data.token)),Date.now());if(!row)fail('Link inválido ou expirado.');const digest=passwordHash(data.password);
      s.transaction(()=>{s.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(digest,row.user_id);s.db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);s.db.prepare('DELETE FROM reset_tokens WHERE user_id=?').run(row.user_id);});return json(res,{ok:true});
    }
    authorize(user);
    if(path==='/api/auth/logout'&&method==='POST'){s.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.tokenHash);res.setHeader('Set-Cookie','teo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,{ok:true});}
    if(path==='/api/state'){
      const lessons=publishedLessons(user),questions=s.list('questions').filter(q=>q.status==='published');
      const ai=s.setting('ai');const {secret,...safeAI}=ai;
      return json(res,{user:{id:user.id,email:user.email,role:user.role,csrf:user.csrf},profile:s.get('profiles',user.id),preferences:s.get('study_preferences',user.id),axes:s.list('curriculum'),disciplines:s.list('disciplines'),modules:s.list('modules'),lessons,questions:questions.map(safeQuestion),documents:accessibleDocs(user).map(d=>({...d,filePath:undefined})),progress:s.list('student_progress',user.id),mastery:s.list('mastery_records',user.id),attempts:s.list('question_attempts',user.id),sessions:s.list('study_sessions',user.id),notes:s.list('notes',user.id),favorites:s.list('favorites',user.id),milestones:s.list('journey_milestones',user.id),simulations:s.list('simulations',user.id),plan:plan(user),eligibility:eligibility(user),ai:{provider:ai.provider,model:ai.model,connected:s.list('ai_providers',user.id).map(x=>x.kind)},admin:user.role==='admin'?{ai:safeAI,rules:s.setting('rules'),questions:s.list('questions'),reviews:s.list('content_reviews'),versions:s.list('lesson_versions'),usage:s.list('ai_usage_logs',user.id),audit:s.list('audit_logs').slice(-50)}:null});
    }
    if(path==='/api/profile'&&method==='POST'){
      const d=await body(req);const name=string(d.name,'Nome',120);const levels=['iniciante','básico','intermediário','avançado'];if(!levels.includes(d.level))fail('Nível inválido.');
      if(![15,30,45,60,90].includes(Number(d.minutes)))fail('Tempo diário inválido.');
      if(!Array.isArray(d.days)||!d.days.length||new Set(d.days).size!==d.days.length||d.days.some(x=>!Number.isInteger(x)||x<0||x>6))fail('Selecione dias válidos.');
      if(d.councilDate&&!/^\d{4}-\d{2}-\d{2}$/.test(d.councilDate))fail('Data inválida.');
      s.transaction(()=>{s.put('profiles',{name,level:d.level,formation:string(d.formation,'Formação',120),objective:string(d.objective,'Objetivo',120),tradition:'Batista',onboarded:true},user.id,user.id);s.put('study_preferences',{minutes:Number(d.minutes),days:d.days,councilDate:d.councilDate||null},user.id,user.id);});
      s.put('study_plans',plan(user),user.id,user.id);return json(res,{ok:true});
    }
    if(path==='/api/notes'&&method==='POST'){
      const d=await body(req);if(d.id)owner(s.get('notes',d.id),user);const note=s.put('notes',{text:string(d.text,'Anotação'),lessonId:d.lessonId||null,documentId:d.documentId||null,quote:String(d.quote||'').slice(0,5000)},user.id,d.id);return json(res,note);
    }
    if(path.startsWith('/api/notes/')&&method==='DELETE'){const id=path.split('/').pop();owner(s.get('notes',id),user);s.remove('notes',id);return json(res,{ok:true});}
    if(path==='/api/favorites'&&method==='POST'){const d=await body(req);const targetId=string(d.targetId,'Identificador',150);const old=s.list('favorites',user.id).find(x=>x.targetId===targetId);if(old)s.remove('favorites',old.id);else s.put('favorites',{targetId,kind:d.kind==='document'?'document':'lesson'},user.id);return json(res,{ok:true});}
    if(path==='/api/journey'){
      const row=s.get('personal_journey',user.id);
      if(method==='GET')return json(res,row?s.decrypt(row.secret):{testimony:{},calling:{},entries:[]});
      if(method==='DELETE'){s.remove('personal_journey',user.id);return json(res,{ok:true});}
      if(method==='POST'){const d=await body(req);if(JSON.stringify(d).length>80000)fail('Registro muito longo.');s.put('personal_journey',{secret:s.encrypt(d)},user.id,user.id);return json(res,{ok:true,savedAt:new Date().toISOString()});}
    }
    if(path==='/api/study/start'&&method==='POST'){
      const d=await body(req),lesson=s.get('lessons',d.lessonId);if(!lesson||lesson.status!=='published')fail('Aula indisponível.',404);
      const session=s.put('study_sessions',{lessonId:lesson.id,activeSeconds:0,lastHeartbeat:Date.now(),ended:false,interacted:false},user.id);return json(res,session);
    }
    if(path==='/api/study/heartbeat'&&method==='POST'){
      const d=await body(req),session=owner(s.get('study_sessions',d.sessionId),user);if(session.ended)fail('Sessão encerrada.');const elapsed=Math.max(0,(Date.now()-session.lastHeartbeat)/1000);const delta=d.active&&elapsed<=40?Math.min(30,elapsed):0;
      const updated=s.put('study_sessions',{...session,activeSeconds:session.activeSeconds+delta,lastHeartbeat:Date.now(),interacted:session.interacted||!!d.interacted},user.id);
      const id=`${user.id}:${session.lessonId}`,old=s.get('student_progress',id)||{};
      s.put('student_progress',{...old,lessonId:session.lessonId,position:Math.max(0,Math.min(1,Number(d.position)||0)),activeSeconds:(old.activeSeconds||0)+delta,studied:true,interacted:old.interacted||updated.interacted},user.id,id);return json(res,{activeSeconds:updated.activeSeconds});
    }
    if(path==='/api/study/complete'&&method==='POST'){
      const d=await body(req),session=owner(s.get('study_sessions',d.sessionId),user),lesson=s.get('lessons',session.lessonId),id=`${user.id}:${lesson.id}`,progress=s.get('student_progress',id)||{};
      const questions=s.list('questions').filter(q=>q.lessonId===lesson.id&&q.essential&&q.status==='published');
      const answers=s.list('question_attempts',user.id);if(!questions.length)fail('A aula precisa de pelo menos uma atividade essencial publicada.');
      if(progress.activeSeconds<s.setting('rules').minimumActiveSeconds||!progress.interacted||progress.position<.8)fail('Leia a aula, interaja e cumpra o tempo mínimo antes de concluir.');
      if(questions.some(q=>!answers.some(a=>a.questionId===q.id&&a.score!==null)))fail('Responda às atividades essenciais.');
      s.put('student_progress',{...progress,completed:true,completedAt:new Date().toISOString(),evaluated:true},user.id,id);s.put('study_sessions',{...session,ended:true},user.id);return json(res,{ok:true});
    }
    if(path==='/api/diagnostic/start'&&method==='POST'){
      const q=s.list('questions').filter(q=>q.status==='published'&&q.type!=='discursive');const chosen=selectBalanced(q,16);if(new Set(chosen.map(x=>x.axisId)).size<4)fail('O diagnóstico requer questões objetivas publicadas nos quatro eixos. Cadastre e aprove o banco primeiro.',409);
      const milestone=s.put('journey_milestones',{kind:'diagnostic_run',questionIds:chosen.map(x=>x.id),finished:false},user.id);return json(res,{runId:milestone.id,questions:chosen.map(safeQuestion)});
    }
    if(path==='/api/diagnostic/submit'&&method==='POST'){
      const d=await body(req),run=owner(s.get('journey_milestones',d.runId),user);if(run.finished||run.kind!=='diagnostic_run')fail('Diagnóstico inválido.');
      if(!d.answers||run.questionIds.some(id=>d.answers[id]===undefined))fail('Responda todas as questões.');
      const totals={};s.transaction(()=>{for(const id of run.questionIds){const q=s.get('questions',id),attempt=answerAttempt(user,q,d.answers[id],{diagnostic:true});(totals[q.axisId]??=[]).push(attempt.score);}s.put('journey_milestones',{...run,finished:true},user.id);const areas=Object.fromEntries(Object.entries(totals).map(([key,scores])=>[key,scores.reduce((a,b)=>a+b,0)/scores.length]));const old=s.list('journey_milestones',user.id).find(x=>x.kind==='diagnostic');s.put('journey_milestones',{kind:'diagnostic',areas,completedAt:new Date().toISOString()},user.id,old?.id);});return json(res,{ok:true,plan:plan(user)});
    }
    if(path==='/api/questions/answer'&&method==='POST'){
      const d=await body(req),q=s.get('questions',d.questionId);if(!q||q.status!=='published')fail('Questão indisponível.',404);if(q.type==='discursive')string(d.answer,'Resposta',15000,5);
      const attempt=answerAttempt(user,q,d.answer);return json(res,{...attempt,explanation:q.type==='discursive'?null:q.explanation,correct:q.type==='discursive'?null:q.correct});
    }
    if(path==='/api/attempts/evaluate'&&method==='POST'){
      const d=await body(req),attempt=owner(s.get('question_attempts',d.attemptId),user),q=s.get('questions',attempt.questionId);if(q.type!=='discursive')fail('Tipo de avaliação inválido.');if(attempt.score!==null)fail('Tentativa já avaliada.');
      const sources=(await retrieve(user,q.text)).sources;if(!sources.length)fail('Não há fontes validadas para avaliar esta resposta. A tentativa permanece salva e sem nota.',409);
      const {value}=await generate(s,user,'evaluate',JSON.stringify({task:'Avalie a resposta com teologia 40%, fundamentação 35%, clareza 25%. Se bibleRequired=false, redistribua proporcionalmente entre teologia e clareza. Não premie quantidade de versículos. Dê notas 0 a 10.',question:q.text,bibleRequired:q.bibleRequired!==false,answer:attempt.answer,sources,output:{theological:'number',biblical:'number ou null',clarity:'number',strengths:['string'],errors:['string'],omissions:['string'],references:['string'],modelAnswer:'string',recommendation:'string',citations:['id de fragmento']}}));
      const citations=validateCitations(value.citations,sources);if(!citations.length)fail('Avaliação sem respaldo nas fontes recuperadas.',502);
      const grade=weightedGrade(value,q.bibleRequired!==false),review=nextReview(grade.total);const result=s.put('question_attempts',{...attempt,score:grade.total,grade,feedback:{...value,citations},review,aiEvaluation:true},user.id);updateMastery(user,q,grade.total,review);return json(res,result);
    }
    if(path==='/api/library/search')return json(res,await retrieve(user,string(url.searchParams.get('q'),'Busca',1000)));
    if(path.startsWith('/api/documents/')&&method==='GET'){
      const [, , ,id,action]=path.split('/');const d=accessibleDocs(user).find(x=>x.id===id);if(!d)fail('Documento não encontrado.',404);
      if(action==='file'){res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="documento.pdf"','Cache-Control':'no-store'});return res.end(readFileSync(join(directory,'documents',d.fileName)));}
      return json(res,{...d,filePath:undefined,chunks:s.list('document_chunks').filter(c=>c.documentId===d.id).map(c=>({...c,embedding:undefined}))});
    }
    if(path==='/api/assistant'&&method==='POST'){
      const d=await body(req),question=string(d.question,'Pergunta',5000);const lesson=d.lessonId?s.get('lessons',d.lessonId):null;if(lesson&&lesson.status!=='published')fail('Aula indisponível.');
      const context=await retrieve(user,question+' '+(lesson?.title||''));
      if(!context.sources.length)return json(res,{answer:'Não encontrei respaldo nas fontes autorizadas disponíveis. Carregue e valide documentos ou reformule a busca. Nenhuma citação foi produzida.',sources:[],grounded:false});
      const history=s.list('ai_conversations',user.id).filter(x=>x.lessonId===(lesson?.id||null)).slice(-4).map(x=>({question:x.question,answer:x.answer}));
      let personal=null;if(d.usePersonalJourney&&s.setting('ai').allowPersonalJourney){const row=s.get('personal_journey',user.id);if(row)personal=s.decrypt(row.secret);}
      const {value,cached}=await generate(s,user,'tutor',JSON.stringify({task:'Responda fundamentando exclusivamente as atribuições aos documentos nos fragmentos. Não escreva nomes de página por conta própria. Use IDs em citations. Se insuficiente, diga isso. Explicações próprias devem ser rotuladas como interpretação didática.',question,lesson:lesson?{title:lesson.title,disciplineId:lesson.disciplineId}:null,history,personal,sources:context.sources,output:{answer:'string',citations:['id de fragmento']}}),{cache:!personal});
      const citations=validateCitations(value.citations,context.sources);if(!citations.length)fail('A resposta não apresentou fontes verificáveis.',502);
      string(value.answer,'Resposta da IA',30000);
      s.put('ai_conversations',{lessonId:lesson?.id||null,question,answer:value.answer,sourceIds:citations.map(x=>x.id)},user.id);return json(res,{answer:value.answer,sources:citations,grounded:true,cached});
    }
    if(path==='/api/simulations/start'&&method==='POST'){
      const e=eligibility(user);if(!e.eligible)fail(e.reasons.join(' '),409);const d=await body(req),count=number(d.count||8,'Quantidade',4,40),difficulty=number(d.difficulty||3,'Dificuldade',1,5),duration=number(d.duration||30,'Duração',5,180);
      const bank=s.list('questions').filter(q=>q.status==='published'&&q.type==='discursive'&&(q.difficulty||1)<=difficulty&&(!s.setting('rules').requireRealQuestions||q.origin==='real')&&(!d.areas?.length||d.areas.includes(q.axisId)));
      if(bank.length<count)fail('O banco não tem questões discursivas suficientes para essa configuração.');
      const history=s.list('simulation_answers',user.id).map(x=>x.questionId),chosen=selectBalanced(bank,count,history);
      const simulation=s.put('simulations',{questionIds:chosen.map(q=>q.id),index:0,status:'active',duration,difficulty,deadline:Date.now()+duration*60000},user.id);
      return json(res,{...simulation,question:safeQuestion(chosen[0])});
    }
    if(path.startsWith('/api/simulations/')&&method==='GET'){
      const id=path.split('/').pop(),sim=owner(s.get('simulations',id),user),question=sim.status==='active'?safeQuestion(s.get('questions',sim.questionIds[sim.index])):null;
      return json(res,{...sim,question,answers:s.list('simulation_answers',user.id).filter(x=>x.simulationId===sim.id)});
    }
    if(path==='/api/simulations/answer'&&method==='POST'){
      const d=await body(req),sim=owner(s.get('simulations',d.simulationId),user);if(sim.status!=='active')fail('Simulação encerrada.');
      const q=s.get('questions',sim.questionIds[sim.index]);const answer=string(d.answer,'Resposta',15000,5);if(Date.now()>sim.deadline)fail('O tempo terminou. Finalize a simulação para consultar o relatório.',409);
      const attempt=answerAttempt(user,q,answer,{simulationId:sim.id});
      s.put('simulation_answers',{simulationId:sim.id,questionId:q.id,attemptId:attempt.id,answer,axisId:q.axisId},user.id);
      const index=sim.index+1;s.put('simulations',{...sim,index,status:index>=sim.questionIds.length?'completed':'active'},user.id);
      return json(res,{attemptId:attempt.id,next:index<sim.questionIds.length?safeQuestion(s.get('questions',sim.questionIds[index])):null});
    }
    if(path==='/api/simulations/finish'&&method==='POST'){const d=await body(req),sim=owner(s.get('simulations',d.id),user);s.put('simulations',{...sim,status:'completed'},user.id);return json(res,{ok:true});}
    if(path==='/api/export'){
      const output={exportedAt:new Date().toISOString(),profile:s.get('profiles',user.id),preferences:s.get('study_preferences',user.id),journey:s.get('personal_journey',user.id)?s.decrypt(s.get('personal_journey',user.id).secret):null};
      for(const table of ['notes','favorites','question_attempts','study_sessions','student_progress','mastery_records','study_plans','journey_milestones','simulations','simulation_answers','ai_conversations'])output[table]=s.list(table,user.id);
      return json(res,output);
    }
    if(path==='/api/account'&&method==='DELETE'){
      const d=await body(req);const record=s.db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);if(!verifyPassword(String(d.password),record.password_hash))fail('Senha incorreta.',403);
      const owned=s.list('documents',user.id);s.transaction(()=>{for(const doc of owned){for(const c of s.list('document_chunks').filter(x=>x.documentId===doc.id))s.remove('document_chunks',c.id);}s.db.prepare('DELETE FROM users WHERE id=?').run(user.id);});for(const doc of owned)try{unlinkSync(join(directory,'documents',doc.fileName));}catch{}res.setHeader('Set-Cookie','teo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,{ok:true});
    }
    if(path.startsWith('/api/admin/')) {
      authorize(user,true);
      if(path==='/api/admin/settings'&&method==='POST'){
        const d=await body(req);if(d.ai){const a=d.ai;if(!['none','chatgpt','ollama','openai','compatible'].includes(a.provider))fail('Provedor inválido.');if(a.endpoint)validateEndpoint(a.endpoint);if(a.embeddingEndpoint)validateEndpoint(a.embeddingEndpoint);
          const ai={provider:a.provider,model:String(a.model||'').slice(0,150),endpoint:String(a.endpoint||''),dailyCalls:number(a.dailyCalls,'Limite diário',1,10000),monthlyCalls:number(a.monthlyCalls,'Limite mensal',1,100000),maxTokens:number(a.maxTokens,'Tokens',100,32000),temperature:number(a.temperature??.3,'Temperatura',0,2),inputPrice:number(a.inputPrice||0,'Preço de entrada',0,10000),outputPrice:number(a.outputPrice||0,'Preço de saída',0,10000),enabledFeatures:Array.isArray(a.enabledFeatures)?a.enabledFeatures.filter(x=>['tutor','generate','evaluate'].includes(x)):[],allowPersonalJourney:!!a.allowPersonalJourney,embeddingModel:String(a.embeddingModel||''),embeddingEndpoint:String(a.embeddingEndpoint||'')};s.setting('ai',ai);
          if(a.key){const old=s.list('ai_providers',user.id).find(x=>x.kind===a.provider);s.put('ai_providers',{kind:a.provider,secret:s.encrypt({key:string(a.key,'Chave',1000)})},user.id,old?.id);}}
        if(d.rules)s.setting('rules',{publicSignup:!!d.rules.publicSignup,minimumScore:number(d.rules.minimumScore,'Nota mínima',0,10),minimumActiveSeconds:number(d.rules.minimumActiveSeconds,'Leitura mínima',10,3600),requiredMastery:number(d.rules.requiredMastery,'Domínio mínimo',0,10),requireRealQuestions:!!d.rules.requireRealQuestions});audit(user,'settings_updated','settings');return json(res,{ok:true});
      }
      if(path==='/api/admin/ai/models')return json(res,{models:await availableModels(s,user.id)});
      if(path==='/api/admin/ai/test'&&method==='POST'){const response=await generate(s,user,'tutor','Retorne exatamente este JSON: {"ok":true}');return json(res,{ok:response.value.ok===true});}
      if(path==='/api/admin/curriculum'&&method==='POST'){
        const d=await body(req);if(!['curriculum','disciplines','modules'].includes(d.table))fail('Tipo inválido.');string(d.title,'Título',180);if(d.table==='disciplines'&&!s.get('curriculum',d.axisId))fail('Eixo inválido.');if(d.table==='modules'&&!s.get('disciplines',d.disciplineId))fail('Disciplina inválida.');const value=s.put(d.table,{title:d.title,axisId:d.axisId||null,disciplineId:d.disciplineId||null,required:d.required!==false,order:Number(d.order)||0},null,d.id);audit(user,'curriculum_saved',value.id);return json(res,value);
      }
      if(path==='/api/admin/lessons'&&method==='POST'){
        const d=await body(req);string(d.title,'Título',180);if(!s.get('disciplines',d.disciplineId))fail('Disciplina inválida.');if(d.moduleId&&s.get('modules',d.moduleId)?.disciplineId!==d.disciplineId)fail('Módulo inválido.');
        const old=d.id?s.get('lessons',d.id):null;if(d.id&&!old)fail('Aula não encontrada.',404);
        if(old)s.put('lesson_versions',{lessonId:old.id,version:old.version,snapshot:old,actor:user.id},null);
        const lesson=s.put('lessons',{...d,status:'draft',version:(old?.version||0)+1,origin:old?.origin||(d.origin==='ai'?'ai':'admin'),author:old?.author||user.id,approvedAt:null,reviewerId:null,required:d.required!==false,estimatedMinutes:number(d.estimatedMinutes||30,'Duração',5,240)},null,d.id);audit(user,'lesson_saved',lesson.id);return json(res,lesson);
      }
      if(path==='/api/admin/lessons/transition'&&method==='POST'){
        const d=await body(req);if(!Array.isArray(d.ids)||!d.ids.length||d.ids.length>50)fail('Selecione entre 1 e 50 materiais.');if(!STATUSES.includes(d.status))fail('Status inválido.');
        const transitions={draft:['pending_review','archived'],ai_generated:['pending_review','archived'],pending_review:['in_review','needs_changes','rejected'],in_review:['approved','needs_changes','rejected'],needs_changes:['pending_review','archived'],rejected:['draft','archived'],approved:['published','archived','draft'],published:['archived','draft'],archived:['draft']};
        const rows=d.ids.map(id=>s.get('lessons',id));
        for(const row of rows){if(!row||!transitions[row.status]?.includes(d.status))fail('Transição de revisão inválida.');if(['approved','published'].includes(d.status)){validateLesson(row);if(!row.moduleId)fail('Selecione um módulo antes de aprovar.');const sourceIds=row.sourceIds||[];if(!sourceIds.length)fail('Informe fontes autorizadas antes de aprovar.');if(sourceIds.some(id=>!sourcesFor(user).some(x=>x.id===id)))fail('Uma fonte ainda não foi validada ou não está acessível.');if(d.status==='published'&&!s.list('questions').some(q=>q.lessonId===row.id&&q.essential&&q.status==='published'))fail('Publique ao menos uma atividade essencial para essa aula.');}}
        if(d.status==='published')for(const row of rows)for(const sourceId of row.sourceIds){const chunk=s.get('document_chunks',sourceId),doc=s.get('documents',chunk.documentId);if(!doc.shared)fail('O currículo oficial é compartilhado. Autorize o compartilhamento das fontes ou mantenha o material em rascunho.');}
        s.transaction(()=>{for(const row of rows){s.put('lesson_versions',{lessonId:row.id,version:row.version,snapshot:row,actor:user.id},null);s.put('lessons',{...row,status:d.status,reviewerId:d.status==='approved'?user.id:row.reviewerId,approvedAt:d.status==='approved'?new Date().toISOString():row.approvedAt},null);s.put('content_reviews',{lessonId:row.id,from:row.status,to:d.status,comment:String(d.comment||'').slice(0,5000),reviewerId:user.id},null);audit(user,'content_'+d.status,row.id);}});return json(res,{ok:true});
      }
      if(path==='/api/admin/generate'&&method==='POST'){
        const d=await body(req),subject=string(d.subject,'Assunto',500),discipline=s.get('disciplines',d.disciplineId);if(!discipline)fail('Disciplina inválida.');const sources=(await retrieve(user,subject+' '+discipline.title)).sources;if(!sources.length)fail('Carregue e valide fontes relevantes antes de gerar conteúdo.');
        const {value}=await generate(s,user,'generate',JSON.stringify({task:'Gere uma aula didática complementar em português para revisão humana. Não atribua frases aos autores sem citação literal presente. Não publique. Use somente os fragmentos para atribuições. Escreva todos os campos do esquema.',subject,discipline:discipline.title,sources,output:{title:'string',introduction:'string',objectives:['string'],topics:[{title:'string',text:'string'}],biblicalReferences:['referência'],context:'string',doctrinalRelation:'string',conclusion:'string',fixation:['pergunta'],activity:'string',citations:['id de fragmento']}}));
        validateLesson(value);const citations=validateCitations(value.citations,sources);if(!citations.length)fail('Conteúdo gerado sem fontes válidas.',502);
        const lesson=s.put('lessons',{...value,disciplineId:discipline.id,moduleId:d.moduleId||null,sourceIds:citations.map(x=>x.id),status:'ai_generated',origin:'ai',category:'complementary',version:1,author:'IA — revisão obrigatória',required:true,estimatedMinutes:30},null);audit(user,'content_generated',lesson.id);return json(res,lesson);
      }
      if(path==='/api/admin/questions'&&method==='POST'){
        const d=await body(req);const rows=Array.isArray(d.questions)?d.questions:[d];if(rows.length>200)fail('Importe até 200 questões por vez.');
        const validated=rows.map(q=>{const discipline=s.get('disciplines',q.disciplineId);if(!discipline)fail('Disciplina inválida.');string(q.text,'Pergunta',10000);if(!['objective','true_false','matching','discursive'].includes(q.type))fail('Tipo de questão inválido.');if(!['real','complementary'].includes(q.origin))fail('Informe origem real ou complementar.');if(q.origin==='real')string(q.source,'Origem da pergunta real',1000);if(q.type!=='discursive'&&q.correct===undefined)fail('Gabarito ausente.');if(q.type==='objective'&&(!Array.isArray(q.options)||q.options.length<2||!q.options.includes(String(q.correct))))fail('Alternativas ou gabarito inválidos.');if(q.lessonId&&!s.get('lessons',q.lessonId))fail('Aula inválida.');return {...q,axisId:discipline.axisId,difficulty:number(q.difficulty||1,'Dificuldade',1,5),status:'draft',bibleRequired:q.bibleRequired!==false,essential:!!q.essential};});
        const result=s.transaction(()=>validated.map(q=>s.put('questions',q,null,q.id)));audit(user,'questions_saved',result.map(x=>x.id).join(','));return json(res,{questions:result});
      }
      if(path==='/api/admin/questions/publish'&&method==='POST'){
        const d=await body(req),q=s.get('questions',d.id);if(!q)fail('Questão não encontrada.',404);if(q.status!=='approved'&&d.status==='published')fail('Aprove a questão antes de publicar.');if(!['approved','published','archived'].includes(d.status))fail('Status inválido.');s.put('questions',{...q,status:d.status,reviewerId:user.id},null);audit(user,'question_'+d.status,q.id);return json(res,{ok:true});
      }
      if(path==='/api/admin/documents'&&method==='POST'){
        const d=await body(req,30*1024*1024);string(d.title,'Título',250);if(!d.licenseConfirmed)fail('Confirme as permissões de uso do documento.');const bytes=Buffer.from(String(d.base64||''),'base64');if(bytes.length>20*1024*1024||bytes.length<8||!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))fail('Envie um PDF válido de até 20 MB.');
        const id=randomUUID(),fileName=id+'.pdf';writeFileSync(join(directory,'documents',fileName),bytes,{mode:0o600});
        const doc=s.put('documents',{title:d.title,author:String(d.author||''),description:String(d.description||''),edition:String(d.edition||''),category:String(d.category||'Teologia'),licenseConfirmed:true,license:String(d.license||'Uso privado autorizado'),shared:!!d.shared,fileName,status:'received',indexStatus:'pending',size:bytes.length},user.id,id);audit(user,'document_uploaded',id);return json(res,doc,201);
      }
      if(path==='/api/admin/documents/process'&&method==='POST'){
        const d=await body(req),doc=owner(s.get('documents',d.id),user);if(documentLocked(doc.id))fail('Arquive as aulas publicadas que dependem deste documento antes de reprocessar.');if(doc.status==='processing')fail('Processamento em andamento.',409);s.put('documents',{...doc,status:'processing'},user.id);
        try{
          const {stdout}=await runFile(process.env.PYTHON_BIN||'python',[join(root,'scripts','extract_pdf.py'),join(directory,'documents',doc.fileName)],{timeout:240000,maxBuffer:40*1024*1024,windowsHide:true});
          const extracted=JSON.parse(stdout);if(!extracted.pages?.some(p=>p.text.trim()))fail('Nenhum texto extraído. Configure OCR ou importe uma extração revisada.');
          const chunks=chunkPages(extracted.pages);s.transaction(()=>{for(const c of s.list('document_chunks').filter(c=>c.documentId===doc.id))s.remove('document_chunks',c.id);for(const chunk of chunks)s.put('document_chunks',{...chunk,documentId:doc.id},user.id);s.put('documents',{...doc,status:'extracted',indexStatus:'text_ready',pages:extracted.pages.length,extractionWarnings:extracted.warnings||[]},user.id);});return json(res,{ok:true,chunks:chunks.length});
        }catch(error){s.put('documents',{...doc,status:'needs_tools',indexStatus:'pending',error:'Extração indisponível ou incompleta. Instale PyMuPDF e configure OCR; ou importe páginas extraídas para revisão.'},user.id);fail('Não foi possível extrair o PDF neste ambiente. O documento permanece indisponível para RAG até extração e validação.',409);}
      }
      if(path==='/api/admin/documents/pages'&&method==='POST'){
        const d=await body(req,8*1024*1024),doc=owner(s.get('documents',d.id),user);if(!Array.isArray(d.pages)||!d.pages.length||d.pages.some(p=>!Number.isInteger(p.page)||p.page<1||typeof p.text!=='string'))fail('Use uma lista de páginas com page inteiro e text.');
        if(documentLocked(doc.id))fail('Arquive as aulas publicadas que dependem deste documento antes de substituir a extração.');
        if(new Set(d.pages.map(p=>p.page)).size!==d.pages.length)fail('Há números de página duplicados.');
        const chunks=chunkPages(d.pages);s.transaction(()=>{for(const c of s.list('document_chunks').filter(c=>c.documentId===doc.id))s.remove('document_chunks',c.id);for(const chunk of chunks)s.put('document_chunks',{...chunk,documentId:doc.id},user.id);s.put('documents',{...doc,status:'extracted',pages:d.pages.length,indexStatus:'text_ready',extractionOrigin:'Importação manual — conferir com PDF'},user.id);});return json(res,{ok:true});
      }
      if(path==='/api/admin/documents/validate'&&method==='POST'){
        const d=await body(req),doc=owner(s.get('documents',d.id),user);if(doc.status!=='extracted')fail('Conclua a extração primeiro.');if(!d.confirmed)fail('Confirme a conferência das páginas e da extração.');if(!s.list('document_chunks').some(c=>c.documentId===doc.id))fail('Documento sem fragmentos.');s.put('documents',{...doc,status:'validated',validatedBy:user.id,validatedAt:new Date().toISOString()},user.id);audit(user,'document_validated',doc.id);return json(res,{ok:true});
      }
      if(path==='/api/admin/documents/index'&&method==='POST'){
        const d=await body(req),doc=owner(s.get('documents',d.id),user);if(doc.status!=='validated')fail('Valide a extração antes da indexação semântica.');const chunks=s.list('document_chunks').filter(c=>c.documentId===doc.id);
        const vectors=await embed(s,user.id,chunks.map(c=>c.text));if(!vectors)fail('Configure um modelo local de embeddings. Busca textual já está disponível.',409);
        s.transaction(()=>{chunks.forEach((c,i)=>s.put('document_chunks',{...c,embedding:vectors[i]},user.id));s.put('documents',{...doc,indexStatus:'semantic_ready',embeddingModel:s.setting('ai').embeddingModel},user.id);});return json(res,{ok:true});
      }
      if(path==='/api/admin/documents/metadata'&&method==='POST'){
        const d=await body(req),doc=owner(s.get('documents',d.id),user);if(doc.shared&&!d.shared&&documentLocked(doc.id))fail('Arquive as aulas vinculadas antes de restringir uma fonte compartilhada.');
        const updated=s.put('documents',{...doc,title:string(d.title,'Título',250),author:String(d.author||''),description:String(d.description||''),edition:String(d.edition||''),category:String(d.category||'Teologia'),shared:!!d.shared},user.id);audit(user,'document_metadata_updated',doc.id);return json(res,updated);
      }
      if(path==='/api/admin/documents/delete'&&method==='POST'){
        const d=await body(req),doc=owner(s.get('documents',d.id),user);const ids=s.list('document_chunks').filter(c=>c.documentId===doc.id).map(c=>c.id);if(s.list('lessons').some(l=>l.status==='published'&&l.sourceIds?.some(id=>ids.includes(id))))fail('Arquive as aulas publicadas que dependem desse documento antes de removê-lo.');s.transaction(()=>{ids.forEach(id=>s.remove('document_chunks',id));s.remove('documents',doc.id);});try{unlinkSync(join(directory,'documents',doc.fileName));}catch{}audit(user,'document_deleted',doc.id);return json(res,{ok:true});
      }
    }
    fail('Operação não encontrada.',404);
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      if(!['GET','HEAD'].includes(req.method))fail('Método inválido.',405);
      const paths={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icon.svg':'icon.svg','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/offline.html':'offline.html'};
      const name=paths[url.pathname];if(!name)fail('Página não encontrada.',404);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
      res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream','Cache-Control':name==='sw.js'?'no-cache':'no-cache'});res.end(readFileSync(join(root,'public',name)));
    }catch(error){if(!res.headersSent)json(res,{error:error.status?error.message:'Não foi possível concluir a operação. Tente novamente.',code:error.status||500},error.status||500);else res.end();if(!error.status)console.error(JSON.stringify({time:new Date().toISOString(),error:error.name,code:error.code||'internal',path:req.url?.split('?')[0]}));}
  });
  server.on('close',()=>s.close());
  return {server,store:s,host};
}
if(isDirect){const app=createApp();app.server.listen(Number(process.env.PORT||3000),app.host,()=>console.log(`Teo disponível em http://${app.host}:${process.env.PORT||3000}\nPrimeira instalação: consulte data/bootstrap-code.txt para criar a conta administradora.`));}
