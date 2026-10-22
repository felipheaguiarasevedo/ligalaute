import {shell,icon,SITE_VERSION} from './site-shell.js?v=20261022-ps1';
import {photos as suppliedPhotos} from './media-data.js?v=20261022-ps1';
import {filterPhotos,nextPhotoIndex,safeGalleryURL} from './site-logic.js?v=20261022-ps1';

shell(document.body.dataset.page||'');
document.querySelectorAll('[data-icon]').forEach(node=>{node.outerHTML=icon(node.dataset.icon);});

// Os filtros não dependem de conta, cookies ou chamadas ao banco de dados.
const courseFilters=[...document.querySelectorAll('[data-course-filter]')];
for(const button of courseFilters)button.addEventListener('click',()=>{
  const selected=button.dataset.courseFilter;let visible=0;
  for(const filter of courseFilters)filter.setAttribute('aria-pressed',String(filter===button));
  for(const card of document.querySelectorAll('[data-course-status]')) {
    card.hidden=selected!=='all'&&card.dataset.courseStatus!==selected;
    if(!card.hidden)visible++;
  }
  const empty=document.querySelector('#s-courses-empty');if(empty)empty.hidden=visible>0;
});

if(document.body.dataset.page==='gallery')initGallery();

function initGallery() {
  const grid=document.querySelector('#public-gallery');
  if(!grid)return;
  const filters=[...document.querySelectorAll('[data-photo-filter]')], count=document.querySelector('#s-gallery-count');
  const dialog=document.querySelector('#s-lightbox'), image=document.querySelector('#s-lightbox-image');
  const caption=document.querySelector('#s-lightbox-caption'),counter=document.querySelector('#s-lightbox-counter');
  let allPhotos=[...suppliedPhotos], category='all', visible=filterPhotos(allPhotos),currentId=null,returnFocus=null;

  function render() {
    visible=filterPhotos(allPhotos,category);
    grid.replaceChildren();
    for(const [i,photo] of visible.entries()) {
      const figure=document.createElement('figure');figure.className='s-photo';
      const button=document.createElement('button');button.type='button';button.dataset.photo=photo.id;
      button.setAttribute('aria-label',`Ampliar foto: ${photo.alt}`);
      const thumb=document.createElement('img');thumb.src=photo.src;thumb.alt=photo.alt;thumb.loading=i===0?'eager':'lazy';thumb.decoding='async';
      thumb.width=photo.width||1200;thumb.height=photo.height||1600;
      const hint=document.createElement('span');hint.innerHTML=icon('external');hint.setAttribute('aria-hidden','true');
      button.append(thumb,hint.firstElementChild);button.addEventListener('click',()=>openPhoto(photo.id,button));
      const text=document.createElement('figcaption');text.textContent=photo.caption;
      figure.append(button,text);grid.append(figure);
    }
    count.textContent=`${visible.length} ${visible.length===1?'registro':'registros'}${category==='all'?' no acervo':' nesta seleção'}`;
  }
  function showPhoto(id) {
    const photo=visible.find(item=>item.id===id);if(!photo)return;
    currentId=photo.id;image.src=photo.src;image.alt=photo.alt;
    caption.textContent=photo.caption;counter.textContent=`${visible.indexOf(photo)+1} / ${visible.length}`;
    document.querySelector('#s-lightbox-title').textContent=photo.eventTitle||'Curso de Sutura · LAUTE';
    const url=new URL(location.href);url.hash=photo.id;history.replaceState(null,'',url);
  }
  function openPhoto(id,trigger=null) {
    returnFocus=trigger;
    if(typeof dialog.showModal!=='function') {const p=visible.find(item=>item.id===id);if(p)window.open(p.src,'_blank','noopener,noreferrer');return;}
    showPhoto(id);if(!dialog.open)dialog.showModal();document.body.classList.add('s-dialog-open');
  }
  function movePhoto(change) {
    const index=visible.findIndex(item=>item.id===currentId);
    const next=nextPhotoIndex(index,change,visible.length);if(next>=0)showPhoto(visible[next].id);
  }
  function closePhoto() {if(dialog.open)dialog.close();}
  dialog.querySelector('.s-lightbox-close').addEventListener('click',closePhoto);
  dialog.querySelector('.s-lightbox-prev').addEventListener('click',()=>movePhoto(-1));
  dialog.querySelector('.s-lightbox-next').addEventListener('click',()=>movePhoto(1));
  dialog.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'){e.preventDefault();movePhoto(-1);}
    if(e.key==='ArrowRight'){e.preventDefault();movePhoto(1);}
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closePhoto();}});
  dialog.addEventListener('close',()=>{
    document.body.classList.remove('s-dialog-open');
    const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    currentId=null;
  });
  let touchStart=null;
  image.addEventListener('touchstart',e=>{touchStart=e.touches.length===1?[e.touches[0].clientX,e.touches[0].clientY]:null;},{passive:true});
  image.addEventListener('touchend',e=>{if(!touchStart||e.changedTouches.length!==1)return;const dx=e.changedTouches[0].clientX-touchStart[0],dy=e.changedTouches[0].clientY-touchStart[1];if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)movePhoto(dx<0?1:-1);touchStart=null;},{passive:true});
  for(const button of filters)button.addEventListener('click',()=>{
    if(dialog.open)dialog.close();category=button.dataset.photoFilter;
    for(const filter of filters)filter.setAttribute('aria-pressed',String(filter===button));render();
  });
  render();
  let target='';try{target=decodeURIComponent(location.hash.slice(1));}catch{}
  if(visible.some(photo=>photo.id===target))openPhoto(target);

  // Conserve o acervo publicado pelo painel, sem exigir nova tabela ou migração.
  // As fotos enviadas para esta atualização aparecem mesmo se o banco estiver indisponível.
  loadPublishedPhotos().then(items=>{
    if(!items.length)return;
    allPhotos.push(...items);filters.find(button=>button.dataset.photoFilter==='acervo').hidden=false;
    render();if(dialog.open&&currentId)showPhoto(currentId);
  }).catch(()=>{
    const feedback=document.querySelector('#s-gallery-feedback');
    feedback.textContent='As fotos desta edição estão disponíveis acima. O acervo complementar está temporariamente indisponível.';feedback.hidden=false;
  });
}

async function loadPublishedPhotos() {
  const cfg=window.LAUTE_CONFIG||{};if(!cfg.supabaseUrl)return [];
  const {db}=await import(`./common.js?v=${SITE_VERSION}`);if(!db)return [];
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const {data,error}=await db.from('laute_gallery_photos').select('id,event_title,event_date,image_path,caption').order('event_date',{ascending:false}).order('created_at',{ascending:false}).limit(250).abortSignal(controller.signal);
    if(error)throw error;
    const host=new URL(cfg.supabaseUrl).hostname;
    return (data||[]).map(photo=>{
      const src=safeGalleryURL(db.storage.from('laute-gallery').getPublicUrl(photo.image_path).data.publicUrl,host);
      if(!src)return null;
      return {id:`acervo-${photo.id}`,src,category:'acervo',eventTitle:photo.event_title||'Acervo da LAUTE',caption:photo.caption||photo.event_title||'Registro da LAUTE',alt:photo.caption||`Registro da atividade ${photo.event_title||'LAUTE'}`};
    }).filter(Boolean);
  }finally{clearTimeout(timer);}
}
