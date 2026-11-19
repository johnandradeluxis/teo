import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [file, table, offsetValue = '0', limitValue = '100'] = process.argv.slice(2);
if (!file || !/^[a-z_]+$/.test(table || '')) throw new Error('Uso: arquivo tabela offset limite');
const offset = Number.parseInt(offsetValue, 10);
const limit = Number.parseInt(limitValue, 10);
if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 500) {
  throw new Error('Intervalo inv�lido.');
}

const data = JSON.parse(readFileSync(resolve(file), 'utf8'));
const rows = data.tables?.[table];
if (!Array.isArray(rows)) throw new Error(`Tabela ausente na exporta��o: ${table}`);
process.stdout.write(JSON.stringify({ total: rows.length, rows: rows.slice(offset, offset + limit) }));

