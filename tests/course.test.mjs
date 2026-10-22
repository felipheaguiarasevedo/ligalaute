import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIRST_AID,FIRST_AID_SESSIONS,coursePhase,fullName,validFullName,csvCell,supportLink} from '../js/first-aid-data.js';
test('novo curso usa os valores e três horários informados, sem ministrante não confirmado',()=>{
  assert.equal(FIRST_AID.price,25);assert.equal(FIRST_AID.hours,6);assert.equal(FIRST_AID.instructor,null);
  assert.equal(FIRST_AID_SESSIONS.length,3);assert.equal(new Set(FIRST_AID_SESSIONS.map(s=>s.id)).size,3);
  for(const s of FIRST_AID_SESSIONS)assert.equal(s.capacity,60);
  assert.match(FIRST_AID_SESSIONS[2].ends_at,/21:30:00-03:00/);
  assert.match(supportLink(),/5598991100569/);
});
test('abertura e encerramento respeitam a data de Brasília, inclusive no limite',()=>{
  const at=v=>coursePhase(FIRST_AID,new Date(v).getTime());
  assert.equal(at('2026-10-22T02:59:59Z'),'scheduled');assert.equal(at('2026-10-22T03:00:00Z'),'open');
  assert.equal(at('2026-11-19T02:59:59Z'),'open');assert.equal(at('2026-11-19T03:00:00Z'),'closed');
  assert.equal(coursePhase({...FIRST_AID,registrations_enabled:false},new Date('2026-11-01').getTime()),'paused');
  assert.equal(coursePhase({...FIRST_AID,completed:true},new Date('2026-11-01').getTime()),'closed');
});
test('nome completo mantém acentuação e elimina apenas espaços excedentes',()=>{
  assert.equal(fullName('  Ana   Cláudia  da Silva '),'Ana Cláudia da Silva');assert.equal(validFullName('João Silva'),true);
  assert.equal(validFullName('Alice'),false);assert.equal(validFullName('A'.repeat(141)+' Silva'),false);
});
test('CSV escapa aspas e neutraliza fórmulas de planilha',()=>{
  for(const value of ['=CMD()',' +1','-123','@x','\tA'])assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Ana "Maria"'),'"Ana ""Maria"""');assert.equal(csvCell(null),'""');
});
test('página do curso é fail-closed e não solicita código nem dados acadêmicos',()=>{
  const html=readFileSync('primeiros-socorros.html','utf8'),js=readFileSync('js/first-aid.js','utf8');
  assert.match(html,/id="ps-form-fields" disabled/);assert.doesNotMatch(html,/<input[^>]+name="(?:code|institution|semester|course)"/);
  assert.match(html,/Não é obrigatório/);assert.match(html,/21h30/);assert.match(html,/id="ps-instructor" hidden/);
  assert.match(js,/laute_course_register/);assert.match(js,/crypto.randomUUID/);assert.doesNotMatch(js,/localStorage|Math.random/);
});
test('admin separa tabelas e mutações novas, preserva painel legado e inclui ativação',()=>{
  const admin=readFileSync('js/admin-courses.js','utf8'),old=readFileSync('js/admin.js','utf8');
  assert.match(admin,/eq\('course_id',cid\)/);assert.match(admin,/laute_course_admin_update/);
  assert.match(admin,/SQL Editor/);assert.match(old,/createCourseHub/);assert.match(old,/allRows\('laute_registrations'\)/);
  assert.doesNotMatch(admin,/\.from\('laute_registrations'\)/);
});
