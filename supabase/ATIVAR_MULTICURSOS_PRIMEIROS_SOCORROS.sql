-- LAUTE · segundo curso e consulta por nome completo + e-mail.
-- Execute TODO o arquivo no SQL Editor do MESMO projeto usado em config.js.
-- Atualização aditiva e repetível: NÃO apaga nem recria dados de sutura.
-- O módulo novo usa tabelas próprias; as funções e os certificados antigos são preservados.
begin;

do $$ begin
  if to_regclass('public.laute_event') is null or to_regclass('public.laute_registrations') is null
     or to_regprocedure('public.laute_is_admin()') is null
     or to_regprocedure('public.laute_lookup(text,text)') is null then
    raise exception 'Use o projeto Supabase LAUTE já instalado. Não execute este arquivo em outro banco.';
  end if;
end $$;

create table if not exists public.laute_courses (
  id text primary key,
  title text not null check(length(title) between 3 and 140),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  starts_at timestamptz not null,
  price numeric(10,2) not null check(price between 0 and 10000),
  hours numeric(6,2) not null check(hours>0 and hours<=200),
  venue text not null,
  instructor text,
  registrations_enabled boolean not null default true,
  completed boolean not null default false,
  support_name text not null,
  support_whatsapp text not null,
  payment_deadline timestamptz,
  pix_key text,
  pix_copy_paste text,
  pix_recipient text,
  contact_whatsapp text,
  finance_contact text,
  payment_instructions text,
  signer_name text,
  signer_role text,
  coordinator_name text,
  coordinator_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(opens_at<closes_at and closes_at<starts_at)
);
create table if not exists public.laute_course_sessions (
  id text primary key,
  course_id text not null references public.laute_courses(id),
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check(capacity between 1 and 1000),
  registrations_enabled boolean not null default true,
  completed boolean not null default false,
  check(ends_at>starts_at),
  unique(id,course_id)
);
create table if not exists public.laute_course_registrations (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.laute_courses(id),
  session_id text not null,
  request_id uuid not null unique,
  full_name text not null check(length(full_name) between 5 and 140),
  email text not null check(length(email) between 5 and 200),
  phone text not null check(length(phone) between 10 and 13),
  status text not null default 'pending' check(status in ('pending','confirmed','suspended','cancelled')),
  payment_status text not null default 'pending' check(payment_status in ('pending','paid','waived','refunded')),
  amount_due numeric(10,2) not null check(amount_due>=0),
  attended boolean not null default false,
  public_note text not null default '',
  admin_note text not null default '',
  terms_version text not null default 'primeiros-socorros-2026-v1',
  accepted_at timestamptz not null default now(),
  session_change_allowed boolean not null default false,
  session_change_allowed_at timestamptz,
  session_changed_at timestamptz,
  session_changed_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,email),
  foreign key(session_id,course_id) references public.laute_course_sessions(id,course_id)
);
create index if not exists laute_course_active_seats on public.laute_course_registrations(course_id,session_id,status);
create table if not exists public.laute_course_certificates (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.laute_course_registrations(id),
  course_id text not null references public.laute_courses(id),
  snapshot jsonb not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists laute_one_active_course_certificate on public.laute_course_certificates(registration_id) where revoked_at is null;
create table if not exists public.laute_course_audit (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  course_id text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.laute_course_session_changes (
  request_id uuid primary key,
  registration_id uuid not null references public.laute_course_registrations(id),
  from_session_id text not null,
  to_session_id text not null,
  changed_at timestamptz not null default now()
);

-- As rotinas abaixo são as únicas portas públicas. Não há lista pública de inscritos.
alter table public.laute_courses enable row level security;
alter table public.laute_course_sessions enable row level security;
alter table public.laute_course_registrations enable row level security;
alter table public.laute_course_certificates enable row level security;
alter table public.laute_course_audit enable row level security;
alter table public.laute_course_session_changes enable row level security;
revoke all on public.laute_courses,public.laute_course_sessions,public.laute_course_registrations,
  public.laute_course_certificates,public.laute_course_audit,public.laute_course_session_changes from public,anon,authenticated;
grant select on public.laute_courses,public.laute_course_sessions,public.laute_course_registrations,
  public.laute_course_certificates,public.laute_course_audit,public.laute_course_session_changes to authenticated;
do $$ declare t text; begin
  foreach t in array array['laute_courses','laute_course_sessions','laute_course_registrations','laute_course_certificates','laute_course_audit','laute_course_session_changes'] loop
    execute format('drop policy if exists laute_course_admin_read on public.%I',t);
    execute format('create policy laute_course_admin_read on public.%I for select to authenticated using (coalesce(public.laute_is_admin(),false))',t);
  end loop;
end $$;

-- Apenas o financeiro é reaproveitado. Não copia prazo vencido, ministrante ou assinaturas de sutura.
insert into public.laute_courses(id,title,opens_at,closes_at,starts_at,price,hours,venue,support_name,support_whatsapp,
  pix_key,pix_copy_paste,pix_recipient,contact_whatsapp,finance_contact,payment_instructions)
select 'primeiros-socorros-2026','Curso de Primeiros Socorros — PCR e OVACE',
  '2026-10-22 00:00:00-03','2026-11-18 23:59:59-03','2026-11-19 08:00:00-03',25,6,
  'Estácio Turu — espaço a divulgar','Alice · 1ª Secretária','5598991100569',
  to_jsonb(e)->>'pix_key',null,to_jsonb(e)->>'pix_recipient',to_jsonb(e)->>'contact_whatsapp',
  to_jsonb(e)->>'finance_contact',
  'Realize o pagamento após concluir a inscrição e envie o comprovante para a coordenação financeira. A vaga depende da conferência pela organização.'
from public.laute_event e where e.id='sutura-2026'
on conflict(id) do nothing;
-- O código Pix copia-e-cola antigo não é copiado: ele pode conter o valor de R$ 30,00.
insert into public.laute_course_sessions(id,course_id,label,starts_at,ends_at,capacity) values
('ps-2026-manha','primeiros-socorros-2026','Manhã','2026-11-19 08:00:00-03','2026-11-19 12:00:00-03',60),
('ps-2026-tarde','primeiros-socorros-2026','Tarde','2026-11-19 14:00:00-03','2026-11-19 18:00:00-03',60),
('ps-2026-noite','primeiros-socorros-2026','Noite','2026-11-19 18:30:00-03','2026-11-19 21:30:00-03',60)
on conflict(id) do nothing;

create or replace function public.laute_normalize_name(p_name text) returns text
language sql immutable set search_path='' as $$
  select lower(regexp_replace(btrim(coalesce(p_name,'')),'\s+',' ','g'));
$$;
create or replace function public.laute_platform_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('version','2026.10.multicurso.1','name_lookup',true,
    'first_aid_ready',exists(select 1 from public.laute_courses where id='primeiros-socorros-2026'));
$$;
create or replace function public.laute_course_public(p_course_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',c.id,'title',c.title,'starts_at',c.starts_at,'opens_at',c.opens_at,'closes_at',c.closes_at,
    'price',c.price,'hours',c.hours,'venue',c.venue,'instructor',c.instructor,'completed',c.completed,
    'registrations_enabled',c.registrations_enabled,'support_name',c.support_name,'support_whatsapp',c.support_whatsapp)
  from public.laute_courses c where c.id=p_course_id;
$$;
create or replace function public.laute_course_availability(p_course_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at),'[]'::jsonb) from (
    select s.id,s.course_id,s.label,s.starts_at,s.ends_at,s.capacity,s.registrations_enabled,s.completed,
      count(r.id) filter(where r.status='confirmed') as confirmed,
      count(r.id) filter(where r.status='pending') as pending,
      count(r.id) as total,
      greatest(s.capacity-count(r.id) filter(where r.status in ('pending','confirmed')),0) as available
    from public.laute_course_sessions s left join public.laute_course_registrations r on r.session_id=s.id and r.course_id=s.course_id
    where s.course_id=p_course_id group by s.id
  ) t;
$$;

-- Retorno limitado ao registro procurado. Observações internas e telefone nunca saem por esta função.
create or replace function public.laute_course_registration_view(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',r.id,'course_id',r.course_id,'event_id',r.course_id,'source','multicourse',
    'full_name',r.full_name,'title',c.title,'status',r.status,'payment_status',r.payment_status,'amount_due',r.amount_due,
    'session_id',r.session_id,'session_label',s.label,'session_starts_at',s.starts_at,'session_ends_at',s.ends_at,
    'attended',r.attended,'created_at',r.created_at,'public_note',r.public_note,
    'certificate_id',(select x.id from public.laute_course_certificates x where x.registration_id=r.id and x.revoked_at is null limit 1))
  from public.laute_course_registrations r join public.laute_courses c on c.id=r.course_id
    join public.laute_course_sessions s on s.id=r.session_id where r.id=p_id;
$$;
create or replace function public.laute_course_find_registration(p_course_id text,p_full_name text,p_email text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare found_id uuid;
begin
  if length(coalesce(p_full_name,'')) not between 5 and 140 or length(coalesce(p_email,'')) not between 5 and 200 then
    raise exception 'Inscrição não localizada. Confira o curso, o nome completo e o e-mail.';
  end if;
  select id into found_id from public.laute_course_registrations where course_id=p_course_id
    and email=lower(btrim(p_email)) and public.laute_normalize_name(full_name)=public.laute_normalize_name(p_full_name);
  if found_id is null then raise exception 'Inscrição não localizada. Confira o curso, o nome completo e o e-mail.'; end if;
  return found_id;
end $$;
create or replace function public.laute_lookup_by_name(p_course_id text,p_full_name text,p_email text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare legacy_code text; result jsonb;
begin
  if p_course_id='sutura-2026' then
    if length(coalesce(p_full_name,'')) not between 5 and 140 or length(coalesce(p_email,'')) not between 5 and 200 then
      raise exception 'Inscrição não localizada. Confira o curso, o nome completo e o e-mail.';
    end if;
    select code into legacy_code from public.laute_registrations where event_id=p_course_id
      and lower(email)=lower(btrim(p_email))
      and public.laute_normalize_name(full_name)=public.laute_normalize_name(p_full_name) limit 1;
    if legacy_code is null then raise exception 'Inscrição não localizada. Confira o curso, o nome completo e o e-mail.'; end if;
    result:=public.laute_lookup(legacy_code,lower(btrim(p_email)));
    if result is null then raise exception 'Inscrição não localizada. Confira o curso, o nome completo e o e-mail.';end if;
    return (result-'admin_note'-'phone')||jsonb_build_object('source','legacy','event_id','sutura-2026','title','Curso de Sutura');
  end if;
  return public.laute_course_registration_view(public.laute_course_find_registration(p_course_id,p_full_name,p_email));
end $$;

create or replace function public.laute_course_register(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.laute_courses%rowtype; s public.laute_course_sessions%rowtype;
  r public.laute_course_registrations%rowtype; request uuid; n text; em text; tel text;
begin
  if length(payload::text)>6000 or coalesce(payload->>'website','')<>'' then raise exception 'Não foi possível enviar. Confira os dados.'; end if;
  n:=regexp_replace(btrim(payload->>'full_name'),'\s+',' ','g');em:=lower(btrim(payload->>'email'));
  tel:=regexp_replace(coalesce(payload->>'phone',''),'\D','','g');
  if n is null or length(n) not between 5 and 140 or n !~ '\S+\s+\S+' then raise exception 'Informe seu nome completo.'; end if;
  if em is null or length(em)>200 or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if length(tel) not between 10 and 13 then raise exception 'Informe um WhatsApp válido com DDD.'; end if;
  if coalesce(payload->>'accept_terms','')<>'true' then raise exception 'É necessário concordar com as condições de participação.'; end if;
  begin request:=(payload->>'request_id')::uuid;exception when others then raise exception 'Atualize a página e tente novamente.';end;
  if request is null then raise exception 'Atualize a página e tente novamente.';end if;
  -- Todas as alterações de vagas bloqueiam o mesmo curso antes da inscrição: evita overbooking.
  select * into c from public.laute_courses where id=payload->>'course_id' for update;
  if not found then raise exception 'Curso indisponível.'; end if;
  select * into r from public.laute_course_registrations where request_id=request;
  if found then
    if r.course_id<>c.id or r.email<>em or public.laute_normalize_name(r.full_name)<>public.laute_normalize_name(n)
       or r.session_id is distinct from payload->>'session_id' then raise exception 'Solicitação já utilizada. Atualize a página.'; end if;
    return public.laute_course_registration_view(r.id);
  end if;
  if not c.registrations_enabled or c.completed or clock_timestamp()<c.opens_at or clock_timestamp()>c.closes_at then
    raise exception 'As inscrições deste curso não estão abertas.';
  end if;
  select * into s from public.laute_course_sessions where id=payload->>'session_id' and course_id=c.id;
  if not found or not s.registrations_enabled or s.completed or clock_timestamp()>=s.starts_at then raise exception 'Escolha um turno disponível.'; end if;
  if exists(select 1 from public.laute_course_registrations where course_id=c.id and email=em) then
    raise exception 'Já existe uma inscrição com este e-mail neste curso. Consulte sua inscrição ou fale com o suporte.';
  end if;
  if (select count(*) from public.laute_course_registrations where course_id=c.id and session_id=s.id and status in ('pending','confirmed'))>=s.capacity then
    raise exception 'As vagas desse turno acabaram. Escolha outro turno.';
  end if;
  insert into public.laute_course_registrations(course_id,session_id,request_id,full_name,email,phone,amount_due)
    values(c.id,s.id,request,n,em,tel,c.price) returning * into r;
  return public.laute_course_registration_view(r.id);
end $$;
create or replace function public.laute_course_payment(p_course_id text,p_full_name text,p_email text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r uuid;
begin
  r:=public.laute_course_find_registration(p_course_id,p_full_name,p_email);
  return (select jsonb_build_object('id',c.id,'title',c.title,'price',x.amount_due,'payment_deadline',c.payment_deadline,
    'pix_key',c.pix_key,'pix_copy_paste',c.pix_copy_paste,'pix_recipient',c.pix_recipient,'contact_whatsapp',c.contact_whatsapp,
    'finance_contact',c.finance_contact,'payment_instructions',c.payment_instructions)
    from public.laute_courses c join public.laute_course_registrations x on x.course_id=c.id where x.id=r);
end $$;

create or replace function public.laute_course_change_options(p_course_id text,p_full_name text,p_email text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.laute_course_registrations%rowtype; s public.laute_course_sessions%rowtype; reason text; options jsonb;
begin
  select * into r from public.laute_course_registrations where id=public.laute_course_find_registration(p_course_id,p_full_name,p_email);
  select * into s from public.laute_course_sessions where id=r.session_id;
  reason:=case when r.status not in ('pending','confirmed') then 'Fale com o suporte para revisar a situação da inscrição.'
    when r.attended or exists(select 1 from public.laute_course_certificates x where x.registration_id=r.id and x.revoked_at is null) then 'A participação já tem presença ou certificado registrado.'
    when s.completed or clock_timestamp()>=s.starts_at or exists(select 1 from public.laute_courses c where c.id=r.course_id and c.completed) then 'O turno atual já começou ou foi realizado.'
    when not r.session_change_allowed then 'Solicite à organização a liberação de uma troca de turno.' else null end;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at),'[]'::jsonb) into options from (
    select x.id,x.label,x.starts_at,x.ends_at,x.completed,x.registrations_enabled,
      x.registrations_enabled and not x.completed and clock_timestamp()<x.starts_at as accepting,
      greatest(x.capacity-(select count(*) from public.laute_course_registrations y where y.session_id=x.id and y.status in ('pending','confirmed')),0) as available
    from public.laute_course_sessions x where x.course_id=r.course_id and x.id<>r.session_id
  ) t;
  return jsonb_build_object('eligible',reason is null,'allowed',r.session_change_allowed,'reason',reason,
    'current_session_id',s.id,'current_session_label',s.label,'current_session_starts_at',s.starts_at,'options',options);
end $$;
create or replace function public.laute_course_change_session(p_course_id text,p_full_name text,p_email text,p_session_id text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rid uuid; r public.laute_course_registrations%rowtype; s public.laute_course_sessions%rowtype;
  state jsonb; previous public.laute_course_session_changes%rowtype;
begin
  rid:=public.laute_course_find_registration(p_course_id,p_full_name,p_email);
  perform 1 from public.laute_courses where id=p_course_id for update;
  select * into r from public.laute_course_registrations where id=rid for update;
  if p_request_id is null then raise exception 'Atualize a consulta e tente novamente.';end if;
  select * into previous from public.laute_course_session_changes where request_id=p_request_id;
  if found then
    if previous.registration_id<>r.id or previous.to_session_id<>p_session_id then raise exception 'Solicitação inválida.';end if;
    return jsonb_build_object('replayed',true,'registration',public.laute_course_registration_view(r.id));
  end if;
  state:=public.laute_course_change_options(p_course_id,p_full_name,p_email);
  if not (state->>'eligible')::boolean then raise exception '%',state->>'reason';end if;
  select * into s from public.laute_course_sessions where id=p_session_id and course_id=r.course_id;
  if not found or s.id=r.session_id or not s.registrations_enabled or s.completed or clock_timestamp()>=s.starts_at then raise exception 'Escolha outro turno disponível.';end if;
  if (select count(*) from public.laute_course_registrations where session_id=s.id and status in ('pending','confirmed'))>=s.capacity then raise exception 'O turno ficou lotado. Sua vaga anterior foi mantida.';end if;
  insert into public.laute_course_session_changes(request_id,registration_id,from_session_id,to_session_id) values(p_request_id,r.id,r.session_id,s.id);
  update public.laute_course_registrations set session_id=s.id,session_changed_from=r.session_id,session_changed_at=clock_timestamp(),
    session_change_allowed=false,session_change_allowed_at=null,updated_at=clock_timestamp() where id=r.id;
  insert into public.laute_course_audit(action,course_id,target_id) values('participant_session_changed',r.course_id,r.id);
  return jsonb_build_object('replayed',false,'registration',public.laute_course_registration_view(r.id));
end $$;

create or replace function public.laute_course_admin_update(p_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.laute_course_registrations%rowtype; s public.laute_course_sessions%rowtype;
  cid text; new_name text; new_status text; new_payment text; attendance boolean;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.';end if;
  select course_id into cid from public.laute_course_registrations where id=p_id;
  if cid is null then raise exception 'Inscrição não localizada.';end if;
  perform 1 from public.laute_courses where id=cid for update;
  select * into r from public.laute_course_registrations where id=p_id for update;
  new_name:=regexp_replace(btrim(coalesce(payload->>'full_name',r.full_name)),'\s+',' ','g');
  new_status:=coalesce(payload->>'status',r.status);new_payment:=coalesce(payload->>'payment_status',r.payment_status);
  attendance:=coalesce((payload->>'attended')::boolean,r.attended);
  if length(new_name) not between 5 and 140 or new_name !~ '\S+\s+\S+' then raise exception 'Informe o nome completo.';end if;
  if new_status not in ('pending','confirmed','suspended','cancelled') or new_payment not in ('pending','paid','waived','refunded') then raise exception 'Situação inválida.';end if;
  select * into s from public.laute_course_sessions where id=coalesce(payload->>'session_id',r.session_id) and course_id=cid;
  if not found then raise exception 'Turno inválido para este curso.';end if;
  if exists(select 1 from public.laute_course_certificates where registration_id=r.id and revoked_at is null)
     and (new_name<>r.full_name or s.id<>r.session_id or new_status<>'confirmed' or not attendance or new_payment not in ('paid','waived')) then
    raise exception 'Revogue o certificado antes de modificar dados que invalidem a emissão.';
  end if;
  if new_status in ('pending','confirmed') and (r.status not in ('pending','confirmed') or s.id<>r.session_id)
     and (select count(*) from public.laute_course_registrations where session_id=s.id and status in ('pending','confirmed') and id<>r.id)>=s.capacity then
    raise exception 'O turno escolhido está lotado.';
  end if;
  if length(coalesce(payload->>'public_note',r.public_note))>1000 or length(coalesce(payload->>'admin_note',r.admin_note))>2000 then raise exception 'Reduza o tamanho das observações.';end if;
  update public.laute_course_registrations set full_name=new_name,status=new_status,payment_status=new_payment,
    attended=attendance,session_id=s.id,public_note=coalesce(payload->>'public_note',r.public_note),
    admin_note=coalesce(payload->>'admin_note',r.admin_note),updated_at=clock_timestamp() where id=r.id;
  insert into public.laute_course_audit(actor,action,course_id,target_id) values(auth.uid(),'registration_updated',cid,r.id);
  return public.laute_course_registration_view(r.id);
end $$;
create or replace function public.laute_course_admin_allow_change(p_id uuid,p_allowed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.laute_course_registrations%rowtype; cid text;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.';end if;
  select course_id into cid from public.laute_course_registrations where id=p_id;
  if cid is null or p_allowed is null then raise exception 'Inscrição inválida.';end if;
  perform 1 from public.laute_courses where id=cid for update;
  select * into r from public.laute_course_registrations where id=p_id for update;
  if p_allowed and (r.status not in ('pending','confirmed') or r.attended
    or exists(select 1 from public.laute_course_certificates where registration_id=r.id and revoked_at is null)
    or exists(select 1 from public.laute_course_sessions where id=r.session_id and (completed or clock_timestamp()>=starts_at))
    or exists(select 1 from public.laute_courses where id=cid and completed)) then
    raise exception 'A inscrição não está apta para troca de turno.';end if;
  update public.laute_course_registrations set session_change_allowed=p_allowed,
    session_change_allowed_at=case when p_allowed then clock_timestamp() else null end,updated_at=clock_timestamp() where id=r.id;
  insert into public.laute_course_audit(actor,action,course_id,target_id) values(auth.uid(),case when p_allowed then 'session_change_allowed' else 'session_change_revoked' end,cid,r.id);
  return jsonb_build_object('allowed',p_allowed);
end $$;
create or replace function public.laute_course_admin_save(p_course_id text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.laute_courses%rowtype;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.';end if;
  select * into c from public.laute_courses where id=p_course_id for update;
  if not found then raise exception 'Curso não localizado.';end if;
  update public.laute_courses set title=coalesce(payload->>'title',c.title),venue=coalesce(payload->>'venue',c.venue),
    instructor=case when payload?'instructor' then nullif(btrim(payload->>'instructor'),'') else c.instructor end,
    opens_at=coalesce((payload->>'opens_at')::timestamptz,c.opens_at),closes_at=coalesce((payload->>'closes_at')::timestamptz,c.closes_at),
    price=coalesce((payload->>'price')::numeric,c.price),hours=coalesce((payload->>'hours')::numeric,c.hours),
    registrations_enabled=coalesce((payload->>'registrations_enabled')::boolean,c.registrations_enabled),
    completed=coalesce((payload->>'completed')::boolean,c.completed),
    payment_deadline=case when payload?'payment_deadline' then nullif(payload->>'payment_deadline','')::timestamptz else c.payment_deadline end,
    pix_key=coalesce(payload->>'pix_key',c.pix_key),pix_copy_paste=coalesce(payload->>'pix_copy_paste',c.pix_copy_paste),
    pix_recipient=coalesce(payload->>'pix_recipient',c.pix_recipient),finance_contact=coalesce(payload->>'finance_contact',c.finance_contact),
    contact_whatsapp=coalesce(payload->>'contact_whatsapp',c.contact_whatsapp),payment_instructions=coalesce(payload->>'payment_instructions',c.payment_instructions),
    signer_name=coalesce(payload->>'signer_name',c.signer_name),signer_role=coalesce(payload->>'signer_role',c.signer_role),
    coordinator_name=coalesce(payload->>'coordinator_name',c.coordinator_name),coordinator_role=coalesce(payload->>'coordinator_role',c.coordinator_role),
    updated_at=clock_timestamp() where id=c.id;
  insert into public.laute_course_audit(actor,action,course_id) values(auth.uid(),'course_updated',c.id);
  return jsonb_build_object('saved',true);
end $$;
create or replace function public.laute_course_admin_save_sessions(p_course_id text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; s public.laute_course_sessions%rowtype; cap integer; start_time timestamptz; end_time timestamptz;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.';end if;
  perform 1 from public.laute_courses where id=p_course_id for update;
  if not found or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)<>3 then raise exception 'Informe os três turnos deste curso.';end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(payload) x)<>3 then raise exception 'Não repita turnos.';end if;
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

create or replace function public.laute_verify_course_certificate(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select x.snapshot||jsonb_build_object('id',x.id,'valid',x.revoked_at is null,'issued_at',x.issued_at)
  from public.laute_course_certificates x where x.id=p_id;
$$;
create or replace function public.laute_course_admin_issue_certificate(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.laute_course_registrations%rowtype; c public.laute_courses%rowtype; s public.laute_course_sessions%rowtype; cert_id uuid; cid text;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.';end if;
  select course_id into cid from public.laute_course_registrations where id=p_id;
  if cid is null then raise exception 'Inscrição não localizada.';end if;
  select * into c from public.laute_courses where id=cid for update;
  select * into r from public.laute_course_registrations where id=p_id for update;
  select id into cert_id from public.laute_course_certificates where registration_id=r.id and revoked_at is null;
  if found then return public.laute_verify_course_certificate(cert_id);end if;
  select * into s from public.laute_course_sessions where id=r.session_id;
  if r.status<>'confirmed' or not r.attended or r.payment_status not in ('paid','waived') or not s.completed or clock_timestamp()<s.ends_at then
    raise exception 'A emissão exige inscrição confirmada, pagamento conferido/isento, presença e turno concluído após seu horário final.';
  end if;
  if nullif(btrim(c.signer_name),'') is null or nullif(btrim(c.coordinator_name),'') is null then raise exception 'Preencha os responsáveis pelo certificado nas configurações antes de emitir.';end if;
  insert into public.laute_course_certificates(registration_id,course_id,snapshot) values(r.id,c.id,
    jsonb_build_object('full_name',r.full_name,'title',c.title,'hours',c.hours,'instructor',c.instructor,'session_label',s.label,
      'date',to_char(s.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY'),
      'time',to_char(s.starts_at at time zone 'America/Sao_Paulo','HH24:MI'),
      'signer_name',c.signer_name,'signer_role',coalesce(c.signer_role,''),'coordinator_name',c.coordinator_name,'coordinator_role',coalesce(c.coordinator_role,''))) returning id into cert_id;
  insert into public.laute_course_audit(actor,action,course_id,target_id) values(auth.uid(),'certificate_issued',c.id,r.id);
  return public.laute_verify_course_certificate(cert_id);
end $$;
create or replace function public.laute_course_admin_revoke_certificate(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid text; rid uuid;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.';end if;
  select course_id,registration_id into cid,rid from public.laute_course_certificates where id=p_id;
  if cid is null then raise exception 'Certificado não localizado.';end if;
  perform 1 from public.laute_courses where id=cid for update;
  update public.laute_course_certificates set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=p_id;
  insert into public.laute_course_audit(actor,action,course_id,target_id) values(auth.uid(),'certificate_revoked',cid,rid);
  return jsonb_build_object('revoked',true);
end $$;

-- Retira o EXECUTE público padrão de todas as funções novas, inclusive auxiliares.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('laute_normalize_name','laute_platform_status','laute_course_public','laute_course_availability',
      'laute_course_registration_view','laute_course_find_registration','laute_lookup_by_name','laute_course_register','laute_course_payment',
      'laute_course_change_options','laute_course_change_session','laute_course_admin_update','laute_course_admin_allow_change',
      'laute_course_admin_save','laute_course_admin_save_sessions','laute_verify_course_certificate','laute_course_admin_issue_certificate',
      'laute_course_admin_revoke_certificate') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.laute_platform_status(),public.laute_course_public(text),public.laute_course_availability(text),
  public.laute_lookup_by_name(text,text,text),public.laute_course_register(jsonb),public.laute_course_payment(text,text,text),
  public.laute_course_change_options(text,text,text),public.laute_course_change_session(text,text,text,text,uuid),
  public.laute_verify_course_certificate(uuid) to anon,authenticated;
grant execute on function public.laute_course_admin_update(uuid,jsonb),public.laute_course_admin_allow_change(uuid,boolean),
  public.laute_course_admin_save(text,jsonb),public.laute_course_admin_save_sessions(text,jsonb),
  public.laute_course_admin_issue_certificate(uuid),public.laute_course_admin_revoke_certificate(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
