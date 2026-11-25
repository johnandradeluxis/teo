import {handler,json,list,one,session,setting} from './_lib.mjs';
import {calculatePlan,simulationEligibility} from '../server/domain.mjs';

const defaultRules={publicSignup:false,minimumScore:7,minimumActiveSeconds:60,requiredMastery:7,requireRealQuestions:false};
const defaultAI={provider:'none',model:'',enabledFeatures:[],allowPersonalJourney:false};

export default handler(async(req,res)=>{
  if(req.method!=='GET')return json(res,405,{error:'M�todo n�o permitido.'},{Allow:'GET'});
  const user=await session(req);
  const [profile,preferences,axes,disciplines,modules,allLessons,allQuestions,documents,progress,mastery,attempts,sessions,notes,favorites,milestones,simulations,rules,ai,providers,reviews,versions,usage,audit]=await Promise.all([
    one('profiles',user.id),one('study_preferences',user.id),list('curriculum'),list('disciplines'),list('modules'),list('lessons'),list('questions'),list('documents'),list('student_progress',user.id),list('mastery_records',user.id),list('question_attempts',user.id),list('study_sessions',user.id),list('notes',user.id),list('favorites',user.id),list('journey_milestones',user.id),list('simulations',user.id),setting('rules',defaultRules),setting('ai',defaultAI),list('ai_providers',user.id),list('content_reviews'),list('lesson_versions'),list('ai_usage_logs',user.id),list('audit_logs')
  ]);
  const lessons=user.role==='admin'?allLessons:allLessons.filter(x=>x.status==='published');
  const publishedQuestions=allQuestions.filter(x=>x.status==='published');
  const questions=publishedQuestions.map(({correct,modelAnswer,explanation,...q})=>q);
  const visibleDocuments=documents.filter(d=>d.userId===user.id||(d.shared&&d.status==='validated'&&d.licenseConfirmed)).map(({filePath,...d})=>d);
  const diagnostic=milestones.find(x=>x.kind==='diagnostic');
  const plan=calculatePlan({preferences:preferences||{},disciplines,lessons:allLessons,mastery,diagnostic});
  const total = Math.max(15,Number(preferences?.minutes)||30);
  const short = Math.round(total/6);
  const recall = Math.max(1,Math.round(total/10));
  const sources = visibleDocuments.filter(d=>d.status==='validated' && d.licenseConfirmed);
  const titleKey = d => String(d.title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const readingBlock = (focus,pattern,minutes) => {
    const doc = sources.find(d=>pattern.test(titleKey(d)));
    const bookmark = milestones.find(m=>m.kind==='guided_reading' && doc && m.documentId===doc.id);
    return {focus,minutes,title:doc?.title||'Aguardando fonte validada',documentId:doc?.id,pageDone:bookmark?.page};
  };
  const dailyGuide = {totalMinutes:total,notice:'Tempo previsto para a sessão de hoje.',blocks:[
    readingBlock('Teologia sistemática',/teologia sistematica/,total-2*short-recall),
    {focus:'Bíblia em contexto',title:'Retome uma passagem citada na leitura de hoje e examine os versículos ao redor.',minutes:short,library:true},
    readingBlock('Eclesiologia batista',/pacto e comunhao|declaracao doutrinaria/,short),
    {focus:'Fixação e revisão',minutes:recall,title:'Responda de memória e confira as revisões agendadas.',review:true}
  ]};
  const eligibility=simulationEligibility({lessons:allLessons,progress,attempts,mastery,questions:allQuestions,rules:{...defaultRules,...rules}});
  const {secret,...safeAI}={...defaultAI,...ai};
  json(res,200,{user:{id:user.id,email:user.email,role:user.role,csrf:user.csrf},profile:profile||{name:'Estudante',onboarded:false},preferences:preferences||{minutes:30,days:[]},axes,disciplines,modules,lessons,questions,documents:visibleDocuments,progress,mastery,attempts,sessions,notes,favorites,milestones,simulations,plan,dailyGuide,eligibility,ai:{provider:safeAI.provider,model:safeAI.model,connected:providers.map(x=>x.kind)},admin:user.role==='admin'?{ai:safeAI,rules:{...defaultRules,...rules},questions:allQuestions,reviews,versions,usage,audit:audit.slice(-50)}:null});
});

