import { createClient } from '../assets/vendor/supabase.js';
export const $ = (q, root=document) => root.querySelector(q);
export const $$ = (q, root=document) => [...root.querySelectorAll(q)];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const date = (v, options={}) => new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',...options}).format(new Date(v));
export const statuses = {pending:'Aguardando confirmação',confirmed:'Confirmada',suspended:'Suspensa',cancelled:'Cancelada'};
export const payments = {pending:'Aguardando conferência',paid:'Pagamento conferido',waived:'Isento',refunded:'Reembolsado'};
export const allowedCourses = ['Enfermagem', 'Odontologia', 'Medicina', 'Medicina Veterinária', 'Estética e Cosmética', 'Perícia'];
export const defaults = {id:'sutura-2026',title:'Curso de Sutura',instructor:'Dr. Ulysses Moura',starts_at:'2026-10-15T08:00:00-03:00',opens_at:'2026-10-02T00:00:00-03:00',closes_at:'2026-10-13T23:59:59-03:00',payment_deadline:'2026-10-10T23:59:59-03:00',price:30,venue:'Laboratório da Estácio/Idomed Turu (Av. São Luís Rei de França, 19 - Turu, São Luís - MA)',hours:6,registrations_enabled:true,completed:false,contact_email:''};
const publicEventFields='id,title,instructor,starts_at,opens_at,closes_at,payment_deadline,price,venue,hours,registrations_enabled,completed,contact_email';
const cfg=window.LAUTE_CONFIG || {};
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl || '') && (cfg.supabaseAnonKey || '').length>30 && !String(cfg.supabaseAnonKey).startsWith('sb_secret_');
export const db = configured ? createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{storage:sessionStorage,storageKey:'laute-admin-session',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}) : null;
export async function rpc(name,args={}) {
  if(!db) throw new Error('O sistema de inscrições está em preparação. Tente novamente mais tarde.');
  const {data,error}=await db.rpc(name,args); if(error) throw new Error(error.message || 'Não foi possível concluir. Tente novamente.'); return data;
}
export async function getEvent() {
  if(!db) return {...defaults};
  const {data,error}=await db.from('laute_event').select('*').eq('id','sutura-2026').single();
  if(error) throw new Error('Não foi possível carregar as informações do curso. Atualize a página.');
  return data;
}
export async function getPublicEvent() {
  if(!db) return {...defaults};
  const {data,error}=await db.from('laute_event').select(publicEventFields).eq('id','sutura-2026').single();
  if(error) throw new Error('Não foi possível carregar as informações do curso. Atualize a página.');
  return data;
}
export async function getPaymentEvent() {
  if(!db) throw new Error('Os dados de pagamento ficam disponíveis somente após o registro da inscrição.');
  const {data,error}=await db.from('laute_event').select('id,title,payment_deadline,price,pix_key,pix_copy_paste,pix_recipient,contact_whatsapp,finance_contact,payment_instructions').eq('id','sutura-2026').single();
  if(error || !data?.pix_key) throw new Error('Não foi possível carregar os dados de pagamento. Consulte sua inscrição novamente ou fale com o suporte.');
  return data;
}
export function badge(status) {return `<span class="badge ${escapeHTML(status)}">${escapeHTML(statuses[status] || status)}</span>`;}
export function message(node,text,type='error') {if(!node)return; node.textContent=text; node.className=`message ${type}`; node.hidden=!text;}
export function download(content,name,type) {const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function copy(text,btn) {try {await navigator.clipboard.writeText(text);const label=btn.textContent;btn.textContent='Copiado!';setTimeout(()=>btn.textContent=label,2000);} catch {window.prompt('Copie o texto abaixo:',text);}}
export function busy(button,yes,label='Aguarde…') {if(yes){button.dataset.original=button.textContent;button.textContent=label;button.disabled=true;}else{button.textContent=button.dataset.original || button.textContent;button.disabled=false;}}
export function hydrate(e) {
  const heading=$('#course-title');if(heading){const words=e.title.replace(/\.$/,'').split(/\s+/),last=words.pop(),accent=document.createElement('em');accent.textContent=last+'.';heading.replaceChildren(document.createTextNode(words.join(' ')+' '),accent);}
  $$('[data-event]').forEach(el=>{const key=el.dataset.event;el.textContent=key==='price'?money(e.price):key==='shortDate'?date(e.starts_at,{day:'2-digit',month:'short'}).replace(' de ',' ').replace('.','').toUpperCase():key==='date'?date(e.starts_at,{day:'2-digit',month:'long',year:'numeric'}):key==='time'?date(e.starts_at,{hour:'2-digit',minute:'2-digit'}):key==='paymentDeadline'?date(e.payment_deadline,{day:'2-digit',month:'2-digit',year:'numeric'}):key==='period'?`${date(e.opens_at)} a ${date(e.closes_at)}`:e[key] ?? 'A confirmar';});
  $$('[data-contact]').forEach(el=>{if(e.contact_email){el.href=`mailto:${e.contact_email}`;el.textContent=e.contact_email;}else if(e.contact_whatsapp){el.href=`https://wa.me/${e.contact_whatsapp}`;el.textContent='Falar com a organização';}else{el.removeAttribute('href');el.textContent='Contato da organização em breve';}});
}
export function registrationWindow(e){const now=Date.now(); if(!e.registrations_enabled)return 'Inscrições pausadas pela organização';if(now<new Date(e.opens_at))return `Inscrições abrem em ${date(e.opens_at)}`;if(now>new Date(e.closes_at))return 'Inscrições encerradas';return 'Inscrições abertas';}
export function isOpen(e){return e.registrations_enabled && Date.now()>=new Date(e.opens_at).getTime() && Date.now()<=new Date(e.closes_at).getTime();}
export function paymentBlock(e,registration=null){
  const overdue=e.payment_deadline && Date.now()>new Date(e.payment_deadline).getTime();
  const whatsapp=String(e.contact_whatsapp||'').replace(/\D/g,'');
  const who=registration?` Meu nome é ${registration.full_name}. Inscrição: ${registration.code}.${registration.session_label?` Turno: ${registration.session_label}, às ${date(registration.session_starts_at,{hour:'2-digit',minute:'2-digit'})}.`:''}`:'';
  const text=overdue?`Olá! Gostaria de orientação sobre o pagamento do ${e.title}, pois o prazo informado terminou.${who}`:`Olá! Quero enviar o comprovante de pagamento do ${e.title}.${who} Valor: ${money(e.price)}.`;
  let qr='';
  if(e.pix_copy_paste&&window.qrcode){try{const code=window.qrcode(0,'M');code.addData(e.pix_copy_paste);code.make();qr=code.createSvgTag({cellSize:3,margin:12,scalable:true});}catch{}}
  return `<section class="payment-box" aria-label="Pagamento por Pix"><div class="payment-heading"><div><div class="eyebrow">PAGAMENTO POR PIX</div><h3>${money(e.price)}</h3></div>${e.payment_deadline?`<span class="payment-deadline">Pagamento até <strong>${date(e.payment_deadline,{day:'2-digit',month:'2-digit'})}</strong></span>`:''}</div><p>${escapeHTML(e.payment_instructions)}</p>${overdue?'<div class="message info">O prazo de pagamento terminou. Fale com a coordenação financeira antes de pagar.</div>':''}${e.pix_key?`<div class="pix-layout">${qr?`<div class="pix-qr" role="img" aria-label="QR Code Pix de ${escapeHTML(e.pix_recipient)}">${qr}</div>`:''}<div class="pix-details"><span class="eyebrow">CHAVE ALEATÓRIA</span><p class="pix-key">${escapeHTML(e.pix_key)}</p>${e.pix_recipient?`<p class="small">Favorecido<br><strong>${escapeHTML(e.pix_recipient)}</strong></p>`:''}<div class="button-row"><button type="button" class="btn secondary" data-copy-payment="pix_key">Copiar chave Pix</button>${e.pix_copy_paste?'<button type="button" class="btn secondary" data-copy-payment="pix_copy_paste">Copiar Pix copia e cola</button>':''}</div></div></div>`:''}${whatsapp?`<a class="btn whatsapp" data-payment-whatsapp href="https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener noreferrer">${overdue?'Falar com a coordenação financeira':'Enviar comprovante pelo WhatsApp'} <span aria-hidden="true">↗</span></a><p class="small">${escapeHTML(e.finance_contact||'Coordenação financeira')} · ${escapeHTML(whatsapp.length===13?`(${whatsapp.slice(2,4)}) ${whatsapp.slice(4,9)}-${whatsapp.slice(9)}`:whatsapp)}<br>Ao abrir a conversa, anexe o comprovante antes de enviar.</p>`:''}<p class="small muted">A confirmação depende da conferência pela organização. O envio do formulário não confirma automaticamente a vaga.</p></section>`;
}
export function bindPayment(root,e){$$('[data-copy-payment]',root).forEach(btn=>btn.addEventListener('click',()=>copy(e[btn.dataset.copyPayment],btn)));}

export function header(active=''){return `<a class="skip" href="#conteudo">Ir ao conteúdo</a><header class="header"><a class="brand" href="index.html"><img src="assets/laute-logo.jpeg" alt="Símbolo da LAUTE"><span><strong>LAUTE<span class="brand-dot">.</span></strong><small>ENSINO · PESQUISA · EXTENSÃO</small></span></a><nav aria-label="Menu principal"><a ${active==='register'?'aria-current="page"':''} href="index.html">Inscrição</a><a ${active==='lookup'?'aria-current="page"':''} href="consultar.html">Minha inscrição</a><a ${active==='gallery'?'aria-current="page"':''} href="galeria.html">Galeria</a><a ${active==='about'?'aria-current="page"':''} href="sobre.html">Sobre nós</a><a class="admin-link" href="admin.html" aria-label="Acessar painel administrativo">Painel da liga</a></nav></header>`;}
export function footer(){return `<footer class="footer"><div><strong>LAUTE</strong><p>Liga Acadêmica de Urgência, Trauma e Emergência<br>Faculdade Estácio · São Luís, MA</p></div><div><a href="privacidade.html">Privacidade e condições</a><a href="galeria.html">Galeria de fotos</a><a href="validar.html">Validar certificado</a><span>© 2026 LAUTE</span></div></footer>`;}
export function shell(active){$('#site-header').innerHTML=header(active);$('#site-footer').innerHTML=footer();}
