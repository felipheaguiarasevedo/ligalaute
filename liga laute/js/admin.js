import {$,$$,shell,db,configured,rpc,getEvent,message,busy,badge,payments,statuses,escapeHTML as esc,date,money,download,registrationWindow} from './common.js?v=20261022-ps1';
import {certificatePDF} from './pdf.js?v=20261022-ps1';
import {getSessions,renderSessions,fillSessionOptions,sessionText} from './sessions.js?v=20261022-ps1';
import {renderAdminSessionChange} from './admin-session-change.js?v=20261022-ps1';
import {sessionChangeError} from './session-change.js?v=20261022-ps1';
import {createCourseHub} from './admin-courses.js?v=20261022-ps1';
shell();let rows=[],certificates=[],sessions=[],event,selected,loadingSummary=false;const selectedIds=new Set();let bulkRunning=false;const galleryBucket='laute-gallery';let galleryRows=[];
const login=$('#login-form'),detail=$('#detail-form'),settings=$('#settings-form');
const courseHub=createCourseHub({legacyStats:()=>({total:rows.length,confirmed:rows.filter(r=>r.status==='confirmed').length,certificates:certificates.filter(c=>!c.revoked_at).length}),onLegacy:async()=>{$('#dashboard').hidden=false;await loadAdminGallery();},onLogout:()=>$('#logout').click()});
const allCoursesButton=document.createElement('button');allCoursesButton.type='button';allCoursesButton.className='mc-back mc-legacy-back';allCoursesButton.textContent='← Todos os cursos';allCoursesButton.onclick=()=>courseHub.open();$('#dashboard').prepend(allCoursesButton);
async function requireAdmin(){if(!db)throw new Error('Ative a conexão em config.js e execute os scripts SQL. Consulte o guia incluído no projeto.');const {data,error}=await db.auth.getUser();if(error||!data.user)return false;const allowed=await rpc('laute_is_admin');if(!allowed){await db.auth.signOut();throw new Error('Este usuário não tem autorização administrativa.');}return true;}
async function allRows(table){const result=[];for(let from=0;;from+=500){const {data,error}=await db.from(table).select('*').order('id').range(from,from+499);if(error)throw new Error(error.message);result.push(...data);if(data.length<500)return result;}}
async function refresh(){if(!await requireAdmin())throw new Error('Sua sessão expirou. Entre novamente.');[rows,certificates,event,sessions]=await Promise.all([allRows('laute_registrations'),allRows('laute_certificates'),getEvent(),getSessions()]);rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));for(const id of selectedIds)if(!rows.some(r=>String(r.id)===id))selectedIds.delete(id);$('#admin-event').textContent=`${event.title} · ${date(event.starts_at)} · ${event.instructor}`;$('#stat-total').textContent=rows.length;$('#stat-confirmed').textContent=rows.filter(r=>r.status==='confirmed').length;$('#stat-pending').textContent=rows.filter(r=>r.status==='pending').length;$('#stat-certificates').textContent=certificates.filter(c=>!c.revoked_at).length;$('#course-status').textContent=registrationWindow(event);$('#course-dates').textContent=`Inscrições: ${date(event.opens_at)} a ${date(event.closes_at)} · Pagamento até ${date(event.payment_deadline)} · ${event.hours} horas extracurriculares`;$('#toggle-registrations').textContent=event.registrations_enabled?'Pausar inscrições':'Aceitar inscrições';render();fillSettings();fillSessionSettings();renderSummary();fillSessionOptions($('#filter-session'),sessions);}
async function enter(){await refresh();$('#login').hidden=true;$('#dashboard').hidden=true;await courseHub.open();}
login.onsubmit=async e=>{e.preventDefault();const b=$('button',login);busy(b,true,'Entrando…');message($('#login-error'),'');try{if(!db)throw new Error('Ative a conexão em config.js e execute os scripts SQL. Consulte o guia do projeto.');const {error}=await db.auth.signInWithPassword({email:login.elements.email.value.trim(),password:login.elements.password.value});if(error)throw new Error('Não foi possível entrar. Confira seu e-mail e sua senha.');if(await requireAdmin()){login.elements.password.value='';await enter();}}catch(err){message($('#login-error'),err.message);}finally{busy(b,false);}};
$('#logout').onclick=async()=>{if(courseHub.busy)return;await db.auth.signOut();courseHub.hide();rows=[];certificates=[];selected=null;$('#detail').close();$('#dashboard').hidden=true;$('#login').hidden=false;$('#registrations-list').innerHTML='';};
$('#refresh').onclick=async e=>{busy(e.currentTarget,true);try{await refresh();message($('#admin-message'),'Lista atualizada.','success');}catch(err){message($('#admin-message'),err.message);}finally{busy($('#refresh'),false);}};
function filtered(){const q=$('#search').value.trim().toLocaleLowerCase('pt-BR');return rows.filter(r=>(!$('#filter').value||r.status===$('#filter').value)&&(!$('#filter-session').value||r.session_id===$('#filter-session').value)&&(!q||[r.full_name,r.email,r.course,r.code].join(' ').toLocaleLowerCase('pt-BR').includes(q)));}
function activeCert(id){return certificates.find(c=>c.registration_id===id&&!c.revoked_at);}
function render(){
  const list=filtered(),box=$('#select-filtered');
  $('#result-count').textContent=`${list.length} de ${rows.length} inscrições exibidas (a seleção pode incluir outras buscas)`;
  $('#empty').hidden=list.length>0;
  $('#registrations-list').innerHTML=list.map(r=>`<tr><td><input type="checkbox" class="row-check" aria-label="Selecionar ${esc(r.full_name)}" data-select-id="${esc(r.id)}" ${selectedIds.has(String(r.id))?'checked':''} ${bulkRunning?'disabled':''}></td><td><strong>${esc(r.full_name)}</strong><small>${esc(r.code)}</small><br><small>${esc(r.email)}</small></td><td>${esc(r.course)}<br><small>${esc(r.institution)}</small></td><td>${esc(sessionText(sessions.find(s=>s.id===r.session_id)))}${r.session_change_allowed?'<br><small class="change-enabled-label">Troca liberada</small>':''}</td><td>${badge(r.status)}</td><td>${esc(payments[r.payment_status])}<br><small>${money(r.amount_due)}</small></td><td>${r.attended?'Registrada':'Pendente'}${activeCert(r.id)?'<br><small>Certificado emitido</small>':''}</td><td><button class="btn secondary" data-id="${esc(r.id)}" ${bulkRunning?'disabled':''}>Gerenciar</button></td></tr>`).join('');
  $$('[data-id]', $('#registrations-list')).forEach(b=>b.onclick=()=>openDetail(b.dataset.id));
  $$('[data-select-id]', $('#registrations-list')).forEach(cb=>cb.onchange=()=>{if(cb.checked)selectedIds.add(cb.dataset.selectId);else selectedIds.delete(cb.dataset.selectId);renderSelection();});
  const shown=list.filter(r=>selectedIds.has(String(r.id))).length;
  box.checked=list.length>0&&shown===list.length;box.indeterminate=shown>0&&shown<list.length;box.disabled=bulkRunning||list.length===0;
  renderSelection();
}
function renderSelection(){
  const n=selectedIds.size;$('#selected-count').textContent=`${n} ${n===1?'inscrição selecionada':'inscrições selecionadas'}`;
  $('#apply-bulk').disabled=bulkRunning||!n||!$('#bulk-action').value;
  $('#bulk-action').disabled=bulkRunning;$('#clear-selection').disabled=bulkRunning||!n;
}
$('#select-filtered').onchange=e=>{for(const r of filtered()){if(e.target.checked)selectedIds.add(String(r.id));else selectedIds.delete(String(r.id));}render();};
$('#clear-selection').onclick=()=>{selectedIds.clear();render();$('#bulk-progress').textContent='Seleção limpa. Use os filtros para localizar os participantes desejados.';};
$('#bulk-action').onchange=renderSelection;
$('#apply-bulk').onclick=async()=>{
  const op=$('#bulk-action').value,targets=[...selectedIds].map(id=>rows.find(r=>String(r.id)===id)).filter(Boolean);
  const labels={confirmed:'confirmar',cancelled:'cancelar',pending:'marcar como pendentes',suspended:'suspender',attended:'registrar a presença de',certificate:'emitir certificados para',session_change_allow:'liberar uma troca de turno para',session_change_block:'revogar a liberação de troca de turno de'};
  if(!op||!targets.length||bulkRunning)return;
  if(!confirm(`Deseja ${labels[op]} ${targets.length} inscrição(ões) selecionada(s)?\n\nA ação será aplicada individualmente e pode levar alguns instantes. Apenas os registros que atenderem às regras do sistema serão alterados.`))return;
  bulkRunning=true;render();let completed=0,ok=0;const failures=[];const succeeded=[];
  const doOne=async r=>{
    if(['session_change_allow','session_change_block'].includes(op)){
      try{await rpc('laute_admin_allow_session_change',{p_id:r.id,p_allowed:op==='session_change_allow'});}catch(err){throw new Error(sessionChangeError(err));}
    } else if(op==='certificate'){
      if(activeCert(r.id))throw new Error('Certificado já ativo');
      if(r.status!=='confirmed'||!r.attended)throw new Error('Exige confirmação e presença registrada');
      if(!sessions.find(s=>s.id===r.session_id)?.completed)throw new Error('Turno ainda não marcado como realizado');
      await rpc('laute_issue_certificate',{p_id:r.id});
    } else {
      if(['cancelled','suspended','pending'].includes(op)&&activeCert(r.id))throw new Error('Revogue o certificado antes de alterar a situação');
      if(op==='attended')await rpc('laute_admin_set_attendance',{p_id:String(r.id),p_attended:true});
      else await rpc('laute_admin_update_session',{p_id:r.id,p_session_id:r.session_id,p_status:op,p_payment:r.payment_status,p_attended:r.attended,p_public_note:r.public_note||'',p_admin_note:r.admin_note||''});
    }
  };
  let cursor=0;
  const worker=async()=>{while(cursor<targets.length){const r=targets[cursor++];try{await doOne(r);ok++;succeeded.push(String(r.id));}catch(err){failures.push(`${r.full_name}: ${err.message}`);}finally{completed++;$('#bulk-progress').textContent=`Processadas ${completed} de ${targets.length} inscrições… (${ok} concluídas, ${failures.length} não alteradas)`;}}};
  try{await Promise.all(Array.from({length:Math.min(3,targets.length)},()=>worker()));for(const id of succeeded)selectedIds.delete(id);await refresh();
    const msg=`${ok} de ${targets.length} inscrição(ões) atualizada(s).${failures.length?' Não alteradas: '+failures.slice(0,5).join(' | ')+(failures.length>5?` | e outras ${failures.length-5}`:''):''}`;
    message($('#admin-message'),msg,failures.length?'info':'success');$('#bulk-progress').textContent=msg;
  }catch(err){message($('#admin-message'),`A operação terminou, mas houve erro ao atualizar a lista: ${err.message}`);}
  finally{bulkRunning=false;render();}
};
$('#toggle-registrations').onclick=async e=>{const b=e.currentTarget;busy(b,true);try{await rpc('laute_toggle_registrations',{p_enabled:!event.registrations_enabled});await refresh();message($('#admin-message'),event.registrations_enabled?'Recebimento ativado. As datas de abertura e encerramento continuam valendo.':'Recebimento de novas inscrições pausado.','success');}catch(err){message($('#admin-message'),err.message);}finally{busy(b,false);if(event)b.textContent=event.registrations_enabled?'Pausar inscrições':'Aceitar inscrições';}};
$('#search').oninput=render;$('#filter').onchange=render;$('#filter-session').onchange=render;
function openDetail(id){selected=rows.find(r=>String(r.id)===String(id));if(!selected)return;$('#detail-name').textContent=selected.full_name;$('#detail-meta').innerHTML=`<strong>${esc(selected.code)}</strong><br>${esc(selected.email)} · ${esc(selected.phone)}<br>${esc(selected.course)} · ${esc(selected.profile)} · ${esc(selected.semester)}<br>${esc(selected.institution)}<br>Inscrição: ${date(selected.created_at)} · Valor: ${money(selected.amount_due)}<br>Termos: ${esc(selected.terms_version)} · Aceite: ${date(selected.accepted_at)}`;for(const k of ['status','payment_status','public_note','admin_note'])detail.elements[k].value=selected[k]??'';detail.elements.full_name.value=selected.full_name;fillSessionOptions(detail.elements.session_id,sessions);detail.elements.session_id.value=selected.session_id;detail.elements.attended.checked=selected.attended;message($('#detail-error'),'');certButtons();renderAdminSessionChange({registration:selected,sessions,hasCertificate:!!activeCert(selected.id),isDirty:detailDirty,onUpdated:async id=>{await refresh();openDetail(id);}});if(!$('#detail').open)$('#detail').showModal();}
function detailDirty(){return ['full_name','session_id','status','payment_status','public_note','admin_note'].some(k=>detail.elements[k].value!==(selected[k]??''))||detail.elements.attended.checked!==!!selected.attended;}
$('#normalize-name').onclick=()=>{const particles=new Set(['de','da','do','das','dos','e']);detail.elements.full_name.value=detail.elements.full_name.value.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR').split(' ').map((w,i)=>i&&particles.has(w)?w:w.charAt(0).toLocaleUpperCase('pt-BR')+w.slice(1)).join(' ');detail.elements.full_name.focus();};
$('#close-detail').onclick=()=>$('#detail').close();
detail.onsubmit=async e=>{e.preventDefault();const b=$('button[type=submit]',detail);busy(b,true);message($('#detail-error'),'');try{
  const newName=detail.elements.full_name.value.trim().replace(/\s+/g,' '),nameChanged=newName!==selected.full_name;
  if(nameChanged&&activeCert(selected.id))throw new Error('Este participante já tem certificado ativo. Revogue-o antes de alterar o nome; depois, emita novamente o certificado.');
  if(nameChanged)await rpc('laute_admin_update_name',{p_id:String(selected.id),p_full_name:newName});
  const wantedAttendance=detail.elements.attended.checked;
  const otherChanged=detail.elements.session_id.value!==selected.session_id||detail.elements.status.value!==selected.status||detail.elements.payment_status.value!==selected.payment_status||detail.elements.public_note.value!==(selected.public_note||'')||detail.elements.admin_note.value!==(selected.admin_note||'');
  // A função administrativa original mantém as regras normais de status, turno e pagamento.
  // A presença agora é controlada por uma rotina administrativa separada, sem requisito de horário/status.
  if(otherChanged)await rpc('laute_admin_update_session',{p_id:selected.id,p_session_id:detail.elements.session_id.value,p_status:detail.elements.status.value,p_payment:detail.elements.payment_status.value,p_attended:false,p_public_note:detail.elements.public_note.value,p_admin_note:detail.elements.admin_note.value});
  if((otherChanged&&wantedAttendance)||(!otherChanged&&wantedAttendance!==!!selected.attended))await rpc('laute_admin_set_attendance',{p_id:String(selected.id),p_attended:wantedAttendance});
  const id=selected.id;await refresh();openDetail(id);message($('#detail-error'),'Inscrição e nome atualizados.','success');
}catch(err){message($('#detail-error'),err.message);}finally{busy(b,false);}};
function certButtons(){const c=activeCert(selected.id);$('#cert-actions').innerHTML=(c?'<button class="btn primary" id="download-certificate">Baixar certificado PDF</button><button class="btn secondary" id="revoke-certificate">Revogar certificado</button>':'<button class="btn primary" id="issue-certificate">Gerar e liberar certificado</button>')+'<button type="button" class="btn secondary" id="preview-certificate">Pré-visualizar PDF (teste)</button>';$('#cert-hint').textContent=c?'O participante já pode baixar o certificado na consulta. A prévia é apenas para conferência.':'Use a prévia para conferir o PDF sem emitir um certificado real. Para emitir e liberar um certificado válido, continuam necessárias confirmação, presença e conclusão do turno.';$('#preview-certificate')?.addEventListener('click',async e=>{const b=e.currentTarget;busy(b,true,'Gerando prévia…');try{const session=sessions.find(s=>s.id===detail.elements.session_id.value)||sessions.find(s=>s.id===selected.session_id);await certificatePDF({valid:true,preview:true,id:'00000000-0000-0000-0000-000000000000',full_name:detail.elements.full_name.value.trim()||selected.full_name,title:event.title,instructor:event.instructor,date:date(event.starts_at,{day:'numeric',month:'long',year:'numeric'}),hours:event.hours,session_label:session?.label||'',time:session?date(session.starts_at,{hour:'2-digit',minute:'2-digit'}):'',signer_name:event.signer_name||'Responsável',signer_role:event.signer_role||'Direção Científica',coordinator_name:event.coordinator_name||'LAUTE',coordinator_role:event.coordinator_role||'Coordenação'});message($('#detail-error'),'Prévia gerada. Não há certificado emitido nem presença registrada por esta ação.','success');}catch(err){message($('#detail-error'),err.message);}finally{busy(b,false);}});$('#issue-certificate')?.addEventListener('click',async e=>{const b=e.currentTarget;busy(b,true,'Emitindo…');try{const issued=await rpc('laute_issue_certificate',{p_id:selected.id});const id=selected.id;await refresh();openDetail(id);await certificatePDF(issued);message($('#detail-error'),'Certificado emitido e disponível para o participante.','success');}catch(err){message($('#detail-error'),err.message);}finally{if(b.isConnected)busy(b,false);}});$('#download-certificate')?.addEventListener('click',async e=>{const b=e.currentTarget;busy(b,true);try{await certificatePDF(await rpc('laute_verify_certificate',{p_id:c.id}));}catch(err){message($('#detail-error'),err.message);}finally{busy(b,false);}});$('#revoke-certificate')?.addEventListener('click',async e=>{if(!confirm('Revogar este certificado? A validação passará a informar que ele foi revogado. Você poderá emitir um novo após a correção.'))return;const b=e.currentTarget;busy(b,true);try{await rpc('laute_revoke_certificate',{p_id:c.id});const id=selected.id;await refresh();openDetail(id);message($('#detail-error'),'Certificado revogado.','success');}catch(err){message($('#detail-error'),err.message);}finally{if(b.isConnected)busy(b,false);}});}
const tabs=[$('#tab-regs'),$('#tab-settings')];function tab(i){tabs.forEach((b,k)=>{b.setAttribute('aria-selected',String(k===i));b.tabIndex=k===i?0:-1;$('#'+b.getAttribute('aria-controls')).hidden=k!==i;});}tabs.forEach((b,i)=>{b.onclick=()=>tab(i);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;tab(next);tabs[next].focus();}};});
function localDateTime(v){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(' ','T');}
function fillSettings(){for(const input of [...settings.elements]){if(!input.name)continue;if(input.type==='checkbox')input.checked=!!event[input.name];else if(input.type==='datetime-local')input.value=localDateTime(event[input.name]);else input.value=event[input.name]??'';}}
settings.onsubmit=async e=>{e.preventDefault();const b=$('button[type=submit]',settings);busy(b,true);message($('#settings-error'),'');try{const payload=Object.fromEntries(new FormData(settings));for(const k of ['starts_at','opens_at','closes_at','payment_deadline'])payload[k]=payload[k]+(['closes_at','payment_deadline'].includes(k)?':59-03:00':':00-03:00');for(const k of ['registrations_enabled'])payload[k]=settings.elements[k].checked;await rpc('laute_save_event',{payload});await refresh();message($('#settings-error'),'Configurações salvas.','success');}catch(err){message($('#settings-error'),err.message);}finally{busy(b,false);}};
export function csvCell(v){let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
$('#export').onclick=()=>{const header=['Código','Nome','E-mail','WhatsApp','Curso','Turno','Horário do turno','Vínculo','Instituição','Período','Situação','Pagamento','Valor R$','Presença','Certificado','Data inscrição','Mensagem ao participante','Observação interna','Troca de turno liberada','Última troca pelo participante'];const data=filtered().map(r=>[r.code,r.full_name,r.email,r.phone,r.course,sessions.find(s=>s.id===r.session_id)?.label||'',date(sessions.find(s=>s.id===r.session_id)?.starts_at||event.starts_at,{hour:'2-digit',minute:'2-digit'}),r.profile,r.institution,r.semester,statuses[r.status],payments[r.payment_status],Number(r.amount_due).toFixed(2).replace('.',','),r.attended?'Sim':'Não',activeCert(r.id)?.id||'',date(r.created_at),r.public_note,r.admin_note,r.session_change_allowed?'Sim':'Não',r.session_changed_at?date(r.session_changed_at)+' '+date(r.session_changed_at,{hour:'2-digit',minute:'2-digit'}):'']);download('\uFEFF'+[header,...data].map(row=>row.map(csvCell).join(';')).join('\r\n'),'LAUTE_Inscricoes_Sutura.csv','text/csv;charset=utf-8');};
if(!configured)message($('#login-error'),'Para ativar: configure o Supabase em config.js, execute o SQL e cadastre o administrador. O guia acompanha o projeto.','info');else{try{if(await requireAdmin())await enter();}catch(err){message($('#login-error'),err.message);}}

function renderSummary(){
  renderSessions($('#admin-session-board'),sessions);
  $('#stat-total').textContent=sessions.reduce((n,s)=>n+s.total,0);
  $('#stat-confirmed').textContent=sessions.reduce((n,s)=>n+s.confirmed,0);
  $('#stat-pending').textContent=sessions.reduce((n,s)=>n+s.pending,0);
  $('#admin-availability-updated').textContent=`Atualizado às ${date(new Date(),{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
}
async function refreshSummary(){
  if(loadingSummary||$('#dashboard').hidden||document.hidden)return;loadingSummary=true;
  try{sessions=await getSessions();renderSummary();message($('#admin-availability-error'),'');}
  catch{message($('#admin-availability-error'),'Não foi possível atualizar o demonstrativo. Os números exibidos são da última consulta.','info');}
  finally{loadingSummary=false;}
}
setInterval(refreshSummary,15000);
document.addEventListener('visibilitychange',refreshSummary);
function fillSessionSettings(){
  $('#sessions-settings').innerHTML=sessions.map(s=>`<fieldset data-edit-session="${esc(s.id)}"><legend>${esc(s.label)}</legend><label>Data e horário<input type="datetime-local" name="starts_at" value="${localDateTime(s.starts_at)}" required></label><label>Limite de vagas<input type="number" name="capacity" min="1" max="1000" step="1" value="${s.capacity}" required></label><label class="check"><input type="checkbox" name="registrations_enabled" ${s.registrations_enabled?'checked':''}><span>Aceitar inscrições neste turno</span></label><label class="check"><input type="checkbox" name="completed" ${s.completed?'checked':''}><span>Turno realizado — liberar certificados</span></label></fieldset>`).join('');
}
$('#sessions-form').onsubmit=async ev=>{
  ev.preventDefault();const b=$('button[type=submit]',ev.currentTarget);busy(b,true);message($('#sessions-error'),'');
  try{
    const payload=$$('[data-edit-session]').map(field=>({id:field.dataset.editSession,starts_at:$('[name=starts_at]',field).value+':00-03:00',capacity:Number($('[name=capacity]',field).value),registrations_enabled:$('[name=registrations_enabled]',field).checked,completed:$('[name=completed]',field).checked}));
    await rpc('laute_save_sessions',{payload});await refresh();message($('#sessions-error'),'Turnos atualizados.','success');
  }catch(err){message($('#sessions-error'),err.message);}finally{busy(b,false);}
};

// Registro fotográfico: imagens armazenadas no Supabase Storage e metadados na tabela pública com RLS.
function photoSrc(path){return db.storage.from(galleryBucket).getPublicUrl(path).data.publicUrl;}
async function loadAdminGallery(){
  const node=$('#gallery-admin-list');if(!node)return;
  const {data,error}=await db.from('laute_gallery_photos').select('id,event_title,event_date,image_path,caption,created_at').order('created_at',{ascending:false}).limit(200);
  if(error){node.innerHTML='<p class="small muted">A galeria ainda não foi ativada. Execute o arquivo SQL de atualização no Supabase.</p>';return;}
  galleryRows=data||[];
  node.innerHTML=galleryRows.length?galleryRows.map(item=>`<article class="gallery-admin-card"><img loading="lazy" alt="${esc(item.caption||item.event_title)}" src="${esc(photoSrc(item.image_path))}"><div><strong>${esc(item.event_title)}</strong><p class="small muted">${esc(item.caption||'Sem legenda')}</p><button type="button" class="btn secondary" data-delete-photo="${esc(item.id)}">Excluir foto</button></div></article>`).join(''):'<p class="small muted">Nenhuma foto publicada ainda.</p>';
  $$('[data-delete-photo]',node).forEach(btn=>btn.onclick=async()=>{if(!confirm('Excluir esta foto permanentemente da galeria?'))return;const item=galleryRows.find(r=>r.id===btn.dataset.deletePhoto);busy(btn,true,'Excluindo…');try{
    const {error}=await db.from('laute_gallery_photos').delete().eq('id',item.id);if(error)throw error;
    const result=await db.storage.from(galleryBucket).remove([item.image_path]);if(result.error)message($('#gallery-admin-message'),'Foto retirada da galeria, mas o arquivo não pôde ser excluído do armazenamento.','info');else message($('#gallery-admin-message'),'Foto excluída.','success');await loadAdminGallery();
  }catch(err){message($('#gallery-admin-message'),err.message);}finally{if(btn.isConnected)busy(btn,false);}});
}
$('#gallery-upload-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,files=[...form.elements.photos.files],caption=form.elements.caption.value.trim(),button=$('button[type=submit]',form);
  if(!files.length)return;
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)){message($('#gallery-admin-message'),'Escolha apenas JPG, PNG ou WebP com até 8 MB por foto.');return;}
  if(!confirm(`Publicar ${files.length} foto(s) na galeria pública? Confirme que todas possuem autorização de divulgação.`))return;
  busy(button,true,'Publicando…');message($('#gallery-admin-message'),'');let count=0;
  try{
    for(const file of files){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`sutura-2026/${crypto.randomUUID()}.${ext}`;
      const stored=await db.storage.from(galleryBucket).upload(path,file,{contentType:file.type,upsert:false});if(stored.error)throw new Error(stored.error.message);
      const added=await db.from('laute_gallery_photos').insert({event_id:event.id,event_title:event.title,event_date:new Date(event.starts_at).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),image_path:path,caption});
      if(added.error){await db.storage.from(galleryBucket).remove([path]);throw new Error(added.error.message);}count++;
    }
    form.reset();message($('#gallery-admin-message'),`${count} foto(s) publicada(s) na galeria.`, 'success');
  }catch(err){message($('#gallery-admin-message'),`${count} foto(s) publicada(s). Não foi possível concluir as demais: ${err.message}`);}finally{busy(button,false);await loadAdminGallery();}
};
