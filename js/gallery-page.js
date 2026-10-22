import { $, shell, db, escapeHTML as esc, message } from './common.js?v=20261022-ps1';
shell('gallery');
const node=$('#public-gallery');
try {
  if(!db)throw new Error('Não foi possível carregar a galeria neste momento.');
  const {data,error}=await db.from('laute_gallery_photos').select('id,event_title,event_date,image_path,caption').order('event_date',{ascending:false}).order('created_at',{ascending:false}).limit(250);
  if(error)throw new Error('A galeria ainda não está disponível. Consulte novamente em breve.');
  const photos=data||[];
  if(!photos.length)node.innerHTML='<div class="panel gallery-empty"><h2>Os registros chegarão em breve.</h2><p>Depois dos cursos, nossa equipe publicará aqui as fotos autorizadas das atividades realizadas.</p></div>';
  else{
    const groups=new Map();for(const photo of photos){const key=`${photo.event_title} · ${photo.event_date}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(photo);}
    node.innerHTML=[...groups].map(([key,items])=>`<section class="gallery-group"><h2>${esc(items[0].event_title)}</h2><p class="small muted">${esc(items[0].event_date.split('-').reverse().join('/'))}</p><div class="gallery-grid">${items.map(item=>`<figure class="photo-card"><a href="${esc(db.storage.from('laute-gallery').getPublicUrl(item.image_path).data.publicUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir foto em tamanho maior"><img loading="lazy" src="${esc(db.storage.from('laute-gallery').getPublicUrl(item.image_path).data.publicUrl)}" alt="${esc(item.caption||'Registro fotográfico do curso')}"></a>${item.caption?`<figcaption>${esc(item.caption)}</figcaption>`:''}</figure>`).join('')}</div></section>`).join('');
  }
}catch(err){message($('#gallery-error'),err.message,'info');}finally{$('#gallery-loading').hidden=true;}
