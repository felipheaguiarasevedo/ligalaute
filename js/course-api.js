import {db,rpc} from './common.js?v=20261022-ps1';
import {FIRST_AID_ID} from './first-aid-data.js?v=20261022-ps1';
export const activationFile='supabase/ATIVAR_MULTICURSOS_PRIMEIROS_SOCORROS.sql';
export function migrationMissing(error){return /PGRST202|42883/.test(error?.code||'')||/could not find.*function|function .*does not exist|schema cache/i.test(error?.message||'');}
export async function platformStatus(){
  if(!db)return {ready:false,missing:true};
  try{const status=await rpc('laute_platform_status');return {ready:!!status?.first_aid_ready,nameLookup:!!status?.name_lookup,missing:false};}
  catch(error){return {ready:false,missing:migrationMissing(error),error};}
}
export async function firstAidAvailability(){
  const [event,sessions]=await Promise.all([rpc('laute_course_public',{p_course_id:FIRST_AID_ID}),rpc('laute_course_availability',{p_course_id:FIRST_AID_ID})]);
  if(!event||!Array.isArray(sessions)||sessions.length!==3)throw new Error('A organização está finalizando a configuração das inscrições.');
  return {event,sessions};
}
export const nameCredentials=(courseId,name,email)=>({p_course_id:courseId,p_full_name:name,p_email:email});
export async function verifyAnyCertificate(id){
  // Primeiro mantém o emissor original; um UUID não encontrado pode pertencer ao módulo novo.
  let original=null;
  try{original=await rpc('laute_verify_certificate',{p_id:id});}catch{}
  if(original)return original;
  try{return await rpc('laute_verify_course_certificate',{p_id:id});}
  catch(error){if(migrationMissing(error))throw new Error('Certificado não encontrado. Confira o código de autenticidade.');throw error;}
}
