export const STATUSES=['draft','ai_generated','pending_review','in_review','needs_changes','rejected','approved','published','archived'];
export const LESSON_FIELDS=['title','introduction','objectives','topics','biblicalReferences','context','doctrinalRelation','conclusion','fixation'];
export function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
export function string(value,name,max=20000,min=1) { if(typeof value!=='string'||value.trim().length<min||value.length>max) fail(`${name}: informe entre ${min} e ${max} caracteres.`); return value.trim(); }
export function number(value,name,min,max) { const n=Number(value); if(!Number.isFinite(n)||n<min||n>max) fail(`${name}: valor fora do intervalo ${min}-${max}.`); return n; }
export function validateLesson(data) {
  string(data.title,'T�tulo',180);
  for(const key of LESSON_FIELDS) if(data[key]===undefined || data[key]===null || data[key]==='' || (Array.isArray(data[key])&&!data[key].length)) fail(`Estrutura incompleta: ${key}.`);
  if(!Array.isArray(data.topics)||!data.topics.every(x=>x.title&&x.text)) fail('T�picos precisam de t�tulo e texto.');
  if(!Array.isArray(data.objectives)||!Array.isArray(data.fixation)||!Array.isArray(data.biblicalReferences)) fail('Objetivos, refer�ncias e fixa��o devem ser listas.');
  return data;
}
export function nextReview(score,stage=0,now=Date.now()) { const days=score<7?1:[1,3,7,14][Math.min(stage,3)]; return {stage:score<7?0:Math.min(stage+1,3),dueAt:new Date(now+days*86400000).toISOString(),days}; }
export function weightedGrade(criteria,bibleRequired=true) {
  const theological=number(criteria.theological,'Teologia',0,10), biblical=bibleRequired?number(criteria.biblical,'Fundamenta��o',0,10):null, clarity=number(criteria.clarity,'Clareza',0,10);
  const total=bibleRequired?theological*.4+biblical*.35+clarity*.25:(theological*.4+clarity*.25)/.65;
  return {theological,biblical,clarity,total:Math.round(total*100)/100,bibleRequired};
}
export function calculatePlan({preferences,disciplines,lessons,mastery,diagnostic,now=Date.now()}) {
  const minutes=Number(preferences.minutes)||30,days=preferences.days?.length||5;
  const published=lessons.filter(x=>x.status==='published'&&x.required!==false);
  const map=new Map(mastery.map(x=>[x.disciplineId,x]));
  const loads=disciplines.map(d=>{ const score=map.get(d.id)?.score??diagnostic?.areas?.[d.axisId]??0; const ls=published.filter(l=>l.disciplineId===d.id); const base=ls.reduce((sum,l)=>sum+(Number(l.estimatedMinutes)||30),0); return {disciplineId:d.id,title:d.title,axisId:d.axisId,score,minutes:Math.round(base*(1.3-score*.06)),hasContent:!!ls.length}; });
  const total=loads.reduce((sum,x)=>sum+x.minutes,0),sessions=Math.ceil(total/minutes),weeks=Math.ceil(sessions/days);
  const axisWeights={sistematica:0,batista:0,biblia:0,ministerial:0};
  loads.forEach(x=>axisWeights[x.axisId]+=x.minutes);
  const distribution=Object.entries(axisWeights).map(([axisId,load])=>({axisId,minutes:total?Math.round(minutes*load/total):0}));
  return {totalMinutes:total,hours:Math.round(total/6)/10,sessions,weeks,completionDate:total?new Date(now+weeks*7*86400000).toISOString():null,distribution,gaps:loads.filter(x=>x.score<7).sort((a,b)=>a.score-b.score).slice(0,8),coverage:published.length,unavailableDisciplines:loads.filter(x=>!x.hasContent).length,provisional:true,notice:published.length?'Estimativa do conte�do obrigat�rio publicado; revis�es e novas aulas alteram o prazo.':'Aguardando publica��o de aulas para estimar a prepara��o.'};
}
export function buildDailyStudyGuide({preferences,disciplines,lessons,plan,now=Date.now()}) {
  const total=Math.max(15,Number(preferences.minutes)||30);
  const published=lessons.filter(x=>x.status==='published'&&x.required!==false);
  const weights={sistematica:.65,biblia:.2,batista:.15,ministerial:0};
  const blocks=Object.entries(weights).map(([axisId,weight])=>{
    const minutes=Math.max(weight?1:0,Math.round(total*weight));
    const item=published.find(x=>x.axisId===axisId&&!x.completed);
    return {axisId,minutes,title:item?.title||'Conte�do ainda n�o publicado',lessonId:item?.id||null,estimatedPages:item?.estimatedPages||null,focus:axisId==='biblia'?'Refer�ncias e contexto b�blico':axisId==='batista'?'Declara��o doutrin�ria e Pacto e Comunh�o':axisId==='sistematica'?'Leitura principal da Teologia Sistem�tica':'Revis�o ministerial'};
  }).filter(x=>x.minutes>0);
  return {date:new Date(now).toISOString().slice(0,10),totalMinutes:total,blocks,notice:'Distribui��o inicial adaptativa; ser� recalculada conforme diagn�stico, dom�nio e ritmo de leitura.'};
}
export function simulationEligibility({lessons,progress,attempts,mastery,questions,rules}) {
  const required=lessons.filter(x=>x.status==='published'&&x.required!==false);
  const missing=required.filter(l=>!progress.some(p=>p.lessonId===l.id&&p.completed));
  const requiredQuestions=questions.filter(q=>q.status==='published'&&q.essential);
  const missingQuestions=requiredQuestions.filter(q=>!attempts.some(a=>a.questionId===q.id&&a.score>=rules.minimumScore));
  const axisIds=['sistematica','batista','biblia','ministerial'];
  const coveredAxes=new Set(questions.filter(q=>q.status==='published'&&(!rules.requireRealQuestions||q.origin==='real')).map(q=>q.axisId));
  const low=required.filter(l=>!mastery.some(m=>m.disciplineId===l.disciplineId&&m.score>=rules.requiredMastery));
  const reasons=[];
  if(!required.length) reasons.push('Publique o curr�culo obrigat�rio.');
  if(missing.length) reasons.push(`${missing.length} aula(s) obrigat�ria(s) pendente(s).`);
  if(missingQuestions.length) reasons.push(`${missingQuestions.length} avalia��o(�es) essencial(is) pendente(s).`);
  if(low.length) reasons.push('Demonstre dom�nio nas disciplinas obrigat�rias.');
  if(axisIds.some(x=>!coveredAxes.has(x))) reasons.push('O banco de quest�es precisa cobrir os quatro eixos com a origem exigida.');
  return {eligible:!reasons.length,reasons};
}
export function selectBalanced(questions,count,history=[]) {
  const used=new Map(); history.forEach(id=>used.set(id,(used.get(id)||0)+1));
  const ordered=[...questions].sort((a,b)=>(used.get(a.id)||0)-(used.get(b.id)||0)||(a.difficulty||1)-(b.difficulty||1));
  const queues=new Map(); ordered.forEach(q=>queues.set(q.axisId,[...(queues.get(q.axisId)||[]),q]));
  const result=[]; while(result.length<count&&[...queues.values()].some(q=>q.length)) for(const queue of queues.values()) if(queue.length&&result.length<count) result.push(queue.shift());
  return result;
}
export function chunkPages(pages,size=1400,overlap=180) { return pages.flatMap(page=>{const out=[];const text=page.text.trim();for(let offset=0;offset<text.length;offset+=size-overlap) out.push({page:page.page,section:page.section||null,text:text.slice(offset,offset+size),offset});return out;}); }
export function rankChunks(query,chunks,limit=6) {
  const terms=String(query).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu,'').match(/[\p{L}\p{N}]{3,}/gu)||[];
  return chunks.map(c=>{const text=c.text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu,'');return {...c,relevance:terms.reduce((s,t)=>s+(text.includes(t)?1:0),0)};}).filter(c=>c.relevance>0).sort((a,b)=>b.relevance-a.relevance).slice(0,limit);
}

