import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {fail,string} from './domain.mjs';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password) { string(password,'Senha',200,12); const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function verifyPassword(password,stored) {try{const [salt,digest]=stored.split(':');return timingSafeEqual(Buffer.from(digest,'hex'),scryptSync(password,salt,64));}catch{return false;} }
export function getSession(store,req) {const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('teo_session='))?.slice(12);if(!token)return null;const session=store.db.prepare('SELECT s.*,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now());return session?{id:session.user_id,email:session.email,role:session.role,csrf:session.csrf,tokenHash:session.token_hash}:null;}
export function createSession(store,userId,res,secure=false) {const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),userId,csrf,Date.now()+7*86400000);res.setHeader('Set-Cookie',`teo_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure?'; Secure':''}`);return csrf;}
export function authorize(user,admin=false) {if(!user)fail('Entre na sua conta para continuar.',401);if(admin&&user.role!=='admin')fail('Acesso exclusivo da administração.',403);}
export function owner(record,user) {if(!record||record.userId!==user.id)fail('Registro não encontrado.',404);return record;}
