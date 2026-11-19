import crypto from 'node:crypto';
import pg from 'pg';

const {Pool}=pg;
const pool=globalThis.__teoPool||(globalThis.__teoPool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined,
  max:4,
  idleTimeoutMillis:20000,
  connectionTimeoutMillis:10000
}));

export const db=(text,params=[])=>pool.query(text,params);
export const now=()=>new Date().toISOString();
export const id=()=>crypto.randomUUID();
export const hash=value=>crypto.createHash('sha256').update(value).digest('hex');

export function json(res,status,value,extra={}){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  for(const [key,val] of Object.entries(extra))res.setHeader(key,val);
  res.end(JSON.stringify(value));
}

export function fail(message,status=400){throw Object.assign(new Error(message),{status});}

export async function body(req,max=100000){
  let size=0,text='';
  for await(const chunk of req){size+=chunk.length;if(size>max)fail('Requisição muito grande.',413);text+=chunk;}
  try{return text?JSON.parse(text):{};}catch{fail('JSON inválido.');}
}

function cookies(req){
  return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const p=v.indexOf('=');return [decodeURIComponent(v.slice(0,p)),decodeURIComponent(v.slice(p+1))];}));
}

export async function session(req,required=true){
  const token=cookies(req).teo_session;
  if(!token){if(required)fail('Sessão expirada. Entre novamente.',401);return null;}
  const {rows}=await db(`SELECT u.id,u.email,u.role,s.csrf,s.token_hash
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>$2`,[hash(token),Date.now()]);
  if(!rows[0]){if(required)fail('Sessão expirada. Entre novamente.',401);return null;}
  return rows[0];
}

export function mutation(req,user){
  const origin=req.headers.origin;
  const allowed=process.env.APP_ORIGIN;
  if(origin&&allowed&&origin!==allowed)fail('Origem não autorizada.',403);
  if(!user||req.headers['x-csrf-token']!==user.csrf)fail('Sessão de segurança inválida. Recarregue a página.',403);
}

export function verifyPassword(password,stored){
  try{
    const [salt,wanted]=String(stored).split(':');
    if(!salt||!wanted)return false;
    const got=crypto.scryptSync(String(password),salt,Buffer.from(wanted,'hex').length);
    return crypto.timingSafeEqual(got,Buffer.from(wanted,'hex'));
  }catch{return false;}
}

export async function createSession(userId,res){
  const token=crypto.randomBytes(32).toString('base64url');
  const csrf=crypto.randomBytes(24).toString('base64url');
  const expires=Date.now()+7*86400000;
  await db('DELETE FROM sessions WHERE expires_at<=$1',[Date.now()]);
  await db('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,$4)',[hash(token),userId,csrf,expires]);
  res.setHeader('Set-Cookie',`teo_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`);
  return csrf;
}

export function clearSession(res){res.setHeader('Set-Cookie','teo_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');}

export function record(row){
  if(!row)return null;
  return {...(row.payload||{}),id:row.id,userId:row.user_id||undefined,createdAt:row.created_at||undefined,updatedAt:row.updated_at||undefined};
}

export async function one(table,key){
  const {rows}=await db(`SELECT * FROM ${table} WHERE id=$1`,[key]);
  return record(rows[0]);
}

export async function list(table,userId=null){
  const {rows}=userId===null
    ?await db(`SELECT * FROM ${table} ORDER BY created_at,id`)
    :await db(`SELECT * FROM ${table} WHERE user_id=$1 ORDER BY created_at,id`,[userId]);
  return rows.map(record);
}

export async function setting(key,fallback){
  const {rows}=await db('SELECT payload FROM settings WHERE id=$1',[key]);
  return rows[0]?.payload||fallback;
}

export async function upsert(table,key,userId,payload){
  const stamp=now();
  await db(`INSERT INTO ${table}(id,user_id,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$4)
    ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`,[key,userId,payload,stamp]);
  return one(table,key);
}

export function handler(fn){
  return async(req,res)=>{try{await fn(req,res);}catch(error){console.error(error);json(res,error.status||500,{error:error.status?error.message:'Não foi possível concluir agora.'});}};
}
