import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

for (const directory of ['api', 'public', 'scripts', 'server', 'tests']) {
  for (const file of readdirSync(directory, { recursive: true })) {
    if (!/\.(?:mjs|js)$/.test(file)) continue;
    const check = spawnSync(process.execPath, ['--check', join(directory, file)], { stdio: 'inherit' });
    if (check.status !== 0) process.exit(1);
  }
}
for (const file of ['package.json', 'public/manifest.webmanifest', 'vercel.json']) {
  JSON.parse(readFileSync(file, 'utf8'));
}

const client = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync('public/app.js'));
assert.ok(!client.includes('\uFFFD'), 'Texto corrompido na interface');
const context = {
  document: { addEventListener() {} },
  window: { addEventListener() {} },
  fetch: () => new Promise(() => {})
};
runInNewContext(client, context);
for (const field of ['text', 'prompt', 'question']) {
  const html = context.questionForm({ id: 'test', [field]: 'Qual é a referência?', options: ['A', 'B'] }, true);
  assert.ok(html.includes('Qual é a referência?') && html.includes('type="radio"'));
}
console.log('Sintaxe, configuração e renderização do diagnóstico verificadas.');
