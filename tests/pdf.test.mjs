import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
test('extração preserva o número físico das páginas do PDF',t=>{
  const python=process.env.PYTHON_BIN||'python';
  const available=spawnSync(python,['-c','import fitz'],{windowsHide:true});
  if(available.status!==0){t.skip('PyMuPDF não instalado neste ambiente.');return;}
  const dir=mkdtempSync(join(tmpdir(),'teo-pdf-')),file=join(dir,'teste.pdf');
  try{
    const source="import fitz,sys; d=fitz.open(); p=d.new_page(); p.insert_text((72,72),'Pagina um: teste de extracao.'); p=d.new_page(); p.insert_text((72,72),'Pagina dois: texto distinto.'); d.save(sys.argv[1])";
    const created=spawnSync(python,['-c',source,file],{windowsHide:true,encoding:'utf8'});assert.equal(created.status,0,created.stderr);
    const extracted=spawnSync(python,[resolve('scripts/extract_pdf.py'),file],{windowsHide:true,encoding:'utf8'});assert.equal(extracted.status,0,extracted.stderr);const data=JSON.parse(extracted.stdout);assert.equal(data.pages.length,2);assert.equal(data.pages[1].page,2);assert(data.pages[1].text.includes('Pagina dois'));assert(!data.pages[0].text.includes('Pagina dois'));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
