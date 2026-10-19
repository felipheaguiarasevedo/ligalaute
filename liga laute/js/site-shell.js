export const SITE_VERSION = '20261019-1';
export const instagram = 'https://www.instagram.com/liga.laute_/';
export const support = 'https://wa.me/5598984035387?text=' + encodeURIComponent('Olá, LAUTE! Preciso de suporte com minha inscrição ou certificado.');
const drawings = {
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external:'<path d="M7 17 17 7M7 7h10v10"/>',
  book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
  research:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M8 10.5h5m-2.5-2.5v5"/>',
  people:'<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M4 8a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M2 21v-2a4 4 0 0 1 2-3m18 5v-2a4 4 0 0 0-2-3"/>',
  award:'<circle cx="12" cy="9" r="6"/><path d="m8 14-1 7 5-3 5 3-1-7"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m4 0h2"/>',
  instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 10h8m-8 4h5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  pulse:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
};
export function icon(name, cls='') { return `<svg class="s-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name] || drawings.arrow}</svg>`; }

export function header(active='') {
  const current = active==='register' ? 'courses' : active==='lookup' || active==='verify' ? 'certificates' : active;
  const items=[['home','index.html','Início'],['about','sobre.html','A liga'],['courses','cursos.html','Cursos e eventos'],['gallery','galeria.html','Galeria'],['contact','contato.html','Contato']];
  return `<a class="s-skip" href="#conteudo">Pular para o conteúdo</a>
    <div class="s-topbar"><div class="s-container"><span>Liga Acadêmica de Urgência, Trauma e Emergência</span><a href="${instagram}" target="_blank" rel="noopener noreferrer">${icon('instagram')}<span>@liga.laute_</span>${icon('external')}</a></div></div>
    <header class="s-header"><div class="s-container s-header-inner">
      <a class="s-brand" href="index.html" aria-label="LAUTE — página inicial"><img src="assets/laute-logo.jpeg" width="76" height="64" alt="Logotipo da LAUTE"><span><strong>LAUTE<span>.</span></strong><small>ENSINO · PESQUISA · EXTENSÃO</small></span></a>
      <button class="s-menu-toggle" id="s-menu-toggle" type="button" aria-controls="s-navigation" aria-expanded="false" aria-label="Abrir menu"><span></span><span></span><span></span></button>
      <nav class="s-nav" id="s-navigation" aria-label="Navegação principal">${items.map(([key,url,label])=>`<a href="${url}"${current===key?' aria-current="page"':''}>${label}</a>`).join('')}<a class="s-nav-portal" href="consultar.html"${current==='certificates'?' aria-current="page"':''}>Área do participante ${icon('external')}</a></nav>
    </div></header>`;
}

export function footer() {
  return `<footer class="s-footer"><div class="s-container">
    <div class="s-footer-main"><div class="s-footer-brand"><a href="index.html" class="s-footer-wordmark" aria-label="LAUTE — início">LAUTE<span>.</span></a><p>Conhecimento que prepara.<br>Cuidado que transforma.</p><small>Liga Acadêmica de Urgência,<br>Trauma e Emergência<br>Estácio · São Luís, Maranhão</small></div>
    <div><h2>Explore a liga</h2><a href="sobre.html">Quem somos</a><a href="sobre.html#pilares">Ensino, pesquisa e extensão</a><a href="cursos.html">Cursos e eventos</a><a href="galeria.html">Nossos registros</a></div>
    <div><h2>Seu espaço</h2><a href="consultar.html">Minha inscrição</a><a href="certificados.html">Certificados</a><a href="validar.html">Validar certificado</a><a href="admin.html">Painel da liga ${icon('external')}</a></div>
    <div><h2>Vamos conversar</h2><a href="${instagram}" target="_blank" rel="noopener noreferrer">${icon('instagram')} @liga.laute_</a><a href="${support}" target="_blank" rel="noopener noreferrer">${icon('message')} Suporte ao participante</a><a href="contato.html">Canais e localização</a><p class="s-footer-location">São Luís · Maranhão · Brasil</p></div></div>
    <div class="s-footer-bottom"><span>© ${new Date().getFullYear()} LAUTE. Todos os direitos reservados.</span><a href="privacidade.html">Privacidade e condições</a><span>Feito para conectar conhecimento e cuidado.</span></div>
  </div></footer>`;
}

export function initNavigation() {
  const toggle=document.querySelector('#s-menu-toggle'), nav=document.querySelector('#s-navigation');
  if(!toggle||!nav||toggle.dataset.bound)return;
  toggle.dataset.bound='true';
  const close=()=>{toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menu');nav.classList.remove('is-open');};
  toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');nav.classList.toggle('is-open',open);});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){close();toggle.focus();}});
  document.addEventListener('click',e=>{if(!e.target.closest('.s-header'))close();});
  matchMedia('(min-width: 1081px)').addEventListener('change',e=>{if(e.matches)close();});
}

export function shell(active='') {
  if(!document.querySelector('link[data-official-style]')) {
    const link=document.createElement('link');link.rel='stylesheet';link.href=`site.css?v=${SITE_VERSION}`;link.dataset.officialStyle='true';document.head.append(link);
  }
  const top=document.querySelector('#site-header'),bottom=document.querySelector('#site-footer');
  if(top)top.innerHTML=header(active);
  if(bottom)bottom.innerHTML=footer();
  initNavigation();
}
