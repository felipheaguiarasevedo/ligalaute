# LAUTE — site oficial

Site institucional estático da Liga Acadêmica de Urgência, Trauma e Emergência, com os fluxos de participantes e administração conectados ao Supabase existente.

## Páginas

- `index.html`: início institucional.
- `sobre.html`: identidade, propósito e pilares.
- `cursos.html`: catálogo com filtros de próximos e realizados.
- `sutura.html`: memória e informações da edição de 15/10/2026, com inscrições encerradas.
- `primeiros-socorros.html`: descrição, pôster e inscrição do curso de 19/11/2026; três turnos de 60 vagas, R$ 25 e 6h de certificação.
- `galeria.html`: fotos desta edição e fotos adicionais publicadas pelo painel no Supabase.
- `certificados.html`: orientações de emissão e validação.
- `contato.html`: canais oficiais e localização.
- `consultar.html`, `validar.html`, `admin.html` e `privacidade.html`: serviços existentes preservados.

## Publicação e manutenção

A Netlify está configurada em `netlify.toml` para publicar `liga laute/`. O repositório já continha arquivos também na raiz. Edite a versão da raiz e execute `npm run prepare:release` para sincronizar o espelho publicado, pré-renderizar a navegação e renovar as referências de cache.

O processo não faz migrações nem altera inscrições, pagamentos, permissões ou certificados do Supabase. A configuração pública continua em `config.js`; nunca inclua chaves `service_role`, `sb_secret`, senhas ou tokens no frontend.

`js/media-data.js` contém o acervo fotográfico desta atualização. A galeria também consulta a tabela e o bucket já usados pelo painel. Textos e fotos remotos não são inseridos como HTML.

## Ativar o novo curso no Supabase (uma vez)

O deploy não executa migrações de banco. No **mesmo projeto Supabase**, abra **SQL Editor → New query**, cole o arquivo completo `supabase/ATIVAR_MULTICURSOS_PRIMEIROS_SOCORROS.sql` e execute **Run**. Depois atualize o painel e a página pública.

A atualização é aditiva e pode ser reexecutada: não apaga registros nem altera funções/tabelas originais de Sutura. Cria tabelas próprias para cursos, turnos, inscrições, certificados, trocas e auditoria; reutiliza `laute_is_admin()` para autorizar a equipe. O financeiro é copiado da configuração existente, exceto o antigo Pix copia-e-cola, que poderia conter outro valor. Confira os dados financeiros no painel antes de divulgar inscrições.

Sem a atualização, a página informativa e o pôster funcionam, mas o cadastro novo permanece bloqueado. A consulta antiga de Sutura por código/e-mail é preservada durante a transição. Após ativar, ambos os cursos podem ser consultados por nome completo/e-mail; códigos antigos continuam somente internamente para compatibilidade. Nome/e-mail não equivalem a autenticação forte: as consultas retornam apenas dados individuais limitados; não retornam telefone nem observações internas. O painel continua exigindo login autorizado e RLS.

No painel, selecione **Primeiros Socorros** para filtrar/exportar inscrições, conferir pagamento, registrar presença, liberar uma troca de turno, emitir/revogar certificados e configurar curso/turnos. Certificados exigem pagamento conferido/isento, inscrição confirmada, presença, turno realizado após seu término e nomes dos responsáveis preenchidos. O ministrante fica vazio até confirmação. Não há prazo de pagamento automático configurado para o novo curso. A mudança de turno é autorizada uma vez por liberação, com conferência de vagas no servidor.

Não há disparo automático de e-mails neste módulo. Os botões WhatsApp abrem conversas; não enviam mensagens ou comprovantes sozinhos. Inscrições em análise e confirmadas ocupam vagas, canceladas/suspensas as liberam. O banco serializa alterações por curso e registra tentativas idempotentes para evitar duplicação e exceder capacidade.

## Verificação

```sh
npm run prepare:release
npm test
python tests/validate_static.py
```

A validação Python requer `lxml`. Os testes Node não têm dependências externas. Eles verificam filtros, navegação de fotos, URLs permitidas, funcionamento do menu, disponibilidade de recursos e a preservação dos identificadores dos serviços.

O teste adicional PostgreSQL em `tests/database.test.mjs` utiliza PGlite em banco isolado, sem tocar no Supabase real. Para executá-lo, instale `@electric-sql/pglite` fora deste checkout e defina `LAUTE_PGLITE_PATH` com o caminho absoluto do módulo `dist/index.js`. Sem essa variável, apenas esse teste é ignorado.

Os testes de interface `admin-ui.test.mjs` e `participant-ui.test.mjs` usam Happy DOM com serviços fictícios em memória. Para executá-los, instale `happy-dom` fora deste checkout e defina `LAUTE_DOM_PATH` com o caminho absoluto de `happy-dom/lib/index.js`. Eles cobrem cadastro sem duplicação, nova inscrição, consulta por nome/e-mail, troca autorizada, filtros, ações em lote e configurações sem criar registros reais.

As verificações estáticas não substituem uma conferência visual em navegadores reais. Não use testes que criem inscrições ou emitam certificados reais sem autorização específica.
