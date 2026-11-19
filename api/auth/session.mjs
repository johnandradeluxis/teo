import {db,handler,json,session,setting} from '../_lib.mjs';

export default handler(async(req,res)=>{
  if(req.method!=='GET')return json(res,405,{error:'Método não permitido.'},{Allow:'GET'});
  const user=await session(req,false);
  const [{rows},rules]=await Promise.all([db('SELECT id FROM users LIMIT 1'),setting('rules',{publicSignup:false})]);
  json(res,200,{user:user?{id:user.id,email:user.email,role:user.role,csrf:user.csrf}:null,setup:rows.length===0,publicSignup:!!rules.publicSignup});
});
