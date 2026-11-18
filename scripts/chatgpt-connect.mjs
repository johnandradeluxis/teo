import {createServer} from 'node:http';
import {randomBytes,createHash,createPublicKey,verify} from 'node:crypto';
import {resolve} from 'node:path';
import {openStore} from '../server/database.mjs';

// Integração oficial para uso pessoal/local. Não reutiliza sessões do navegador.
const store=openStore(resolve(process.env.TEO_DATA_DIR||'data'));
const user=store.db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1").get();
if(!user)throw new Error('Crie primeiro a conta administradora do Teo.');
const existing=store.list('ai_providers',user.id).find(x=>x.kind==='chatgpt');
const saved=existing?store.decrypt(existing.secret):null;
let host=store.setting('chatgptHost');if(!host){host=`urn:uuid:${crypto.randomUUID()}`;store.setting('chatgptHost',host);}
const pending={state:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url'),verifier:randomBytes(48).toString('base64url')};
const redirect='http://127.0.0.1:1455/auth/callback';
const server=createServer(async(req,res)=>{
  if(!req.url.startsWith('/auth/callback?')){res.writeHead(404);res.end();return;}
  try {
    const url=new URL(req.url,redirect);
    if(url.searchParams.get('state')!==pending.state)throw new Error('State inválido.');
    if(url.searchParams.get('error'))throw new Error('Autorização não concedida.');
    const returnedId=url.searchParams.get('client_id');const clientId=saved?.clientId||returnedId;if(saved&&returnedId&&returnedId!==saved.clientId)throw new Error('A autorização retornou outro cliente.');if(!clientId||clientId==='dynamic_agent_client')throw new Error('Registro incompleto: client_id emitido ausente.');
    const code=url.searchParams.get('code');if(!code)throw new Error('Código ausente.');
    const tokenResponse=await fetch('https://auth.openai.com/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,code_verifier:pending.verifier,redirect_uri:redirect,resource:'https://api.openai.com/v1'}),signal:AbortSignal.timeout(30000)});
    if(!tokenResponse.ok)throw new Error('A troca OAuth foi recusada.');const token=await tokenResponse.json();
    const discovery=await fetch('https://auth.openai.com/.well-known/openid-configuration').then(r=>r.json());
    const jwksURL=new URL(discovery.jwks_uri);if(jwksURL.protocol!=='https:'||jwksURL.hostname!=='auth.openai.com')throw new Error('JWKS inválido.');
    const jwks=await fetch(jwksURL).then(r=>r.json());
    const [headerB64,payloadB64,signatureB64]=token.id_token.split('.');
    const header=JSON.parse(Buffer.from(headerB64,'base64url')),payload=JSON.parse(Buffer.from(payloadB64,'base64url'));
    if(header.alg!=='RS256')throw new Error('Algoritmo de ID token não suportado.');
    const key=jwks.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!key)throw new Error('Chave de ID token ausente.');
    if(!verify('RSA-SHA256',Buffer.from(`${headerB64}.${payloadB64}`),createPublicKey({key,format:'jwk'}),Buffer.from(signatureB64,'base64url')))throw new Error('Assinatura de ID token inválida.');
    const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
    if(payload.iss!=='https://auth.openai.com'||!audience.includes(clientId)||typeof payload.exp!=='number'||payload.exp*1000<Date.now()||payload.nonce!==pending.nonce||!payload.sub||(audience.length>1&&payload.azp!==clientId))throw new Error('Identidade OAuth inválida.');
    if(saved&&payload.sub!==saved.subject)throw new Error('Entre com a mesma conta ChatGPT já vinculada ao Teo.');
    const scopes=String(token.scope||'').split(' ');if(!scopes.includes('chatgpt.tokens.use.direct'))throw new Error('Uso da assinatura não autorizado.');
    const credentials={clientId,subject:payload.sub,email:payload.email,idToken:token.id_token,accessToken:token.access_token,refreshToken:token.refresh_token,scopes,expiresAt:Date.now()+token.expires_in*1000};
    const current=store.list('ai_providers',user.id).find(x=>x.kind==='chatgpt');
    store.put('ai_providers',{kind:'chatgpt',secret:store.encrypt(credentials)},user.id,current?.id);
    store.setting('ai',{...store.setting('ai'),provider:'chatgpt',model:''});
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<h1>Assinatura conectada ao Teo</h1><p>Volte à administração e selecione um modelo. Você pode fechar esta janela.</p>');
    console.log('Assinatura autorizada. Selecione um modelo na administração do Teo.');
    server.close(()=>{store.close();process.exit(0);});
  } catch(error) {res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end(error.message);console.error(error.message);server.close(()=>{store.close();process.exit(1);});}
});
server.listen(1455,'127.0.0.1',()=>{
  const url=new URL('https://auth.openai.com/api/accounts/authorize');
  const params={client_id:saved?.clientId||'dynamic_agent_client',...(!saved?{agent_name_hint:'Teo'}:{}),ext_agent_host_id:host,response_type:'code',redirect_uri:redirect,scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',resource:'https://api.openai.com/v1',state:pending.state,nonce:pending.nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(pending.verifier).digest('base64url')};
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  console.log('Abra este endereço no navegador deste computador e autorize o uso da assinatura:\n'+url.href);
});
setTimeout(()=>{console.error('Autorização expirada. Execute novamente.');server.close();store.close();process.exit(1);},300000).unref();
