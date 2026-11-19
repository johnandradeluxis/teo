import {clearSession,db,handler,json,mutation,session} from '../_lib.mjs';

export default handler(async(req,res)=>{
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'},{Allow:'POST'});
  const user=await session(req);mutation(req,user);
  await db('DELETE FROM sessions WHERE token_hash=$1',[user.token_hash]);
  clearSession(res);json(res,200,{ok:true});
});
