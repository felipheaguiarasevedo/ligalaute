import {$,$$,rpc,date,escapeHTML as esc} from './common.js?v=20261022-ps1';

export async function getSessions(){
  const data=await rpc('laute_session_availability');
  if(!Array.isArray(data)||data.length!==3)throw new Error('Não foi possível carregar os turnos. Tente novamente mais tarde.');
  return data;
}
export const sessionText=s=>s?`${s.label} · ${date(s.starts_at,{hour:'2-digit',minute:'2-digit'})}`:'Turno não informado';
export const registrationSession=r=>r?.session_label?`${r.session_label} · ${date(r.session_starts_at,{hour:'2-digit',minute:'2-digit'})}`:'';
export function renderSessions(node,sessions,{onSelect,selected='',open=true}={}){
  if(!node)return;
  node.innerHTML=sessions.map(s=>{
    const ended=s.completed||Date.now()>=new Date(s.starts_at).getTime();
    const disabled=!open||!s.registrations_enabled||ended||s.available<=0;
    const state=ended?'Turno encerrado':!s.registrations_enabled?'Inscrições pausadas':s.available<=0?'Turno lotado':`${s.available} vagas disponíveis`;
    return `<article class="session-card ${s.id===selected?'selected':''}" data-session-card="${esc(s.id)}"><div class="session-top"><span class="eyebrow">${esc(s.label)}</span><span class="session-dot ${disabled?'unavailable':''}" aria-hidden="true"></span></div><h3>${date(s.starts_at,{hour:'2-digit',minute:'2-digit'})}<small>${date(s.starts_at,{day:'2-digit',month:'2-digit'})}</small></h3><div class="session-confirmed"><strong>${s.confirmed}</strong><span> / ${s.capacity} confirmadas</span></div><progress max="${s.capacity}" value="${Math.min(s.confirmed,s.capacity)}" aria-label="${esc(s.label)}: ${s.confirmed} inscrições confirmadas de ${s.capacity}"></progress><p class="session-pending">${s.pending} em análise</p><p class="session-available">${esc(state)}</p>${onSelect?`<button type="button" class="btn secondary" data-choose-session="${esc(s.id)}" ${disabled?'disabled':''}>${s.id===selected?'Turno selecionado':'Escolher '+esc(s.label.toLowerCase())}</button>`:''}</article>`;
  }).join('');
  if(onSelect)$$('[data-choose-session]',node).forEach(btn=>btn.onclick=()=>onSelect(btn.dataset.chooseSession));
}
export function fillSessionOptions(select,sessions,{publicForm=false}={}){
  const previous=select.value;
  for(const s of sessions){
    let option=[...select.options].find(o=>o.value===s.id);
    if(!option){option=document.createElement('option');option.value=s.id;select.append(option);}
    option.textContent=sessionText(s)+(publicForm?` · ${s.available} vagas disponíveis`:'');
    option.disabled=publicForm&&(!s.registrations_enabled||s.completed||s.available<=0||Date.now()>=new Date(s.starts_at).getTime());
  }
  select.value=previous;
}
