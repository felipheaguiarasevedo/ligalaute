// Cadastro e consulta são exercitados com serviços em memória, sem rede e sem registros reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {FIRST_AID,FIRST_AID_SESSIONS} from '../js/first-aid-data.js';
const domPath=process.env.LAUTE_DOM_PATH;
const urlCode=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const settle=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
test('cadastro, consulta por nome e troca em DOM isolado',{skip:!domPath},async t=>{
  const {Window}=await import(pathToFileURL(domPath));
  const window=new Window({url:'https://local.test/primeiros-socorros.html'}),previous=new Map();
  for(const [k,v]of Object.entries({window,document:window.document,location:window.location,sessionStorage:window.sessionStorage,FormData:window.FormData,setInterval:()=>0,confirm:()=>true})){previous.set(k,globalThis[k]);globalThis[k]=v;}
  window.HTMLElement.prototype.scrollIntoView=function(){};
  const data={ready:true,event:{...FIRST_AID,opens_at:'2026-01-01T00:00:00-03:00'},rows:[],calls:[],allowed:false};
  const sessions=()=>FIRST_AID_SESSIONS.map(s=>({...s,completed:false,registrations_enabled:true,confirmed:0,pending:data.rows.filter(r=>r.session_id===s.id).length,available:60-data.rows.filter(r=>r.session_id===s.id).length}));
  const payment={title:FIRST_AID.title,price:25,pix_key:'PIX-TESTE',pix_recipient:'Financeiro teste',contact_whatsapp:'5598999999999',finance_contact:'Financeiro teste',payment_instructions:'Conferir antes de pagar.'};
  data.db={rpc:async(name,args={})=>{data.calls.push({name,args:structuredClone(args)});let result;
    if(name==='laute_platform_status')result={first_aid_ready:data.ready,name_lookup:data.ready};
    else if(name==='laute_course_public')result=data.event;
    else if(name==='laute_course_availability')result=sessions();
    else if(name==='laute_course_register'){
      const p=args.payload;const s=FIRST_AID_SESSIONS.find(s=>s.id===p.session_id);
      result={id:'00000000-0000-0000-0000-000000000111',full_name:p.full_name,title:FIRST_AID.title,course_id:FIRST_AID.id,status:'pending',payment_status:'pending',amount_due:25,session_id:s.id,session_label:s.label,session_starts_at:s.starts_at,session_ends_at:s.ends_at,attended:false,created_at:'2026-10-22T10:00:00-03:00',public_note:'',certificate_id:null};data.rows.push(result);
    }else if(name==='laute_course_payment')result=payment;
    else if(name==='laute_lookup_by_name'){
      result=data.rows.find(r=>r.full_name===args.p_full_name);if(!result)return {error:{message:'Inscrição não localizada.'}};
    }else if(name==='laute_course_change_options')result={eligible:data.allowed,current_session_label:data.rows[0].session_label,current_session_starts_at:data.rows[0].session_starts_at,options:sessions().filter(s=>s.id!==data.rows[0].session_id).map(s=>({...s,accepting:true}))};
    else if(name==='laute_course_change_session'){
      assert.equal(args.p_full_name,'Ana Cláudia de Teste');assert.equal(args.p_email,'ana@example.com');const s=FIRST_AID_SESSIONS.find(s=>s.id===args.p_session_id);Object.assign(data.rows[0],{session_id:s.id,session_label:s.label,session_starts_at:s.starts_at,session_ends_at:s.ends_at});data.allowed=false;result={registration:data.rows[0],replayed:false};
    }else throw new Error('RPC inesperada: '+name);
    return {data:structuredClone(result),error:null};}};
  globalThis.__lautePublicUITest=data;
  const shell=urlCode('export const header=()=>"";export const footer=()=>"";export const shell=()=>{};export const icon=()=>"";');
  let commonCode=readFileSync('js/common.js','utf8').replace(/^import .*createClient.*\n/,'').replace(/^import .*site-shell.*\n/m,`import {header as siteHeader,footer as siteFooter,shell as siteShell} from '${shell}';\n`).replace(/^export const db = .*;$/m,'export const db = globalThis.__lautePublicUITest.db;');
  const common=urlCode(commonCode+'\n//# sourceURL=laute-public-common-ui-test.mjs');
  const localData=pathToFileURL(process.cwd()+'/js/first-aid-data.js').href;
  function transform(code,replacements){return code.replace(/from ['"]\.\/([a-z0-9-]+)\.js(?:\?[^'"]*)?['"]/g,(_m,name)=>{const url=replacements[name];assert.ok(url,'Importação não isolada: '+name);return `from '${url}'`;});}
  const api=urlCode(transform(readFileSync('js/course-api.js','utf8'),{common,'first-aid-data':localData})+'\n//# sourceURL=laute-course-api-ui-test.mjs');
  const change=urlCode(transform(readFileSync('js/session-change.js','utf8'),{common})+'\n//# sourceURL=laute-session-change-ui-test.mjs');
  const pdf=urlCode('export const certificatePDF=async()=>{};');
  const $=q=>document.querySelector(q);
  try{
    await t.test('formulário só ativa após o servidor responder e conclui sem código, com vagas atualizadas',async()=>{
      document.write(readFileSync('primeiros-socorros.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));
      assert.equal($('#ps-form-fields').disabled,true);
      await import(urlCode(transform(readFileSync('js/first-aid.js','utf8'),{common,'site-shell':shell,'first-aid-data':localData,'course-api':api})+'\n//# sourceURL=laute-first-aid-ui-test.mjs'));await settle();
      assert.equal($('#ps-form-fields').disabled,false);const f=$('#first-aid-form');
      f.elements.session_id.value='ps-2026-noite';f.elements.full_name.value='  Ana  Cláudia de Teste ';f.elements.email.value='ANA@example.com';f.elements.phone.value='(98) 99999-0000';f.elements.accept_terms.checked=true;
      f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
      assert.equal(data.calls.filter(c=>c.name==='laute_course_register').length,1);assert.equal(f.hidden,true);assert.equal($('#ps-success').hidden,false);
      assert.equal(data.rows[0].full_name,'Ana Cláudia de Teste');assert.match($('#ps-success').textContent,/aguardando confirmação do pagamento/);assert.doesNotMatch($('#ps-success').textContent,/undefined/);
      assert.match($('#ps-sessions').textContent,/59 vagas restantes/);assert.equal(document.querySelectorAll('#ps-success #ps-new-registration').length,1);
      $('#ps-new-registration').click();await settle();assert.equal(f.hidden,false);assert.equal(f.elements.full_name.value,'');assert.equal($('#ps-form-fields').disabled,false);
    });
    await t.test('consulta exige nome e e-mail, mantém código oculto e permite troca autorizada',async()=>{
      document.open();document.write(readFileSync('consultar.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));document.close();
      data.allowed=true;
      await import(urlCode(transform(readFileSync('js/participant.js','utf8'),{common,'course-api':api,'first-aid-data':localData,pdf,'session-change':change})+'\n//# sourceURL=laute-participant-ui-test.mjs'));await settle();
      assert.equal($('#participant-code-label').hidden,true);assert.equal($('#participant-form').elements.code.disabled,true);
      const f=$('#participant-form');f.elements.full_name.value='Ana Cláudia de Teste';f.elements.email.value='ana@example.com';await f.onsubmit({preventDefault(){}});await settle();
      assert.equal($('#participant-result').hidden,false);assert.match($('#participant-result').textContent,/Ana Cláudia de Teste/);assert.equal(f.elements.code.disabled,true);assert.equal(f.elements.full_name.disabled,false);
      assert.doesNotMatch($('#participant-result').textContent,/Nota interna|98999990000/);
      const radio=document.querySelector('[name=new_session][value="ps-2026-manha"]');radio.checked=true;const changeForm=document.querySelector('[data-change-form]');changeForm.onchange();await changeForm.onsubmit({preventDefault(){}});await settle();
      assert.equal(data.rows[0].session_id,'ps-2026-manha');assert.match($('#participant-current-session').textContent,/Manhã/);assert.match($('#turn-change-feedback').textContent,/sucesso/);assert.equal(f.elements.full_name.disabled,false);assert.equal(f.elements.code.disabled,true);
    });
  }finally{delete globalThis.__lautePublicUITest;for(const [k,v]of previous){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}await window.happyDOM.close();}
});
