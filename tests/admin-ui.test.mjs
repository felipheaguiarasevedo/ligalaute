// Teste DOM isolado: os serviços são stubs em memória; não há conexão com o Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {FIRST_AID,FIRST_AID_SESSIONS} from '../js/first-aid-data.js';
const domPath=process.env.LAUTE_DOM_PATH;
const urlCode=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
test('central administrativa e operações do curso em DOM isolado',{skip:!domPath},async t=>{
  const {Window}=await import(pathToFileURL(domPath));const window=new Window({url:'https://local.test/admin.html'});
  window.document.body.innerHTML='<main><section id="dashboard"></section></main>';
  const previous=new Map();for(const [k,v] of Object.entries({window,document:window.document,FormData:window.FormData,confirm:()=>true})){previous.set(k,globalThis[k]);globalThis[k]=v;}
  const cid=FIRST_AID.id;
  const data={ready:true,admin:true,event:{...FIRST_AID,pix_key:'PIX-TESTE',pix_recipient:'Financeiro',signer_name:'Responsável',coordinator_name:'Coordenação'},rows:[
    {id:'00000000-0000-0000-0000-000000000101',course_id:cid,session_id:'ps-2026-manha',full_name:'Ana de Teste',email:'ana@example.com',phone:'98999990000',status:'pending',payment_status:'pending',amount_due:25,attended:false,created_at:'2026-10-22T10:00:00-03:00',accepted_at:'2026-10-22T10:00:00-03:00',public_note:'',admin_note:'Nota interna',terms_version:'v1',session_change_allowed:false},
    {id:'00000000-0000-0000-0000-000000000102',course_id:cid,session_id:'ps-2026-tarde',full_name:'Bruna de Teste',email:'bruna@example.com',phone:'98999990001',status:'confirmed',payment_status:'paid',amount_due:25,attended:false,created_at:'2026-10-22T11:00:00-03:00',accepted_at:'2026-10-22T11:00:00-03:00',public_note:'',admin_note:'',terms_version:'v1',session_change_allowed:false}
  ],certs:[],sessions:FIRST_AID_SESSIONS.map(s=>({...s,registrations_enabled:true,completed:false})),calls:[],legacy:0,logout:0};
  function availability(){return data.sessions.map(s=>{const group=data.rows.filter(r=>r.session_id===s.id),confirmed=group.filter(r=>r.status==='confirmed').length,pending=group.filter(r=>r.status==='pending').length;return {...s,confirmed,pending,total:group.length,available:s.capacity-confirmed-pending};});}
  data.db={from(name){let equal=null;return {select(){return this;},eq(key,value){equal=[key,value];return this;},order(){return this;},async single(){assert.equal(name,'laute_courses');assert.deepEqual(equal,['id',cid]);return {data:{...data.event}};},async range(){assert.deepEqual(equal,['course_id',cid]);return {data:structuredClone(name==='laute_course_registrations'?data.rows:data.certs)};}};}};
  data.rpc=async(name,args={})=>{data.calls.push({name,args:structuredClone(args)});if(name==='laute_is_admin')return data.admin;if(!data.admin)throw new Error('Acesso restrito.');if(name==='laute_course_availability')return availability();if(name==='laute_course_admin_update'){Object.assign(data.rows.find(r=>r.id===args.p_id),args.payload);return {};}
    if(name==='laute_course_admin_allow_change'){data.rows.find(r=>r.id===args.p_id).session_change_allowed=args.p_allowed;return {};}
    if(name==='laute_course_admin_save'){Object.assign(data.event,args.payload);return {};}
    if(name==='laute_course_admin_save_sessions'){data.sessions=args.payload;return {};}
    throw new Error('RPC não esperada no teste: '+name);};
  globalThis.__lauteUITest=data;
  const common=urlCode(`export const $=(q,root=document)=>root.querySelector(q);export const $$=(q,root=document)=>[...root.querySelectorAll(q)];export const db=globalThis.__lauteUITest.db;export const rpc=(...args)=>globalThis.__lauteUITest.rpc(...args);export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));export const date=v=>new Date(v).toLocaleDateString('pt-BR');export const money=v=>'R$ '+Number(v).toFixed(2);export function message(node,text,type='error'){if(!node)return;node.textContent=text;node.hidden=!text;node.className='message '+type;}export const busy=()=>{};export const badge=v=>'<span>'+v+'</span>';export const payments={pending:'Pendente',paid:'Conferido',waived:'Isento',refunded:'Reembolsado'};export const statuses={pending:'Pendente',confirmed:'Confirmada',cancelled:'Cancelada',suspended:'Suspensa'};export const download=()=>{};`);
  const api=urlCode(`export const platformStatus=async()=>({ready:globalThis.__lauteUITest.ready,missing:!globalThis.__lauteUITest.ready,nameLookup:globalThis.__lauteUITest.ready});export const activationFile='supabase/ATIVAR_MULTICURSOS_PRIMEIROS_SOCORROS.sql';export const verifyAnyCertificate=async()=>({valid:true});`);
  const pdf=urlCode('export const certificatePDF=async()=>{};');
  let code=readFileSync('js/admin-courses.js','utf8');
  code=code.replace(/from '\.\/common\.js[^']*'/,`from '${common}'`).replace(/from '\.\/course-api\.js[^']*'/,`from '${api}'`).replace(/from '\.\/pdf\.js[^']*'/,`from '${pdf}'`).replace(/from '\.\/first-aid-data\.js[^']*'/,`from '${pathToFileURL(process.cwd()+'/js/first-aid-data.js')}'`);
  try{
    const {createCourseHub}=await import(urlCode(code+'\n//# sourceURL=laute-admin-ui-test.mjs'));const hub=createCourseHub({legacyStats:()=>({total:30,confirmed:25,certificates:20}),onLegacy:()=>data.legacy++,onLogout:()=>data.logout++});
    const $=q=>document.querySelector(q);
    await t.test('hub mostra ambos os cursos; novo painel mostra vagas reais e nenhuma linha de Sutura',async()=>{await hub.open();assert.equal(document.querySelectorAll('.course-hub-card').length,2);await $('[data-hub-new]').onclick();assert.equal($('#mc-rows').children.length,2);assert.match($('#mc-seats').textContent,/59/);assert.doesNotMatch($('#mc-rows').textContent,/Sutura/);});
    await t.test('busca, filtros, seleção e alterações individuais funcionam',async()=>{
      $('#mc-search').value='bruna';$('#mc-search').oninput();assert.equal($('#mc-rows').children.length,1);assert.match($('#mc-rows').textContent,/Bruna/);
      $('#mc-search').value='';$('#mc-search').oninput();$('[data-mc-detail="'+data.rows[0].id+'"]').onclick();
      const f=$('#mc-detail-form');f.elements.status.value='confirmed';f.elements.payment_status.value='paid';f.elements.attended.checked=true;
      await f.onsubmit({preventDefault(){}});assert.equal(data.rows[0].status,'confirmed');assert.equal(data.rows[0].payment_status,'paid');assert.equal(data.rows[0].attended,true);
      assert.equal($('#mc-detail-form').elements.attended.checked,true);assert.equal($('#mc-detail-form').elements.status.disabled,false);
      await $('[data-mc-allow]').onclick();assert.equal(data.rows[0].session_change_allowed,true);assert.match($('[data-mc-allow]').textContent,/Bloquear/);$('[data-mc-close]').onclick();
    });
    await t.test('configurações preservam vazio de ministrante e convertem datas em Brasília',async()=>{
      $('#mc-tab-settings').onclick();const f=$('#mc-course-form');assert.equal(f.elements.instructor.value,'');
      f.elements.venue.value='Estácio Turu — sala confirmada';await f.onsubmit({preventDefault(){},currentTarget:f});
      assert.equal(data.event.venue,'Estácio Turu — sala confirmada');assert.equal(data.event.instructor,'');assert.match(data.event.opens_at,/-03:00$/);assert.equal(data.event.payment_deadline,null);
      await $('#mc-session-form').onsubmit({preventDefault(){},currentTarget:$('#mc-session-form')});assert.equal(data.sessions.length,3);assert.equal(data.sessions[2].capacity,60);assert.match(data.sessions[2].ends_at,/21:30:00-03:00/);
    });
    await t.test('lote respeita seleção e atualiza somente o novo curso',async()=>{
      $('#mc-tab-regs').onclick();const cb=$('[data-mc-select="'+data.rows[1].id+'"]');cb.checked=true;cb.onchange();$('#mc-bulk-action').value='attended';$('#mc-bulk-action').onchange();
      assert.equal($('#mc-apply').disabled,false);await $('#mc-apply').onclick();assert.equal(data.rows[1].attended,true);assert.match($('#mc-picked').textContent,/0/);
      assert.ok(data.calls.filter(c=>c.name==='laute_course_admin_update').every(c=>data.rows.some(r=>r.id===c.args.p_id)));
    });
    await t.test('navegação retorna ao legado e logout limpa dados da tela',async()=>{
      await $('[data-mc-back]').onclick();$('[data-hub-legacy]').onclick();assert.equal(data.legacy,1);hub.hide();assert.equal($('#course-hub').textContent,'');assert.equal($('#multicourse-dashboard').textContent,'');
    });
    await t.test('sem migração, oferece SQL e não inventa lista ou vagas disponíveis',async()=>{
      data.ready=false;await hub.open();assert.match($('#course-hub').textContent,/Ativação pendente/);await $('[data-hub-new]').onclick();assert.match($('#multicourse-dashboard').textContent,/SQL Editor/);assert.equal($('#mc-rows'),null);hub.hide();
    });
  }finally{delete globalThis.__lauteUITest;for(const [k,v]of previous){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}await window.happyDOM.close();}
});
