import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const modulePath=process.env.LAUTE_PGLITE_PATH;
test('migração e regras do novo curso em PostgreSQL local isolado', {skip:!modulePath,timeout:120000},async t=>{
  const {PGlite}=await import(pathToFileURL(modulePath));const db=new PGlite();
  const q=async(sql,params=[])=>{const r=await db.query(sql,params);return r.rows;};
  const call=async(name,args)=>{const names=Object.keys(args),v=Object.values(args);const rows=await q(`select public.${name}(${names.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as data`,v);return rows[0].data;};
  const role=async admin=>db.exec(`reset role;set role ${admin?'authenticated':'anon'};select set_config('request.jwt.claim.role','${admin?'admin':'anon'}',false);`);
  const owner=async()=>db.exec('reset role;');
  const migration=readFileSync('supabase/ATIVAR_MULTICURSOS_PRIMEIROS_SOCORROS.sql','utf8');
  try{
    await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
      grant usage on schema public,auth to anon,authenticated;
      create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function public.laute_is_admin() returns boolean language sql stable as $$select coalesce(current_setting('request.jwt.claim.role',true),'')='admin'$$;
      create table public.laute_event(id text primary key,pix_key text,pix_copy_paste text,pix_recipient text,contact_whatsapp text,finance_contact text);
      insert into public.laute_event values('sutura-2026','chave-existente','CODIGO_COM_30_REAIS','Favorecido existente','5598999999999','Financeiro existente');
      create table public.laute_registrations(id uuid default gen_random_uuid(),event_id text,full_name text,email text,code text,phone text,admin_note text,status text);
      insert into public.laute_registrations(event_id,full_name,email,code,phone,admin_note,status) values('sutura-2026','Maria da Silva','maria@example.com','CODIGO-ANTIGO','5598988888888','Segredo interno','confirmed');
      create function public.laute_lookup(p_code text,p_email text) returns jsonb language sql stable security definer set search_path='' as $$select to_jsonb(r) from public.laute_registrations r where r.code=p_code and r.email=p_email$$;`);
    await db.exec(migration);
    await t.test('semente tem três turnos de 60 vagas e noite até 21h30, sem ministrante inventado',async()=>{
      const [c]=await q('select * from laute_courses');const s=await q('select * from laute_course_sessions order by starts_at');
      assert.equal(c.price,'25.00');assert.equal(c.hours,'6.00');assert.equal(c.instructor,null);
      assert.equal(c.payment_deadline,null);assert.equal(c.pix_key,'f73756ec-b123-4344-a440-eb6efadad827');assert.match(c.pix_copy_paste,/540525\.00/);assert.equal(c.pix_recipient,'VITORIA SANTOS DA COSTA');
      assert.equal(c.support_whatsapp,'5598991100569');assert.deepEqual(s.map(x=>x.capacity),[60,60,60]);
      assert.equal(new Date(s[2].ends_at).toISOString(),'2026-11-20T00:30:00.000Z');
      assert.equal(new Date(c.opens_at).toISOString(),'2026-10-22T03:00:00.000Z');
    });
    await t.test('público não recebe dados financeiros, listas nem funções auxiliares',async()=>{
      await role(false);const c=await call('laute_course_public',{p_course_id:'primeiros-socorros-2026'});
      assert.ok(!('pix_key' in c));assert.ok(!('contact_whatsapp' in c));
      await assert.rejects(q('select * from public.laute_course_registrations'),/permission denied/);
      await assert.rejects(q('select public.laute_course_registration_view(gen_random_uuid())'),/permission denied/);
      await assert.rejects(call('laute_course_admin_save',{p_course_id:'primeiros-socorros-2026',payload:{price:0}}),/permission denied/);
    });
    await t.test('legado é localizado por nome e e-mail sem divulgar telefone ou observações internas',async()=>{
      const r=await call('laute_lookup_by_name',{p_course_id:'sutura-2026',p_full_name:'  MARIA  DA SILVA ',p_email:'MARIA@example.com'});
      assert.equal(r.source,'legacy');assert.equal(r.full_name,'Maria da Silva');assert.ok(!('phone'in r));assert.ok(!('admin_note'in r));
      await assert.rejects(call('laute_lookup_by_name',{p_course_id:'sutura-2026',p_full_name:'Outra Pessoa',p_email:'maria@example.com'}),/não localizada/);
    });
    await owner();await db.exec("update laute_courses set opens_at=clock_timestamp()-interval '1 day',closes_at=clock_timestamp()+interval '1 hour';");
    const args={course_id:'primeiros-socorros-2026',session_id:'ps-2026-manha',request_id:crypto.randomUUID(),full_name:'Joana de Teste',email:'joana@example.com',phone:'98999998888',accept_terms:true,website:''};
    let registration;
    await t.test('cadastro exige termos, ignora valor do cliente e é idempotente sem códigos',async()=>{
      await role(false);
      await assert.rejects(call('laute_course_register',{payload:{...args,accept_terms:false}}),/concordar/);
      registration=await call('laute_course_register',{payload:{...args,amount_due:0,status:'confirmed'}});
      assert.equal(Number(registration.amount_due),25);assert.equal(registration.status,'pending');assert.ok(!('code'in registration));
      const again=await call('laute_course_register',{payload:args});assert.equal(again.id,registration.id);
      await assert.rejects(call('laute_course_register',{payload:{...args,request_id:crypto.randomUUID()}}),/Já existe/);
      const payment=await call('laute_course_payment',{p_course_id:args.course_id,p_full_name:args.full_name,p_email:args.email});assert.equal(payment.pix_key,'f73756ec-b123-4344-a440-eb6efadad827');
    });
    await t.test('nova consulta falha com nome/e-mail incorreto e não retorna notas privadas',async()=>{
      const r=await call('laute_lookup_by_name',{p_course_id:args.course_id,p_full_name:'JOANA DE TESTE',p_email:'JOANA@example.com'});
      assert.equal(r.id,registration.id);assert.ok(!('admin_note'in r));assert.ok(!('phone'in r));
      await assert.rejects(call('laute_lookup_by_name',{p_course_id:args.course_id,p_full_name:'Joana de Teste',p_email:'outro@example.com'}),/não localizada/);
    });
    await t.test('mudança de turno exige liberação e só a consome após uma troca válida',async()=>{
      const credentials={p_course_id:args.course_id,p_full_name:args.full_name,p_email:args.email};
      let options=await call('laute_course_change_options',credentials);assert.equal(options.eligible,false);
      await role(true);await call('laute_course_admin_allow_change',{p_id:registration.id,p_allowed:true});await role(false);
      options=await call('laute_course_change_options',credentials);assert.equal(options.eligible,true);
      const rid=crypto.randomUUID(),request={...credentials,p_session_id:'ps-2026-tarde',p_request_id:rid};
      const changed=await call('laute_course_change_session',request);assert.equal(changed.registration.session_id,'ps-2026-tarde');
      assert.equal((await call('laute_course_change_session',request)).replayed,true);
      assert.equal((await call('laute_course_change_options',credentials)).eligible,false);
    });
    await t.test('limite de vagas é aplicado no servidor e pode liberar vaga ao cancelar',async()=>{
      await owner();await db.exec("update laute_course_sessions set capacity=2 where id='ps-2026-noite'");await role(false);
      const results=await Promise.allSettled(Array.from({length:5},(_,i)=>call('laute_course_register',{payload:{...args,email:`noite${i}@example.com`,full_name:`Pessoa Teste ${i}`,session_id:'ps-2026-noite',request_id:crypto.randomUUID()}})));
      assert.equal(results.filter(x=>x.status==='fulfilled').length,2);
      const available=await call('laute_course_availability',{p_course_id:args.course_id});assert.equal(Number(available.find(s=>s.id==='ps-2026-noite').available),0);
      await role(true);const night=results.find(x=>x.status==='fulfilled').value;
      await call('laute_course_admin_update',{p_id:night.id,payload:{status:'cancelled'}});await role(false);
      assert.equal(Number((await call('laute_course_availability',{p_course_id:args.course_id})).find(s=>s.id==='ps-2026-noite').available),1);
    });
    await t.test('certificado não sai sem pagamento, presença e conclusão; depois preserva snapshot e permite revogação',async()=>{
      await role(true);await assert.rejects(call('laute_course_admin_issue_certificate',{p_id:registration.id}),/emissão exige/);
      await call('laute_course_admin_update',{p_id:registration.id,payload:{status:'confirmed',payment_status:'paid',attended:true}});
      await call('laute_course_admin_save',{p_course_id:args.course_id,payload:{signer_name:'Responsável Confirmado',coordinator_name:'Coordenação Confirmada'}});
      await owner();await db.exec("update laute_course_sessions set starts_at=clock_timestamp()-interval '4 hours',ends_at=clock_timestamp()-interval '1 minute',completed=true where id='ps-2026-tarde'");await role(true);
      const cert=await call('laute_course_admin_issue_certificate',{p_id:registration.id});assert.equal(cert.valid,true);assert.equal(cert.full_name,args.full_name);
      assert.equal((await call('laute_course_admin_issue_certificate',{p_id:registration.id})).id,cert.id);
      await assert.rejects(call('laute_course_admin_update',{p_id:registration.id,payload:{full_name:'Outro Nome Completo'}}),/Revogue/);
      await role(false);assert.equal((await call('laute_verify_course_certificate',{p_id:cert.id})).valid,true);
      await role(true);await call('laute_course_admin_revoke_certificate',{p_id:cert.id});await role(false);
      assert.equal((await call('laute_verify_course_certificate',{p_id:cert.id})).valid,false);
    });
    await t.test('reexecutar migração não zera inscrições nem reverte configurações; sutura permanece intacta',async()=>{
      await owner();const before=(await q('select count(*)::int as n from laute_course_registrations'))[0].n;
      await db.exec(migration);assert.equal((await q('select count(*)::int as n from laute_course_registrations'))[0].n,before);
      assert.equal((await q("select capacity from laute_course_sessions where id='ps-2026-noite'"))[0].capacity,2);
      const old=await q('select * from laute_registrations');assert.equal(old.length,1);assert.equal(old[0].code,'CODIGO-ANTIGO');
    });
    await t.test('atualização de Pix funciona no curso já ativado e mantém inscrições, preço e financeiro de Sutura',async()=>{
      await owner();const before=(await q('select count(*)::int as n from laute_course_registrations'))[0].n;
      await db.exec("update laute_courses set pix_copy_paste=null,pix_key='configuração-anterior' where id='primeiros-socorros-2026'");
      await db.exec(readFileSync('supabase/ATUALIZAR_PIX_PRIMEIROS_SOCORROS.sql','utf8'));
      const [course]=await q("select * from laute_courses where id='primeiros-socorros-2026'");
      assert.equal(course.price,'25.00');assert.equal(course.pix_key,'f73756ec-b123-4344-a440-eb6efadad827');assert.ok(course.pix_copy_paste.endsWith('6304F720'));
      assert.equal((await q('select count(*)::int as n from laute_course_registrations'))[0].n,before);
      assert.equal((await q("select pix_key from laute_event where id='sutura-2026'"))[0].pix_key,'chave-existente');
    });
  }finally{await db.close();}
});
