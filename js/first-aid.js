import {$,$$,shell,rpc,escapeHTML as esc,date,money,message,busy,paymentBlock,bindPayment,download} from './common.js?v=20261022-ps1';
import {icon} from './site-shell.js?v=20261022-ps1';
import {FIRST_AID,FIRST_AID_ID,FIRST_AID_SESSIONS,coursePhase,fullName,validFullName,supportLink} from './first-aid-data.js?v=20261022-ps1';
import {platformStatus,firstAidAvailability,nameCredentials} from './course-api.js?v=20261022-ps1';
shell('courses');$$('[data-icon]').forEach(el=>el.outerHTML=icon(el.dataset.icon));
const form=$('#first-aid-form'),fields=$('#ps-form-fields');
let event={...FIRST_AID},sessions=[],ready=false,loading=false,sending=false,registered=false,attempt=null;
const range=s=>`${date(s.starts_at,{hour:'2-digit',minute:'2-digit'})} às ${date(s.ends_at,{hour:'2-digit',minute:'2-digit'})}`;
const enabled=s=>ready&&coursePhase(event)==='open'&&s.registrations_enabled&&!s.completed&&Number(s.available)>0&&Date.now()<new Date(s.starts_at).getTime();
function paint(){
  const phase=coursePhase(event),initial=!ready;
  const pool=ready?sessions:FIRST_AID_SESSIONS;
  $('#ps-sessions').innerHTML=pool.map(s=>`<article class="${form.elements.session_id.value===s.id?'is-selected':''}"><span>${esc(s.label.toUpperCase())}</span><h3>${esc(range(s))}</h3><p>Capacidade: <strong>${Number(s.capacity)} pessoas</strong></p>${ready?`<p class="ps-available">${Number(s.available)>0?Number(s.available)+' vagas restantes':'Turno lotado'}</p><small>${Number(s.confirmed)} confirmadas · ${Number(s.pending)} em análise</small>`:'<small>Disponibilidade confirmada após a ativação.</small>'}<button type="button" data-select-turn="${esc(s.id)}" ${enabled(s)&&!registered?'':'disabled'}>${form.elements.session_id.value===s.id?'Turno selecionado':'Escolher '+esc(s.label.toLowerCase())}</button></article>`).join('');
  $$('[data-select-turn]').forEach(button=>button.onclick=()=>{form.elements.session_id.value=button.dataset.selectTurn;paint();form.elements.full_name.focus();});
  for(const option of [...form.elements.session_id.options]){
    if(!option.value)continue;const s=pool.find(turn=>turn.id===option.value);if(!s)continue;
    option.textContent=`${s.label} · ${range(s)}${ready?' · '+s.available+' vagas restantes':''}`;
    option.disabled=!enabled(s);
  }
  fields.disabled=initial||phase!=='open'||sending||registered;
  const window=$('#ps-window');window.classList.toggle('is-open',ready&&phase==='open');
  if(initial)window.textContent=phase==='scheduled'?'Abertura prevista para 22/10/2026. A organização está finalizando a ativação do sistema de inscrições.':'A organização está finalizando a ativação do sistema. O formulário será liberado após a configuração, dentro do período de inscrições.';
  else window.textContent=phase==='scheduled'?`Inscrições abrem em ${date(event.opens_at)} às 00h.`:phase==='closed'?'As inscrições desta edição estão encerradas.':phase==='paused'?'As inscrições foram pausadas pela organização.':'Inscrições abertas. Escolha um turno com vagas e conclua seu cadastro.';
  $$('[data-ps-price]').forEach(el=>el.textContent=money(event.price));$$('[data-ps-hours]').forEach(el=>el.textContent=`${Number(event.hours)} horas`);
  if(event.venue&&!/espaço a divulgar/i.test(event.venue))$('#ps-venue').textContent=event.venue;
  const instructor=$('#ps-instructor');instructor.hidden=!event.instructor;if(event.instructor)$('p',instructor).textContent=event.instructor;
}
async function refresh(){
  if(loading)return;loading=true;const button=$('#ps-refresh');button.disabled=true;
  try{
    const platform=await platformStatus();ready=platform.ready;
    if(ready){const fresh=await firstAidAvailability();event=fresh.event;sessions=fresh.sessions;$('#ps-updated').textContent=`Atualizado às ${date(new Date(),{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · atualização automática`;}
    else $('#ps-updated').textContent=platform.missing?'60 vagas por turno · inscrições aguardando ativação pela organização.':'Não foi possível consultar o sistema. Tente atualizar a disponibilidade.';
    paint();
  }catch{ready=false;paint();$('#ps-updated').textContent='Não foi possível consultar as vagas. Nenhuma inscrição foi enviada; tente atualizar novamente.';}
  finally{loading=false;button.disabled=false;}
}
form.elements.session_id.addEventListener('change',paint);
$('#ps-refresh').addEventListener('click',refresh);
function values(){return {course_id:FIRST_AID_ID,session_id:form.elements.session_id.value,full_name:fullName(form.elements.full_name.value),email:form.elements.email.value.trim().toLowerCase(),phone:form.elements.phone.value.replace(/\D/g,''),accept_terms:form.elements.accept_terms.checked,website:form.elements.website.value};}
form.addEventListener('submit',async ev=>{
  ev.preventDefault();if(sending||registered||!ready||coursePhase(event)!=='open')return;
  const data=values(),turn=sessions.find(s=>s.id===data.session_id);
  message($('#ps-form-error'),'');
  if(!validFullName(data.full_name)){message($('#ps-form-error'),'Informe seu nome completo, com pelo menos nome e sobrenome.');return;}
  if(!enabled(turn||{})){message($('#ps-form-error'),'Selecione um turno disponível.');return;}
  if(data.phone.length<10||data.phone.length>13){message($('#ps-form-error'),'Informe um WhatsApp válido com DDD.');return;}
  if(!data.accept_terms){message($('#ps-form-error'),'Confirme que leu as condições antes de continuar.');return;}
  const fingerprint=JSON.stringify(data);if(!attempt||attempt.fingerprint!==fingerprint)attempt={fingerprint,id:crypto.randomUUID()};
  const button=$('button[type=submit]',form);sending=true;busy(button,true,'Registrando inscrição…');paint();
  try{
    const result=await rpc('laute_course_register',{payload:{...data,request_id:attempt.id}});
    if(!result?.id)throw new Error('Não foi possível confirmar o registro. Tente novamente.');
    registered=true;form.hidden=true;
    const credentials=nameCredentials(FIRST_AID_ID,data.full_name,data.email);
    const payment=await rpc('laute_course_payment',credentials).catch(()=>null);
    const box=$('#ps-success');box.hidden=false;box.innerHTML=`<div class="success-mark" aria-hidden="true">✓</div><span class="s-kicker">Inscrição recebida</span><h3>Que bom ter você nessa experiência, ${esc(data.full_name.split(' ')[0])}.</h3><p>Sua inscrição está <strong>aguardando confirmação do pagamento</strong>. A organização fará a conferência.</p><dl><dt>Participante</dt><dd>${esc(result.full_name)}</dd><dt>Curso</dt><dd>${esc(event.title)}</dd><dt>Turno</dt><dd>${esc(result.session_label)} · ${esc(range(turn))}</dd><dt>Data</dt><dd>19 de novembro de 2026</dd><dt>Seu acesso</dt><dd>Nome completo e e-mail cadastrado</dd></dl><p class="small muted">Não há código de inscrição. Use seu nome completo e e-mail na Área do participante. Guarde o comprovante abaixo.</p>${payment?paymentBlock(payment,result):'<div class="message info">Sua inscrição foi registrada. Consulte a Área do participante para acessar os dados de pagamento.</div>'}<div class="button-row"><a class="s-button s-button-navy" href="consultar.html?curso=${FIRST_AID_ID}">Acessar minha inscrição ${icon('arrow')}</a><button type="button" class="s-button s-button-outline" id="ps-receipt">Salvar comprovante</button></div><div class="ps-success-links"><a href="${supportLink(data.full_name,event)}" target="_blank" rel="noopener noreferrer">Falar com Alice no WhatsApp ${icon('message')}</a><button type="button" id="ps-new-registration">Fazer uma nova inscrição</button></div>`;
    if(payment)bindPayment(box,payment);
    $('#ps-receipt').onclick=()=>download(`LAUTE — SOLICITAÇÃO DE INSCRIÇÃO\n\nCurso: ${event.title}\nParticipante: ${data.full_name}\nE-mail: ${data.email}\nData: 19/11/2026\nTurno: ${turn.label} · ${range(turn)}\nLocal: ${event.venue}\nValor: ${money(result.amount_due)}\nSituação: aguardando confirmação do pagamento pela organização.\n\nAcesse ${new URL('consultar.html?curso='+FIRST_AID_ID,document.baseURI).href}\nInforme seu NOME COMPLETO e E-MAIL; não há código de inscrição.\n\nSuporte: Alice · 1ª Secretária · WhatsApp (98) 99110-0569.\nA inscrição não é confirmação automática de pagamento nem de presença.`, 'LAUTE_Primeiros_Socorros_Inscricao.txt','text/plain;charset=utf-8');
    $('#ps-new-registration').onclick=()=>{registered=false;attempt=null;form.reset();form.hidden=false;box.hidden=true;box.replaceChildren();refresh();$('#ps-form-title').focus?.();};
    box.scrollIntoView({behavior:'smooth',block:'start'});await refresh();
  }catch(error){message($('#ps-form-error'),error.message);await refresh();}
  finally{sending=false;busy(button,false);paint();}
});
paint();refresh();
setInterval(()=>{if(!document.hidden&&!sending)refresh();},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
