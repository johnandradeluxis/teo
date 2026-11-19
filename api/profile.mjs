import {body,db,fail,handler,json,mutation,session,upsert} from './_lib.mjs';

export default handler(async(req,res)=>{
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'},{Allow:'POST'});
  const user=await session(req);mutation(req,user);const d=await body(req);
  const name=String(d.name||'').trim();if(!name||name.length>120)fail('Informe um nome válido.');
  if(!['iniciante','básico','intermediário','avançado'].includes(d.level))fail('Nível inválido.');
  const minutes=Number(d.minutes);if(![15,30,45,60,90].includes(minutes))fail('Tempo diário inválido.');
  const days=Array.isArray(d.days)?d.days.map(Number):[];
  if(!days.length||new Set(days).size!==days.length||days.some(x=>!Number.isInteger(x)||x<0||x>6))fail('Selecione dias válidos.');
  if(d.councilDate&&!/^\d{4}-\d{2}-\d{2}$/.test(d.councilDate))fail('Data inválida.');
  const formation=String(d.formation||'').trim(),objective=String(d.objective||'').trim();
  if(!formation||formation.length>120||!objective||objective.length>120)fail('Formação e objetivo são obrigatórios.');
  await upsert('profiles',user.id,user.id,{name,level:d.level,formation,objective,tradition:'Batista',onboarded:true});
  await upsert('study_preferences',user.id,user.id,{minutes,days,councilDate:d.councilDate||null});
  json(res,200,{ok:true});
});
