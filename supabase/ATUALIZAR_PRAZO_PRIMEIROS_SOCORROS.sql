-- LAUTE · Prorrogação das inscrições de Primeiros Socorros até 04/12/2026.
-- Execute no SQL Editor do mesmo projeto Supabase usado pelo site.
-- Atualiza somente o prazo do curso; não altera inscrições, pagamentos ou vagas.
begin;
update public.laute_courses
set closes_at='2026-12-04 23:59:59-03',
    updated_at=clock_timestamp()
where id='primeiros-socorros-2026';
commit;
select id, closes_at
from public.laute_courses
where id='primeiros-socorros-2026';
