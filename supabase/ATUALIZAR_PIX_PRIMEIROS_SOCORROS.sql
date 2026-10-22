-- LAUTE · Pix de R$ 25,00 do Curso de Primeiros Socorros (19/11/2026).
-- Execute no SQL Editor do mesmo projeto Supabase do site, após a ativação multicursos.
-- Atualiza somente o Pix deste curso; o contato financeiro e as inscrições são mantidos.
begin;
do $$
declare course_price numeric;
begin
  select price into course_price from public.laute_courses
  where id='primeiros-socorros-2026' for update;
  if not found then
    raise exception 'Primeiro execute ATIVAR_MULTICURSOS_PRIMEIROS_SOCORROS.sql neste projeto.';
  end if;
  if course_price<>25 then
    raise exception 'O Pix enviado tem valor fixo de R$ 25,00, mas o curso está com outro valor. Confira as configurações antes de aplicar.';
  end if;
  update public.laute_courses set
    pix_key='f73756ec-b123-4344-a440-eb6efadad827',
    pix_copy_paste='00020101021126580014br.gov.bcb.pix0136f73756ec-b123-4344-a440-eb6efadad827520400005303986540525.005802BR5918VITORIA S DA COSTA6008SAO LUIS62070503***6304F720',
    pix_recipient='VITORIA SANTOS DA COSTA',
    updated_at=clock_timestamp()
  where id='primeiros-socorros-2026';
end $$;
commit;

select title,price,pix_recipient,
  pix_copy_paste is not null as pix_copia_e_cola_configurado
from public.laute_courses where id='primeiros-socorros-2026';
