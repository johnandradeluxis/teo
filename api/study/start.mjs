import crypto from 'node:crypto';
import {body,fail,handler,json,mutation,one,session,upsert} from '../_lib.mjs';
export default handler(async(req,res)=>{const user=await session(req);mutation(req,user);if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});const d=await body(req),lesson=await one('lessons',d.lessonId);if(!lesson||lesson.status!=='published')fail('Aula indisponível.',404);json(res,200,await upsert('study_sessions',crypto.randomUUID(),user.id,{lessonId:lesson.id,activeSeconds:0,lastHeartbeat:Date.now(),ended:false,interacted:false}));});
