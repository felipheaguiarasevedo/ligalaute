-- LAUTE: troca de turno pelo participante, após liberação administrativa.
-- Execute TODO este arquivo uma vez no SQL Editor do projeto já utilizado.
-- Pode executar novamente. Não reinstale o banco nem apague as inscrições.
begin;

do $$
begin
  if to_regclass('public.laute_sessions') is null
     or to_regprocedure('public.laute_admin_update_session(uuid,text,text,boolean,text,text,text)') is null then
    raise exception 'Esta atualização exige o banco LAUTE com os três turnos já instalado.';
  end if;
end $$;

alter table public.laute_registrations
  add column if not exists session_change_allowed boolean not null default false,
  add column if not exists session_change_allowed_at timestamptz,
  add column if not exists session_change_allowed_by uuid references auth.users(id) on delete set null,
  add column if not exists session_changed_at timestamptz,
  add column if not exists session_changed_from text;

create table if not exists public.laute_session_changes (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.laute_registrations(id),
  request_id uuid not null unique,
  from_session_id text not null references public.laute_sessions(id),
  to_session_id text not null references public.laute_sessions(id),
  authorized_by uuid references auth.users(id) on delete set null,
  authorized_at timestamptz not null,
  changed_at timestamptz not null default now(),
  check (from_session_id <> to_session_id)
);
alter table public.laute_session_changes enable row level security;
revoke all on public.laute_session_changes from public, anon, authenticated;
grant select on public.laute_session_changes to authenticated;
drop policy if exists laute_admin_session_changes_read on public.laute_session_changes;
create policy laute_admin_session_changes_read on public.laute_session_changes
  for select to authenticated using (public.laute_is_admin());

