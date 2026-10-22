import {$,$$,rpc,date,message,busy,escapeHTML as esc} from './common.js?v=20261022-ps1';

export function sessionChangeError(error){
  const text=error?.message||'Não foi possível consultar os turnos. Tente novamente.';
  return /schema cache|could not find.*function|function .*does not exist/i.test(text)
    ? 'A troca de turno ainda não foi ativada no sistema. A organização precisa executar a atualização do banco.'
    : text;
}

// Credenciais ficam somente na memória desta consulta, nunca na URL ou localStorage.
export async function mountSessionChange(node,credentials,{onChanged,onBusy=()=>{}}={}){
  let state,request=null,loading=false,sending=false;
  node.innerHTML=`<div class="session-change-heading"><div><span class="eyebrow">SUA PARTICIPAÇÃO</span><h3>Trocar de turno</h3></div><button type="button" class="btn secondary" data-refresh-turns>Atualizar liberação e vagas</button></div>
    <p class="small muted" data-change-info>Consultando a liberação da organização…</p>
    <form data-change-form hidden><fieldset class="change-options"><legend>Escolha o novo turno</legend><div data-change-options></div></fieldset>
    <p class="small muted">Cada liberação permite uma troca. Sua inscrição e pagamento serão mantidos. A disponibilidade será conferida novamente ao confirmar.</p>
    <button type="submit" class="btn primary" disabled>Confirmar troca de turno</button></form>
    <div class="message" data-change-message hidden role="status"></div>`;
  const form=$('[data-change-form]',node),refresh=$('[data-refresh-turns]',node),notice=$('[data-change-message]',node),submit=$('button[type=submit]',form);
  const selected=()=>form.querySelector('input[name=new_session]:checked')?.value;
  const updateButton=()=>{submit.disabled=loading||sending||!state?.eligible||!selected();};

  async function load(clear=true){
    if(loading||!node.isConnected)return;
    loading=true;busy(refresh,true,'Atualizando…');updateButton();if(clear)message(notice,'');
    const previous=selected();
    try{
      const result=await rpc(credentials.p_full_name?'laute_course_change_options':'laute_session_change_options',credentials);
      if(!node.isConnected)return;
      state=result;
      $('[data-change-info]',node).textContent=result.eligible
        ? 'A organização liberou uma troca para você. Escolha um dos turnos disponíveis abaixo.'
        : result.reason||'Solicite a liberação à organização para mudar de turno.';
      const current=$('#participant-current-session');
      if(current&&result.current_session_label)current.textContent=`${result.current_session_label} · ${date(result.current_session_starts_at,{hour:'2-digit',minute:'2-digit'})} · ${date(result.current_session_starts_at)}`;
      form.hidden=!result.eligible;
      const options=result.options||[];
      $('[data-change-options]',node).innerHTML=options.map(s=>{
        const disabled=!s.accepting||s.available<=0;
        const label=s.completed||new Date(s.starts_at)<=new Date()?'Turno iniciado ou realizado':!s.registrations_enabled?'Turno pausado':s.available<=0?'Sem vagas':`${s.available} ${Number(s.available)===1?'vaga disponível':'vagas disponíveis'}`;
        return `<label class="change-option ${disabled?'is-unavailable':''}"><input type="radio" name="new_session" value="${esc(s.id)}" ${disabled?'disabled':''} ${s.id===previous&&!disabled?'checked':''} required><span><strong>${esc(s.label)}</strong><span>${date(s.starts_at)} · ${date(s.starts_at,{hour:'2-digit',minute:'2-digit'})}</span></span><span class="change-seat">${esc(label)}</span></label>`;
      }).join('');
      if(result.eligible&&!options.some(s=>s.accepting&&s.available>0))
        $('[data-change-info]',node).textContent='Sua troca está liberada, mas não há outro turno disponível neste momento. Sua inscrição permanece no turno atual. Tente atualizar as vagas mais tarde ou fale com a organização.';
    }catch(error){
      if(!node.isConnected)return;
      state=null;form.hidden=true;
      $('[data-change-info]',node).textContent='Sua inscrição permanece registrada. Não foi possível consultar a troca de turno.';
      message(notice,sessionChangeError(error));
    }finally{loading=false;busy(refresh,false);updateButton();}
  }
  refresh.onclick=()=>load();
  form.onchange=updateButton;
  form.onsubmit=async e=>{
    e.preventDefault();
    if(sending||loading||!state?.eligible||!selected())return;
    const id=selected(),target=state.options.find(s=>s.id===id);
    if(!target||!target.accepting||target.available<=0)return;
    if(!confirm(`Confirmar a mudança para ${target.label}, em ${date(target.starts_at)} às ${date(target.starts_at,{hour:'2-digit',minute:'2-digit'})}?\n\nSua vaga no turno anterior será liberada. Para trocar novamente, será necessária uma nova autorização da organização.`))return;
    if(!request||request.sessionId!==id)request={sessionId:id,id:crypto.randomUUID()};
    sending=true;busy(submit,true,'Confirmando troca…');refresh.disabled=true;
    $$('input',form).forEach(el=>{el.dataset.wasDisabled=String(el.disabled);el.disabled=true;});onBusy(true);message(notice,'');
    try{
      const result=await rpc(credentials.p_full_name?'laute_course_change_session':'laute_change_session',{...credentials,p_session_id:id,p_request_id:request.id});
      if(!result?.registration)throw new Error('Atualize a consulta para conferir o turno da sua inscrição.');
      await onChanged(result.registration,result.replayed
        ? 'Esta solicitação já havia sido concluída. Confira seu turno atual abaixo.'
        : 'Turno alterado com sucesso! Sua inscrição e pagamento foram mantidos.');
    }catch(error){
      if(node.isConnected){message(notice,sessionChangeError(error));await load(false);}
    }finally{
      sending=false;onBusy(false);
      if(node.isConnected){busy(submit,false);refresh.disabled=false;$$('input',form).forEach(el=>{if(el.dataset.wasDisabled!==undefined)el.disabled=el.dataset.wasDisabled==='true';});updateButton();}
    }
  };
  await load();
}
