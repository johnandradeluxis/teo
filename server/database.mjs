import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv, randomUUID } from 'node:crypto';

export function openStore(directory) {
  mkdirSync(directory, { recursive: true });
  const keyPath = resolve(directory, 'encryption.key');
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
  const key = readFileSync(keyPath);
  const db = new DatabaseSync(resolve(directory, 'teo.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);`);
  const tables = ['profiles','study_preferences','curriculum','disciplines','modules','lessons','lesson_versions','content_reviews','documents','document_chunks','questions','question_attempts','study_sessions','student_progress','mastery_records','study_plans','journey_milestones','simulations','simulation_answers','personal_journey','notes','favorites','ai_providers','ai_usage_logs','notifications','audit_logs','ai_cache','ai_conversations'];
  if(!db.prepare('SELECT version FROM migrations WHERE version=1').get()){
    db.exec('BEGIN IMMEDIATE');
    try{db.exec(readFileSync(new URL('./migrations/001-initial.sql',import.meta.url),'utf8'));db.prepare('INSERT INTO migrations VALUES(1,?)').run(new Date().toISOString());db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  }
  const ensure = table => { if (!tables.includes(table)) throw new Error('Tabela inválida'); };
  const decode = row => row && ({ ...JSON.parse(row.payload), id: row.id, userId: row.user_id, createdAt: row.created_at, updatedAt: row.updated_at });
  const store = {
    db, directory,
    list(table, owner) { ensure(table); return (owner === undefined ? db.prepare(`SELECT * FROM ${table} ORDER BY created_at`).all() : db.prepare(`SELECT * FROM ${table} WHERE user_id=? ORDER BY created_at`).all(owner)).map(decode); },
    get(table, id) { ensure(table); return decode(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)); },
    put(table, value, owner = null, id = value.id || randomUUID()) {
      ensure(table); const now = new Date().toISOString(); const { id: _, userId: __, createdAt: ___, updatedAt: ____, ...payload } = value;
      db.prepare(`INSERT INTO ${table}(id,user_id,payload,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).run(id, owner, JSON.stringify(payload), now, now);
      return store.get(table,id);
    },
    remove(table,id) { ensure(table); db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id); },
    setting(id, value) { if (value !== undefined) db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(id,JSON.stringify(value)); return JSON.parse(db.prepare('SELECT payload FROM settings WHERE id=?').get(id)?.payload || 'null'); },
    encrypt(value) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm',key,iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]); return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64'); },
    decrypt(value) { const bytes=Buffer.from(value,'base64'); const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12)); decipher.setAuthTag(bytes.subarray(12,28)); return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString()); },
    transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } },
    close() { db.close(); }
  };
  try { chmodSync(directory,0o700); } catch {}
  seedCurriculum(store);
  return store;
}

function seedCurriculum(s) {
  if(s.list('curriculum').length) return;
  const axes=[['sistematica','Teologia Sistemática','Estrutura inicial; aguarda conferência com a edição de Langston autorizada.'],['batista','Eclesiologia Batista','Fontes doutrinárias precisam ser carregadas e validadas.'],['biblia','Conhecimento Bíblico','Contexto, interpretação e fundamentação.'],['ministerial','Preparação Ministerial','Camada transversal da jornada.']];
  const names=[['Bibliologia','Teontologia','Trindade','Angelologia','Antropologia','Hamartiologia','Cristologia','Pneumatologia','Soteriologia','Eclesiologia','Escatologia'],['Identidade e princípios batistas','História dos batistas','Natureza e missão da Igreja','Governo congregacional','Autonomia local','Membresia','Disciplina eclesiástica','Batismo','Ceia do Senhor','Ordenanças e sacramentos','Pastores e diáconos','Qualificações ministeriais','Sustento da obra','Cooperação entre igrejas','Igreja e Estado','Organização eclesiástica','Estatuto e regimento','Culto e práticas'],['Contexto histórico e cultural','Contexto literário','Interpretação bíblica','Passagens fundamentais','Antigo e Novo Testamento','Defesa das doutrinas','Interpretação e aplicação'],['Conversão e testemunho','Chamado e vocação','Qualificações pastorais','Ética cristã','Liderança','Pregação','Evangelismo','Missões','Aconselhamento','Disciplina espiritual','Cuidado pastoral','Administração eclesiástica','Família e ministério']];
  axes.forEach(([id,title,description],i)=>{s.put('curriculum',{title,description,transversal:i===3,order:i},null,id); names[i].forEach((title,j)=>s.put('disciplines',{title,axisId:id,order:j,required:true},null,`${id}-${j+1}`));});
  s.setting('rules',{publicSignup:false,minimumScore:7,minimumActiveSeconds:60,requiredMastery:7,requireRealQuestions:true});
  s.setting('ai',{provider:'none',model:'',endpoint:'',dailyCalls:30,monthlyCalls:500,maxTokens:2400,temperature:0.3,inputPrice:0,outputPrice:0,allowPersonalJourney:false,enabledFeatures:['tutor','generate','evaluate'],embeddingModel:'',embeddingEndpoint:''});
}