-- A mesma regra é usada pela consulta e pela gravação. Sem acesso público direto.
create or replace function public.laute_session_change_block_reason(p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r public.laute_registrations%rowtype; s public.laute_sessions%rowtype;
begin
  select * into r from public.laute_registrations where id=p_id;
  if not found then return 'Inscrição não localizada.'; end if;
  if r.status not in ('pending','confirmed') then
    return 'A troca está disponível somente para inscrições pendentes ou confirmadas. Fale com a organização.';
  end if;
  if r.attended or exists(select 1 from public.laute_certificates where registration_id=r.id and revoked_at is null) then
    return 'Esta inscrição já tem presença registrada ou certificado ativo. Fale com a organização.';
  end if;
  select * into s from public.laute_sessions where id=r.session_id and event_id=r.event_id;
  if not found then return 'Turno atual não localizado. Fale com a organização.'; end if;
  if s.completed or clock_timestamp() >= s.starts_at then
    return 'O turno atual já começou ou foi realizado. Fale com a organização.';
  end if;
  if exists(select 1 from public.laute_event where id=r.event_id and completed) then
    return 'O curso já foi encerrado. Fale com a organização.';
  end if;
  return null;
end $$;

create or replace function public.laute_admin_allow_session_change(p_id uuid,p_allowed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.laute_registrations%rowtype; reason text;
begin
  if not coalesce(public.laute_is_admin(),false) then raise exception 'Acesso restrito.'; end if;
  if p_allowed is null then raise exception 'Informe se deseja liberar ou revogar a troca.'; end if;
  -- Mesma ordem de bloqueios dos RPCs originais: evento, depois inscrição.
  perform 1 from public.laute_event where id='sutura-2026' for update;
  select * into r from public.laute_registrations where id=p_id and event_id='sutura-2026' for update;
  if not found then raise exception 'Inscrição não localizada.'; end if;
  if p_allowed then
    reason := public.laute_session_change_block_reason(r.id);
    if reason is not null then raise exception '%',reason; end if;
  end if;
  -- Repetir a liberação não acumula autorizações.
  if r.session_change_allowed is distinct from p_allowed then
    update public.laute_registrations set session_change_allowed=p_allowed,
      session_change_allowed_at=case when p_allowed then clock_timestamp() else null end,
      session_change_allowed_by=case when p_allowed then auth.uid() else null end,
      updated_at=clock_timestamp() where id=r.id;
    insert into public.laute_audit(actor,action,target_id)
      values(auth.uid(),case when p_allowed then 'session_change_allowed' else 'session_change_revoked' end,r.id::text);
  end if;
  return jsonb_build_object('allowed',p_allowed);
end $$;

create or replace function public.laute_session_change_options(p_code text,p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.laute_registrations%rowtype; reason text; options jsonb;
begin
  if p_code is null or p_email is null or length(p_code)>80 or length(p_email)>200 then
    raise exception 'Inscrição não localizada. Confira o código e o e-mail.';
  end if;
  select * into r from public.laute_registrations
    where code=upper(trim(p_code)) and email=lower(trim(p_email));
  if not found then raise exception 'Inscrição não localizada. Confira o código e o e-mail.'; end if;
  reason := public.laute_session_change_block_reason(r.id);
  if reason is null and not r.session_change_allowed then
    reason := 'Para mudar de turno, solicite a liberação à organização.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at),'[]'::jsonb) into options from (
    select s.id,s.label,s.starts_at,s.registrations_enabled,s.completed,
      greatest(s.capacity-(select count(*) from public.laute_registrations x
        where x.event_id=s.event_id and x.session_id=s.id and x.status in ('pending','confirmed')),0) as available,
      s.registrations_enabled and not s.completed and s.starts_at>clock_timestamp() as accepting
    from public.laute_sessions s where s.event_id=r.event_id and s.id<>r.session_id
  ) t;
  return jsonb_build_object('allowed',r.session_change_allowed,'eligible',reason is null,
    'reason',reason,'current_session_id',r.session_id,'current_session_label',(select label from public.laute_sessions where id=r.session_id),
    'current_session_starts_at',(select starts_at from public.laute_sessions where id=r.session_id),'changed_at',r.session_changed_at,'options',options);
end $$;

create or replace function public.laute_change_session(
  p_code text,p_email text,p_session_id text,p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.laute_registrations%rowtype; target public.laute_sessions%rowtype;
  prior public.laute_session_changes%rowtype; reason text;
begin
  if p_request_id is null then raise exception 'Recarregue a consulta e tente novamente.'; end if;
  if p_code is null or p_email is null or length(p_code)>80 or length(p_email)>200 then
    raise exception 'Inscrição não localizada. Confira o código e o e-mail.';
  end if;
  -- Autentica antes de bloquear para que códigos inválidos não prendam o evento.
  select * into r from public.laute_registrations
    where code=upper(trim(p_code)) and email=lower(trim(p_email));
  if not found then raise exception 'Inscrição não localizada. Confira o código e o e-mail.'; end if;
  -- Compartilha o bloqueio usado por cadastro, confirmação e configuração de vagas.
  -- Read Committed (padrão do PostgREST) relê a lotação após obter o bloqueio.
  perform 1 from public.laute_event where id=r.event_id for update;
  select * into r from public.laute_registrations
    where code=upper(trim(p_code)) and email=lower(trim(p_email)) for update;
  if not found then raise exception 'Inscrição não localizada. Confira o código e o e-mail.'; end if;
  select * into prior from public.laute_session_changes where request_id=p_request_id;
  if found then
    if prior.registration_id<>r.id or prior.to_session_id is distinct from p_session_id then
      raise exception 'Solicitação inválida. Atualize a consulta.';
    end if;
    return jsonb_build_object('replayed',true,'registration',public.laute_lookup(p_code,p_email));
  end if;
  if not r.session_change_allowed then raise exception 'A troca não está liberada. Solicite a liberação à organização.'; end if;
  reason := public.laute_session_change_block_reason(r.id);
  if reason is not null then raise exception '%',reason; end if;
  if p_session_id=r.session_id then raise exception 'Escolha um turno diferente do atual.'; end if;
  select * into target from public.laute_sessions where id=p_session_id and event_id=r.event_id;
  if not found then raise exception 'Escolha um turno válido.'; end if;
  if not target.registrations_enabled or target.completed or clock_timestamp()>=target.starts_at then
    raise exception 'O turno escolhido não está disponível para troca. Atualize as opções.';
  end if;
  if (select count(*) from public.laute_registrations
      where event_id=r.event_id and session_id=target.id and status in ('pending','confirmed'))>=target.capacity then
    raise exception 'As vagas desse turno acabaram. Sua inscrição continua no turno anterior. Escolha outra opção.';
  end if;
  insert into public.laute_session_changes(registration_id,request_id,from_session_id,to_session_id,authorized_by,authorized_at)
    values(r.id,p_request_id,r.session_id,target.id,r.session_change_allowed_by,r.session_change_allowed_at);
  update public.laute_registrations set session_id=target.id,
    session_change_allowed=false,session_change_allowed_at=null,session_change_allowed_by=null,
    session_changed_at=clock_timestamp(),session_changed_from=r.session_id,updated_at=clock_timestamp()
    where id=r.id;
  insert into public.laute_audit(actor,action,target_id)
    values(null,'participant_session_changed',r.id::text);
  return jsonb_build_object('replayed',false,'registration',public.laute_lookup(p_code,p_email));
end $$;

revoke all on function public.laute_session_change_block_reason(uuid),
  public.laute_admin_allow_session_change(uuid,boolean),public.laute_session_change_options(text,text),
  public.laute_change_session(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.laute_admin_allow_session_change(uuid,boolean) to authenticated;
grant execute on function public.laute_session_change_options(text,text),
  public.laute_change_session(text,text,text,uuid) to anon,authenticated;

notify pgrst,'reload schema';
commit;
