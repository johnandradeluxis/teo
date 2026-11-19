import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve(process.argv[2] || process.env.TEO_SQLITE_PATH || 'data/teo.sqlite');
const destination = resolve(process.argv[3] || 'data/exports/teo-sqlite-export.json');
const db = new DatabaseSync(source, { readOnly: true });

const tables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

const data = {
  format: 'teo-sqlite-export',
  version: 1,
  exportedAt: new Date().toISOString(),
  source: source.split(/[\\/]/).pop(),
  tables: {}
};

for (const { name } of tables) {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Nome de tabela inesperado: ${name}`);
  data.tables[name] = db.prepare(`SELECT * FROM ${name}`).all();
}

db.close();
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Exporta��o criada: ${destination}`);

