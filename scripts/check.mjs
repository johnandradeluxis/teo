import {readdirSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dirs=['server','scripts','public','tests'];let failed=false;
for(const dir of dirs)for(const f of readdirSync(resolve(dir),{recursive:true}).filter(x=>/\.(mjs|js)$/.test(x))){const result=spawnSync(process.execPath,['--check',join(dir,f)],{encoding:'utf8'});if(result.status){console.error(result.stderr);failed=true;}}
JSON.parse(readFileSync('package.json'));JSON.parse(readFileSync('public/manifest.webmanifest'));
if(failed)process.exit(1);console.log('Sintaxe JavaScript e manifests verificados.');
