import {handler,json,list,session} from '../_lib.mjs';
import {rankChunks} from '../../server/domain.mjs';
export default handler(async(req,res)=>{
  if(req.method!=='GET')return json(res,405,{error:'Método não permitido.'});
  const user=await session(req),q=String(req.query?.q||'').trim();if(!q)return json(res,400,{error:'Informe um termo para buscar.'});
  const docs=(await list('documents')).filter(d=>d.status==='validated'&&(d.userId===user.id||(d.shared&&d.licenseConfirmed))),ids=new Set(docs.map(d=>d.id));
  const chunks=(await list('document_chunks')).filter(c=>ids.has(c.documentId));json(res,200,{method:'textual',sources:rankChunks(q,chunks).map(({embedding,...x})=>x)});
});
