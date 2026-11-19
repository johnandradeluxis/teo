import {body,createSession,db,fail,handler,json,verifyPassword} from '../_lib.mjs';

export default handler(async(req,res)=>{
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'},{Allow:'POST'});
  const data=await body(req);
  const email=String(data.email||'').trim().toLowerCase();
  const {rows}=await db('SELECT id,email,role,password_hash FROM users WHERE email=$1',[email]);
  const user=rows[0];
  const fallback='00000000000000000000000000000000:'+ '00'.repeat(64);
  if(!verifyPassword(String(data.password||''),user?.password_hash||fallback)||!user)fail('E-mail ou senha inválidos.',401);
  const csrf=await createSession(user.id,res);
  json(res,200,{ok:true,id:user.id,email:user.email,role:user.role,csrf});
});
