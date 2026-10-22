export const FIRST_AID_ID='primeiros-socorros-2026';
export const FIRST_AID={id:FIRST_AID_ID,title:'Curso de Primeiros Socorros — PCR e OVACE',starts_at:'2026-11-19T08:00:00-03:00',opens_at:'2026-10-22T00:00:00-03:00',closes_at:'2026-11-18T23:59:59-03:00',price:25,hours:6,venue:'Estácio Turu — espaço a divulgar',instructor:null,registrations_enabled:true,completed:false,support_name:'Alice · 1ª Secretária',support_whatsapp:'5598991100569'};
export const FIRST_AID_SESSIONS=[
  {id:'ps-2026-manha',course_id:FIRST_AID_ID,label:'Manhã',starts_at:'2026-11-19T08:00:00-03:00',ends_at:'2026-11-19T12:00:00-03:00',capacity:60},
  {id:'ps-2026-tarde',course_id:FIRST_AID_ID,label:'Tarde',starts_at:'2026-11-19T14:00:00-03:00',ends_at:'2026-11-19T18:00:00-03:00',capacity:60},
  {id:'ps-2026-noite',course_id:FIRST_AID_ID,label:'Noite',starts_at:'2026-11-19T18:30:00-03:00',ends_at:'2026-11-19T21:30:00-03:00',capacity:60}
];
export function coursePhase(course,now=Date.now()){
  if(course.completed||now>new Date(course.closes_at).getTime())return 'closed';
  if(now<new Date(course.opens_at).getTime())return 'scheduled';
  if(!course.registrations_enabled)return 'paused';
  return 'open';
}
export const fullName=value=>String(value||'').trim().replace(/\s+/g,' ');
export const validFullName=value=>{const name=fullName(value);return name.length>=5&&name.length<=140&&/\S+\s+\S+/.test(name);};
export function supportLink(name='',course=FIRST_AID){return `https://wa.me/${course.support_whatsapp}?text=${encodeURIComponent(`Olá, Alice! Preciso de suporte com minha participação no ${course.title}.${name?' Meu nome é '+fullName(name)+'.':''}`)}`;}
export function csvCell(value){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
