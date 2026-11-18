import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const mobile=resolve('mobile'),url=process.env.TEO_REMOTE_URL;
if(!url)throw new Error('Defina TEO_REMOTE_URL com a URL HTTPS do servidor Teo. Nenhum APK foi gerado.');
const remote=new URL(url);if(remote.protocol!=='https:'||remote.username||remote.password||remote.pathname!=='/'||remote.search||remote.hash)throw new Error('Use apenas a origem HTTPS, sem credenciais, caminho, consulta ou fragmento.');
const config=JSON.parse(readFileSync(join(mobile,'capacitor.config.json')));
config.server={url:remote.origin,cleartext:false};
writeFileSync(join(mobile,'capacitor.config.json'),JSON.stringify(config,null,2)+'\n');
const cli=join(mobile,'node_modules','@capacitor','cli','bin','capacitor');
if(!existsSync(cli)){console.log('URL configurada. Dependências ausentes: execute npm install dentro de mobile, com acesso ao registro npm, e repita este comando. Nenhum APK foi gerado.');process.exitCode=2;}else{
  for(const args of existsSync(join(mobile,'android'))?[['sync','android']]:[['add','android'],['sync','android']]){const result=spawnSync(process.execPath,[cli,...args],{cwd:mobile,stdio:'inherit',windowsHide:true});if(result.status)process.exit(result.status||1);}
  const resources=join(mobile,'android','app','src','main','res');
  for(const size of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){const dir=join(resources,`mipmap-${size}`);mkdirSync(dir,{recursive:true});if(existsSync(`mobile/resources/icon-${size}.png`))for(const name of ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png'])copyFileSync(`mobile/resources/icon-${size}.png`,join(dir,name));}
  const manifest=join(mobile,'android','app','src','main','AndroidManifest.xml');let xml=readFileSync(manifest,'utf8');xml=xml.replace(/\sandroid:usesCleartextTraffic="[^"]*"/g,'').replace(/\sandroid:screenOrientation="[^"]*"/g,'');xml=xml.replace('<application','<application android:usesCleartextTraffic="false"');xml=xml.replace('android:launchMode="singleTask"','android:launchMode="singleTask" android:screenOrientation="portrait"');writeFileSync(manifest,xml);
  console.log('Projeto Android sincronizado. Abra mobile/android no Android Studio ou execute .\\gradlew.bat assembleDebug nesse diretório.');
}
