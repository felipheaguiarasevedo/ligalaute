import {$,rpc,busy,message,date,escapeHTML as esc} from './common.js?v=20261022-ps1';
import {sessionChangeError} from './session-change.js?v=20261022-ps1';

export function renderAdminSessionChange({registration:r,sessions,hasCertificate,isDirty,onUpdated}){
  const node=$('#admin-session-change');
  if(typeof r.session_change_allowed!=='boolean'){
    node.innerHTML='<h3>Troca de turno pelo participante</h3><p class="message info">Execute o arquivo ATUALIZAR_TROCA_TURNO.sql no Supabase para ativar esta opção. As demais funções do painel continuam disponíveis.</p>';
    return;
  }
  const source=sessions.find(s=>s.id===r.session_id);
  const reason=!['pending','confirmed'].includes(r.status)?'A inscrição precisa estar pendente ou confirmada.'
    :r.attended||hasCertificate?'Não é possível liberar com presença registrada ou certificado ativo.'
    :!source||source.completed||new Date(source.starts_at)<=new Date()?'O turno atual já começou ou foi realizado.':null;
  const previous=sessions.find(s=>s.id===r.session_changed_from);
  node.innerHTML=`<div class="eyebrow">AUTONOMIA DO PARTICIPANTE</div><h3>Troca de turno pelo participante</h3>
    <p><strong>${r.session_change_allowed?'Uma troca liberada':'Troca não liberada'}</strong></p>
    <p class="small muted">Ao liberar, o participante poderá acessar a Área do participante e escolher outro turno com vagas. A autorização é encerrada após uma troca concluída.</p>
    ${r.session_change_allowed_at?`<p class="small">Liberada em ${date(r.session_change_allowed_at)} às ${date(r.session_change_allowed_at,{hour:'2-digit',minute:'2-digit'})}.</p>`:''}
    ${r.session_changed_at?`<p class="small">Última troca pelo participante: ${date(r.session_changed_at)} às ${date(r.session_changed_at,{hour:'2-digit',minute:'2-digit'})}${previous?' · saiu de '+esc(previous.label):''}.</p>`:''}
    ${reason?`<p class="small muted">${esc(reason)}</p>`:''}
    <button type="button" class="btn ${r.session_change_allowed?'secondary':'primary'}" data-allow-change ${reason&&!r.session_change_allowed?'disabled':''}>${r.session_change_allowed?'Revogar liberação':'Liberar uma troca de turno'}</button>
    <p class="small muted">O participante deve ser avisado pela organização. Esta ação não envia mensagens automáticas.</p>
    <div id="admin-change-message" class="message" role="status" hidden></div>`;
  $('[data-allow-change]',node).onclick=async e=>{
    const notice=$('#admin-change-message');
    if(isDirty()){message(notice,'Salve as alterações da inscrição antes de mudar a liberação de turno.','info');return;}
    const button=e.currentTarget,allowed=!r.session_change_allowed;
    busy(button,true,allowed?'Liberando…':'Revogando…');
    $('#detail-form').inert=true;$('#cert-actions').inert=true;$('#close-detail').disabled=true;let saved=false;
    try{
      await rpc('laute_admin_allow_session_change',{p_id:r.id,p_allowed:allowed});saved=true;
      await onUpdated(r.id);
      message($('#admin-change-message'),allowed?'Uma troca liberada. Avise o participante para acessar “Minha inscrição”.':'Liberação revogada. O participante não poderá efetuar uma nova troca.','success');
    }catch(error){message($('#admin-change-message'),saved?'A liberação foi salva, mas a lista não pôde ser atualizada. Atualize o painel para conferir.':sessionChangeError(error));}
    finally{$('#detail-form').inert=false;$('#cert-actions').inert=false;$('#close-detail').disabled=false;if(button.isConnected)busy(button,false);}
  };
}
