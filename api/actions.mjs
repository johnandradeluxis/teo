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
