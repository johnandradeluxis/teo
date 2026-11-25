import {body, db, fail, handler, hash, json, mutation, one, session, upsert} from './_lib.mjs';

const guidedReading = handler(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, {error:'Use POST.'});
  const user = await session(req);
  mutation(req, user);
  const input = await body(req);
  const doc = await one('documents', String(input.documentId));
  if (!doc || doc.status !== 'validated' || !doc.licenseConfirmed || !(doc.shared || doc.userId === user.id)) fail('Fonte indisponível.', 404);
  const key = hash(JSON.stringify(['guided',user.id,doc.id]));
  const saved = await one('journey_milestones', key);
  const last = Number(saved?.page || 0);
  const {rows} = await db(`SELECT (payload->>'page')::int AS page, payload->>'section' AS section, payload->>'text' AS text
    FROM document_chunks WHERE payload->>'documentId'=$1 AND (payload->>'page')::int = (
      SELECT min((payload->>'page')::int) FROM document_chunks
      WHERE payload->>'documentId'=$1 AND (payload->>'page')::int>$2 AND length(trim(payload->>'text'))>0)
    ORDER BY created_at, id`, [doc.id,last]);
  if (!rows.length) return json(res,200,{finished:true});
  const page = rows[0].page;
  if (input.complete) {
    if (Number(input.page)!==page) fail('Sua posição já mudou. Reabra a leitura.',409);
    await upsert('journey_milestones',key,user.id,{kind:'guided_reading',documentId:doc.id,page});
    return json(res,200,{saved:true,page});
  }
  return json(res,200,{page,section:rows[0].section,text:rows.map(row=>row.text).filter(Boolean).join('\n\n')});
});
import studyStart from '../server/actions/study-start.mjs';
import studyHeartbeat from '../server/actions/study-heartbeat.mjs';
import studyComplete from '../server/actions/study-complete.mjs';
import questionAnswer from '../server/actions/question-answer.mjs';
import diagnosticStart from '../server/actions/diagnostic-start.mjs';
import diagnosticSubmit from '../server/actions/diagnostic-submit.mjs';
import librarySearch from '../server/actions/library-search.mjs';
import journey from '../server/actions/journey.mjs';
import notes from '../server/actions/notes.mjs';
import favorites from '../server/actions/favorites.mjs';

const routes={
  'study/guided':guidedReading,
  'study/start':studyStart,'study/heartbeat':studyHeartbeat,'study/complete':studyComplete,
  'questions/answer':questionAnswer,'diagnostic/start':diagnosticStart,'diagnostic/submit':diagnosticSubmit,
  'library/search':librarySearch,'journey':journey,'notes':notes,'favorites':favorites
};
export default async function(req,res){
  const route=String(req.query?.route||'').replace(/^\//,'');
  const handler=routes[route];
  if(!handler){res.statusCode=404;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({error:'Rota não encontrada.'}));}
  return handler(req,res);
}
