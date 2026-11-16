-- LAUTE · remarcação do Curso de Primeiros Socorros (PCR e OVACE).
-- Execute TODO o arquivo no SQL Editor do mesmo projeto Supabase usado pelo site.
-- Preserva todas as inscrições e as concentra no único turno matutino.
begin;

do $$ begin
  if to_regclass('public.laute_courses') is null
     or to_regclass('public.laute_course_sessions') is null
     or to_regclass('public.laute_course_registrations') is null then
    raise exception 'O módulo multicursos ainda não foi ativado neste projeto Supabase.';
  end if;
end $$;

alter table public.laute_courses add column if not exists participant_notice text not null default '';

-- Primeiro concentra as inscrições; só depois os turnos antigos são removidos.
update public.laute_course_registrations
set session_id='ps-2026-manha',
    session_change_allowed=false,
    session_change_allowed_at=null,
    session_changed_from=case when session_id<>'ps-2026-manha' then session_id else session_changed_from end,
    session_changed_at=case when session_id<>'ps-2026-manha' then clock_timestamp() else session_changed_at end,
    updated_at=clock_timestamp()
where course_id='primeiros-socorros-2026' and session_id<>'ps-2026-manha';

update public.laute_course_sessions
set label='Matutino',
    starts_at='2026-12-05 08:00:00-03',
    ends_at='2026-12-05 12:00:00-03',
    capacity=60,
    registrations_enabled=true,
    completed=false
where id='ps-2026-manha' and course_id='primeiros-socorros-2026';

delete from public.laute_course_sessions
where course_id='primeiros-socorros-2026' and id in ('ps-2026-tarde','ps-2026-noite');

update public.laute_courses
set starts_at='2026-12-05 08:00:00-03',
    participant_notice=$notice$
COMUNICADO IMPORTANTE — ALTERAÇÃO DE DATA E TURNO

O Curso de Primeiros Socorros (PCR e OVACE) foi adiado para 05 de dezembro de 2026 (sábado). A atividade acontecerá em um único turno, pela manhã, das 8h às 12h. Sua inscrição foi automaticamente transferida para o turno matutino. Não é necessário realizar uma nova inscrição.

Em caso de impossibilidade de participação ou dúvida, entre em contato com Alice, pelo WhatsApp (98) 99110-0569. O local exato dentro dos espaços da Estácio Turu será divulgado pela organização.$notice$,
    updated_at=clock_timestamp()
where id='primeiros-socorros-2026';

create or replace function public.laute_platform_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('version','2026.11.single_shift.1','name_lookup',true,
    'first_aid_ready',exists(select 1 from public.laute_courses where id='primeiros-socorros-2026'));
$$;

create or replace function public.laute_course_public(p_course_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',c.id,'title',c.title,'starts_at',c.starts_at,'opens_at',c.opens_at,'closes_at',c.closes_at,
    'price',c.price,'hours',c.hours,'venue',c.venue,'instructor',c.instructor,'completed',c.completed,
    'participant_notice',c.participant_notice,'registrations_enabled',c.registrations_enabled,
    'support_name',c.support_name,'support_whatsapp',c.support_whatsapp)
  from public.laute_courses c where c.id=p_course_id;
$$;

create or replace function public.laute_course_registration_view(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',r.id,'course_id',r.course_id,'event_id',r.course_id,'source','multicourse',
    'full_name',r.full_name,'title',c.title,'status',r.status,'payment_status',r.payment_status,'amount_due',r.amount_due,
    'session_id',r.session_id,'session_label',s.label,'session_starts_at',s.starts_at,'session_ends_at',s.ends_at,
    'attended',r.attended,'created_at',r.created_at,'public_note',r.public_note,'participant_notice',c.participant_notice,
    'certificate_id',(select x.id from public.laute_course_certificates x where x.registration_id=r.id and x.revoked_at is null limit 1))
  from public.laute_course_registrations r join public.laute_courses c on c.id=r.course_id
    join public.laute_course_sessions s on s.id=r.session_id where r.id=p_id;
$$;

create or replace function public.laute_course_admin_save_sessions(p_course_id text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; s public.laute_course_sessions%rowtype; cap integer; start_time timestamptz; end_time timestamptz;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.';end if;
  perform 1 from public.laute_courses where id=p_course_id for update;
  if not found or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload) not between 1 and 3 then raise exception 'Informe ao menos um turno deste curso.';end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(payload) x)<>jsonb_array_length(payload) then raise exception 'Não repita turnos.';end if;
  for item in select * from jsonb_array_elements(payload) loop
    select * into s from public.laute_course_sessions where id=item->>'id' and course_id=p_course_id;
    if not found then raise exception 'Turno inválido para este curso.';end if;
    cap:=(item->>'capacity')::integer;start_time:=(item->>'starts_at')::timestamptz;end_time:=(item->>'ends_at')::timestamptz;
    if cap is null or cap not between 1 and 1000 or end_time is null or start_time is null or end_time<=start_time then raise exception 'Confira horários e capacidade de cada turno.';end if;
    if cap<(select count(*) from public.laute_course_registrations where session_id=s.id and status in ('pending','confirmed')) then raise exception 'A capacidade não pode ser menor que as vagas já ocupadas.';end if;
    update public.laute_course_sessions set starts_at=start_time,ends_at=end_time,capacity=cap,
      completed=coalesce((item->>'completed')::boolean,s.completed),registrations_enabled=coalesce((item->>'registrations_enabled')::boolean,s.registrations_enabled) where id=s.id;
  end loop;
  update public.laute_courses set starts_at=(select min(starts_at) from public.laute_course_sessions where course_id=p_course_id),updated_at=clock_timestamp() where id=p_course_id;
  insert into public.laute_course_audit(actor,action,course_id) values(auth.uid(),'sessions_updated',p_course_id);
  return jsonb_build_object('saved',true);
end $$;

notify pgrst,'reload schema';
commit;
