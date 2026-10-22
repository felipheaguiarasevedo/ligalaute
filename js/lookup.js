import {$,shell,getPublicEvent,getPaymentEvent,hydrate,message,rpc,busy,badge,payments,escapeHTML as esc,paymentBlock,bindPayment,date,money} from './common.js?v=20261022-ps1';
import { certificatePDF } from './pdf.js?v=20261022-ps1';
import {registrationSession} from './sessions.js?v=20261022-ps1';
import {mountSessionChange} from './session-change.js?v=20261022-ps1';
shell('lookup');let event;try{event=await getPublicEvent();hydrate(event);}catch{}
if(location.hash){try{$('#lookup-form').elements.code.value=decodeURIComponent(location.hash.slice(1));}catch{}}
const lookupForm=$('#lookup-form');
let credentials=null;
function lockLookup(locked){for(const el of lookupForm.elements)el.disabled=locked;}
async function renderRegistration(r,paymentEvent,feedback=''){
const box=$('#lookup-result');box.hidden=false;box.innerHTML=`<div class="status-title"><div><span class="eyebrow">${esc(r.code)}</span><h2>${esc(r.full_name)}</h2></div>${badge(r.status)}</div><p class="muted small">${esc(r.course)} · Inscrição recebida em ${date(r.created_at)}</p><div class="timeline"><div class="complete"><strong>Inscrição recebida</strong>Dados registrados</div><div class="${r.status==='confirmed'?'complete':''}"><strong>Confirmação</strong>${r.status==='confirmed'?'Vaga confirmada':'Acompanhe a análise'}</div><div class="${r.attended?'complete':''}"><strong>Participação</strong>${r.attended?'Presença registrada':'Aguardando o curso'}</div><div class="${r.certificate_id?'complete':''}"><strong>Certificado</strong>${r.certificate_id?'Disponível':'Aguardando liberação'}</div></div><dl><dt>Turno</dt><dd id="participant-current-session">${esc(registrationSession(r))} · ${date(r.session_starts_at)}</dd><dt>Pagamento</dt><dd>${esc(payments[r.payment_status])}</dd><dt>Valor da inscrição</dt><dd>${money(r.amount_due)}</dd></dl><div id="turn-change-feedback" class="message" hidden role="status"></div><section id="participant-session-change" class="session-change" aria-label="Troca de turno"></section>${r.public_note?`<div class="notice"><strong>Mensagem da organização</strong><p>${esc(r.public_note)}</p></div>`:''}${r.certificate_id?'<div class="notice"><strong>Seu certificado está disponível!</strong><p>Baixe o PDF ou consulte a validação pública.</p></div><div class="button-row"><button class="btn primary" id="certificate">Baixar certificado PDF</button><a class="btn secondary" href="validar.html?id='+encodeURIComponent(r.certificate_id)+'">Validar certificado</a></div>':`<p class="small muted">O certificado é emitido após a realização do curso, confirmação da inscrição e registro de presença pela organização.</p>`}${r.payment_status==='pending' && ['pending','confirmed'].includes(r.status) && paymentEvent?paymentBlock({...paymentEvent,price:r.amount_due},r):''}<div id="download-error" class="message" hidden role="alert"></div>`;if(paymentEvent)bindPayment(box,paymentEvent);$('#certificate')?.addEventListener('click',async ev=>{const b=ev.currentTarget;busy(b,true,'Gerando PDF…');try{const c=await rpc('laute_verify_certificate',{p_id:r.certificate_id});await certificatePDF(c);}catch(err){message($('#download-error'),err.message);}finally{busy(b,false);}});
message($('#turn-change-feedback'),feedback,'success');
await mountSessionChange($('#participant-session-change'),credentials,{
  onBusy:lockLookup,
  onChanged:(updated,text)=>renderRegistration(updated,paymentEvent,text)
});
}
lookupForm.onsubmit=async e=>{
  e.preventDefault();const btn=$('button',lookupForm);busy(btn,true);message($('#lookup-error'),'');
  $('#lookup-result').hidden=true;$('#lookup-result').replaceChildren();
  credentials={p_code:lookupForm.elements.code.value.trim(),p_email:lookupForm.elements.email.value.trim()};
  lockLookup(true);
  try{
    const r=await rpc('laute_lookup',credentials);
    if(!r)throw new Error('Inscrição não localizada. Confira o código e o e-mail informados.');
    const paymentEvent=await getPaymentEvent().catch(()=>null);
    await renderRegistration(r,paymentEvent);
  }catch(err){message($('#lookup-error'),err.message);}
  finally{busy(btn,false);lockLookup(false);}
};
