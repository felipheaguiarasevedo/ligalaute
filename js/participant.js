import {$,shell,rpc,getPaymentEvent,message,busy,badge,payments,escapeHTML as esc,paymentBlock,bindPayment,date,money} from './common.js?v=20261022-ps1';
import {platformStatus,nameCredentials,verifyAnyCertificate} from './course-api.js?v=20261022-ps1';
import {FIRST_AID_ID,validFullName,fullName,supportLink} from './first-aid-data.js?v=20261022-ps1';
import {certificatePDF} from './pdf.js?v=20261022-ps1';
import {mountSessionChange} from './session-change.js?v=20261022-ps1';
shell('lookup');
const form=$('#participant-form'),fields=$('#participant-access-fields'),box=$('#participant-result');
const requested=new URLSearchParams(location.search).get('curso');
if(['sutura-2026',FIRST_AID_ID].includes(requested))form.elements.course_id.value=requested;
let platform=null,credentials=null,loading=false;
const isLegacy=()=>form.elements.course_id.value==='sutura-2026';
const lock=value=>{for(const el of form.elements)el.disabled=value;};
function access(){
  const legacyCode=!platform?.nameLookup&&isLegacy();
  fields.disabled=!platform?.nameLookup&&!legacyCode;
  $('#participant-name-label').hidden=legacyCode;$('#participant-code-label').hidden=!legacyCode;
  form.elements.full_name.disabled=legacyCode;form.elements.full_name.required=!legacyCode;
  form.elements.code.disabled=!legacyCode;form.elements.code.required=legacyCode;
  $('#participant-access-notice').textContent=platform?.nameLookup?'Selecione o curso e informe seu nome completo e e-mail. Não é necessário código de inscrição.':legacyCode?'O acesso anterior de Sutura continua disponível com código e e-mail enquanto a organização ativa a consulta por nome.':'A organização está ativando o sistema deste curso. A consulta por nome completo e e-mail ficará disponível após a ativação.';
  $('#participant-support').innerHTML=isLegacy()?`<div><span class="eyebrow">SUPORTE · SUTURA</span><h3>Feliphe Asevedo · II Secretário</h3><p>Inscrição, informações e certificados da edição de Sutura.</p></div><a class="btn support-whatsapp" href="https://wa.me/5598984035387" target="_blank" rel="noopener noreferrer">WhatsApp (98) 98403-5387 ↗</a>`:`<div><span class="eyebrow">SUPORTE · PRIMEIROS SOCORROS</span><h3>Alice · 1ª Secretária</h3><p>Inscrições, acesso, informações e certificados.</p></div><a class="btn support-whatsapp" href="${supportLink()}" target="_blank" rel="noopener noreferrer">WhatsApp (98) 99110-0569 ↗</a>`;
}
form.elements.course_id.onchange=()=>{box.hidden=true;box.replaceChildren();credentials=null;message($('#participant-error'),'');access();};
async function render(r,payment,feedback=''){
  box.hidden=false;
  const title=r.title||(isLegacy()?'Curso de Sutura':'Curso de Primeiros Socorros — PCR e OVACE');
  const time=r.session_starts_at?date(r.session_starts_at,{hour:'2-digit',minute:'2-digit'}):'';
  box.innerHTML=`<div class="status-title"><div><span class="eyebrow">${esc(title)}</span><h2>${esc(r.full_name)}</h2></div>${badge(r.status)}</div><p class="muted small">Inscrição recebida em ${date(r.created_at)}</p><div class="timeline"><div class="complete"><strong>Inscrição</strong>Dados recebidos</div><div class="${r.status==='confirmed'?'complete':''}"><strong>Confirmação</strong>${r.status==='confirmed'?'Inscrição confirmada':'Acompanhe a análise'}</div><div class="${r.attended?'complete':''}"><strong>Participação</strong>${r.attended?'Presença registrada':'Aguardando presença'}</div><div class="${r.certificate_id?'complete':''}"><strong>Certificado</strong>${r.certificate_id?'Disponível':'Aguardando liberação'}</div></div><dl><dt>Turno</dt><dd id="participant-current-session">${esc(r.session_label||'A confirmar')}${time?' · '+esc(time):''}${r.session_ends_at?' às '+date(r.session_ends_at,{hour:'2-digit',minute:'2-digit'}):''}${r.session_starts_at?' · '+date(r.session_starts_at):''}</dd><dt>Pagamento</dt><dd>${esc(payments[r.payment_status]||r.payment_status)}</dd><dt>Valor</dt><dd>${money(r.amount_due)}</dd></dl><div id="turn-change-feedback" class="message" hidden role="status"></div><section id="participant-session-change" class="session-change" aria-label="Troca de turno"></section>${r.public_note?`<div class="notice"><strong>Mensagem da organização</strong><p>${esc(r.public_note)}</p></div>`:''}${r.certificate_id?`<div class="notice"><strong>Seu certificado está disponível!</strong><p>Baixe o PDF abaixo. O QR Code do documento permite verificar sua autenticidade.</p></div><div class="button-row"><button type="button" class="btn primary" id="participant-certificate">Baixar certificado PDF</button><a class="btn secondary" href="validar.html?id=${encodeURIComponent(r.certificate_id)}">Validar certificado</a></div>`:'<p class="small muted">A liberação do certificado depende da confirmação da inscrição, pagamento conferido ou isenção, presença e conclusão do turno pela organização.</p>'}${r.payment_status==='pending'&&['pending','confirmed'].includes(r.status)&&payment?paymentBlock({...payment,price:r.amount_due},{...r,code:undefined}):''}<div id="participant-download-error" class="message" role="alert" hidden></div>`;
  if(payment)bindPayment(box,payment);
  $('#participant-certificate')?.addEventListener('click',async e=>{const b=e.currentTarget;busy(b,true,'Gerando PDF…');try{const c=await verifyAnyCertificate(r.certificate_id);if(!c?.valid)throw new Error('Certificado indisponível ou revogado. Atualize a consulta.');await certificatePDF(c);}catch(error){message($('#participant-download-error'),error.message);}finally{busy(b,false);}});
  message($('#turn-change-feedback'),feedback,'success');
  const changeCredentials=isLegacy()?{p_code:r.code,p_email:credentials.p_email}:credentials;
  await mountSessionChange($('#participant-session-change'),changeCredentials,{onBusy:value=>{lock(value);if(!value)access();},onChanged:(updated,text)=>render({...updated,title},payment,text)});
}
form.onsubmit=async e=>{
  e.preventDefault();if(loading)return;
  const fallback=!platform?.nameLookup&&isLegacy(),name=fullName(form.elements.full_name.value),email=form.elements.email.value.trim().toLowerCase();
  if(!fallback&&!validFullName(name)){message($('#participant-error'),'Informe seu nome completo, com nome e sobrenome.');return;}
  credentials=fallback?{p_code:form.elements.code.value.trim(),p_email:email}:nameCredentials(form.elements.course_id.value,name,email);
  loading=true;const b=$('button[type=submit]',form);busy(b,true,'Consultando…');lock(true);message($('#participant-error'),'');box.hidden=true;box.replaceChildren();
  try{
    const r=await rpc(fallback?'laute_lookup':'laute_lookup_by_name',credentials);
    if(!r)throw new Error('Inscrição não localizada. Confira o curso e os dados informados.');
    const payment=await (isLegacy()?getPaymentEvent():rpc('laute_course_payment',credentials)).catch(()=>null);
    await render(r,payment);box.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){message($('#participant-error'),error.message);}
  finally{loading=false;busy(b,false);lock(false);access();}
};
platform=await platformStatus();access();
