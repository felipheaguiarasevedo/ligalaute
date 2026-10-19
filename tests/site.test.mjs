import test from 'node:test';
import assert from 'node:assert/strict';
import {photos} from '../js/media-data.js';
import {filterPhotos,filterCourses,nextPhotoIndex,safeGalleryURL} from '../js/site-logic.js';
import {header,footer,initNavigation} from '../js/site-shell.js';
import {existsSync,readFileSync} from 'node:fs';

test('todas as 10 fotografias enviadas estão no acervo, com textos alternativos e arquivos locais',()=>{
  assert.equal(photos.length,10);assert.equal(new Set(photos.map(p=>p.id)).size,10);
  for(const photo of photos){assert.ok(existsSync(photo.src),photo.src);assert.ok(photo.alt.length>20);assert.ok(photo.caption.length>10);}
});
test('filtros preservam todos os registros e as categorias corretas',()=>{
  assert.equal(filterPhotos(photos).length,10);
  assert.equal(filterPhotos(photos,'pratica').length,5);
  assert.equal(filterPhotos(photos,'equipe').length,4);
  assert.equal(filterPhotos(photos,'bastidores').length,1);
  assert.equal(filterPhotos(photos,'acervo').length,0);
});
test('navegação da foto volta ao começo ou ao final sem sair do acervo',()=>{
  assert.equal(nextPhotoIndex(0,-1,10),9);assert.equal(nextPhotoIndex(9,1,10),0);
  assert.equal(nextPhotoIndex(0,1,1),0);assert.equal(nextPhotoIndex(0,1,0),-1);
});
test('o acervo remoto só aceita imagens HTTPS do host configurado do Supabase',()=>{
  assert.equal(safeGalleryURL('https://example.supabase.co/storage/v1/object/public/laute-gallery/foto.webp','example.supabase.co'),'https://example.supabase.co/storage/v1/object/public/laute-gallery/foto.webp');
  for(const url of ['javascript:alert(1)','http://example.supabase.co/a','https://other.site/a','https://example.supabase.co.other.site/a'])assert.equal(safeGalleryURL(url,'example.supabase.co'),null);
});
test('os cursos realizados não aparecem como próximos nem reabrem inscrições',()=>{
  const courses=[{status:'completed'}];assert.equal(filterCourses(courses,'upcoming').length,0);
  assert.equal(filterCourses(courses,'completed').length,1);
  assert.match(readFileSync('cursos.html','utf8'),/inscrições encerradas/);
  assert.doesNotMatch(readFileSync('index.html','utf8'),/id="registration-form"/);
});
test('o menu institucional preserva o acesso a inscrições, painel e validação',()=>{
  assert.match(header('home'),/href="index.html" aria-current="page"/);
  assert.match(header('lookup'),/href="consultar.html" aria-current="page"/);
  assert.match(header('about'),/href="sobre.html" aria-current="page"/);
  assert.match(footer(),/href="admin.html"/);assert.match(footer(),/href="validar.html"/);
  assert.match(header(),/aria-controls="s-navigation"/);
});
test('as rotas e os IDs usados na consulta e na validação continuam disponíveis',()=>{
  for(const [file,ids] of [['consultar.html',['lookup-form','lookup-error','lookup-result']],['validar.html',['verify-form','verify-error','certificate-result']],['admin.html',['login-form']]]){
    const html=readFileSync(file,'utf8');for(const id of ids)assert.ok(html.includes(`id="${id}"`),`${file}: ${id}`);
  }
  const pdf=readFileSync('js/pdf.js','utf8');assert.match(pdf,/certificado-modelo-sutura-2026/);
});
test('menu mobile abre, fecha com Escape, retorna foco e não duplica listeners',()=>{
  const handlers={},navHandlers={},documentHandlers={},attributes={'aria-expanded':'false'};
  let open=false,focused=false;
  const toggle={dataset:{},setAttribute:(k,v)=>attributes[k]=v,getAttribute:k=>attributes[k],addEventListener:(k,fn)=>handlers[k]=fn,focus:()=>focused=true};
  const nav={classList:{toggle:(_name,value)=>open=value,remove:()=>open=false},addEventListener:(k,fn)=>navHandlers[k]=fn};
  const previousDocument=globalThis.document,previousMatch=globalThis.matchMedia;
  globalThis.document={querySelector:q=>q==='#s-menu-toggle'?toggle:nav,addEventListener:(k,fn)=>documentHandlers[k]=fn};
  globalThis.matchMedia=()=>({addEventListener:()=>{}});
  try{
    initNavigation();const click=handlers.click;initNavigation();assert.equal(handlers.click,click);
    handlers.click();assert.equal(open,true);assert.equal(attributes['aria-expanded'],'true');
    documentHandlers.keydown({key:'Escape'});assert.equal(open,false);assert.equal(focused,true);
    handlers.click();navHandlers.click({target:{closest:()=>({})}});assert.equal(open,false);
  }finally{globalThis.document=previousDocument;globalThis.matchMedia=previousMatch;}
});
