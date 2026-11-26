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
  if (input.mode === 'recall') {
    const page = Number(input.page);
    const answer = String(input.answer || '').trim();
    if (!Number.isSafeInteger(page) || page < 1 || page > last || !answer || answer.length > 4000 ||
        !['revisit','remembered'].includes(input.result)) fail('Confira a página, a resposta e sua autoavaliação.');
    const recallKey = hash(JSON.stringify(['guided_recall',user.id,doc.id,page]));
    const prior = await one('journey_milestones',recallKey);
    if (prior && Date.parse(prior.dueAt)>Date.now()) return json(res,200,{dueAt:prior.dueAt});
    const days = input.result === 'revisit' ? 1 : prior?.interval >= 7 ? 14 : prior?.interval >= 3 ? 7 : 3;
    const dueAt = new Date(Date.now()+days*86400000).toISOString();
    await upsert('journey_milestones',recallKey,user.id,{kind:'guided_recall',documentId:doc.id,page,answer,result:input.result,interval:days,dueAt});
    return json(res,200,{dueAt});
  }
  if (input.mode === 'reread') {
    const page = Number(input.page);
    if (!Number.isSafeInteger(page) || page < 1 || page > last) fail('Página indisponível.');
    const {rows} = await db("SELECT payload FROM document_chunks WHERE payload->>'documentId'=$1 AND payload->>'page'=$2 ORDER BY created_at,id",[doc.id,String(page)]);
    if (!rows.length) fail('Extração indisponível.',404);
    return json(res,200,{page,text:rows.map(r=>r.payload.text).join('\n\n'),section:rows[0].payload.section});
  }
  const {rows} = await db(`SELECT (payload->>'page')::int AS page, payload->>'section' AS section, payload->>'text' AS text
    FROM document_chunks WHERE payload->>'documentId'=$1 AND (payload->>'page')::int = (
      SELECT min((payload->>'page')::int) FROM document_chunks
      WHERE payload->>'documentId'=$1 AND (payload->>'page')::int>$2 AND length(trim(payload->>'text'))>0)
    ORDER BY created_at, id`, [doc.id,last]);
  if (!rows.length) return json(res,200,{finished:true});
  const page = rows[0].page;
  if (input.complete) {
    if (Number(input.page)!==page) fail('Sua posição já mudou. Reabra a leitura.',409);
    // Preserve both sides of the bookmark transition, including legacy bookmarks.
    const pages = [...new Set([last,page])].filter(n=>n>0);
    const stamp = new Date().toISOString();
    const entries = pages.map(n=>({id:hash(JSON.stringify(['guided_page',user.id,doc.id,n])),payload:{kind:'guided_page',documentId:doc.id,page:n}}));
    const bookmark = {kind:'guided_reading',documentId:doc.id,page};
    await db(`WITH saved AS (
      INSERT INTO journey_milestones(id,user_id,payload,created_at,updated_at)
      VALUES ($1,$2,$3::jsonb,$4,$4)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at
      WHERE (journey_milestones.payload->>'page')::int < (excluded.payload->>'page')::int
      RETURNING id
    )
    INSERT INTO journey_milestones(id,user_id,payload,created_at,updated_at)
    SELECT entry->>'id',$2,entry->'payload',$4,$4 FROM saved CROSS JOIN jsonb_array_elements($5::jsonb) AS entry
    ON CONFLICT(id) DO NOTHING`,[key,user.id,JSON.stringify(bookmark),stamp,JSON.stringify(entries)]);
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
