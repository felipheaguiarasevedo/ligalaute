# LAUTE — site oficial

Site institucional estático da Liga Acadêmica de Urgência, Trauma e Emergência, com os fluxos de participantes e administração conectados ao Supabase existente.

## Páginas

- `index.html`: início institucional.
- `sobre.html`: identidade, propósito e pilares.
- `cursos.html`: catálogo com filtros de próximos e realizados.
- `sutura.html`: memória e informações da edição de 15/10/2026, com inscrições encerradas.
- `galeria.html`: fotos desta edição e fotos adicionais publicadas pelo painel no Supabase.
- `certificados.html`: orientações de emissão e validação.
- `contato.html`: canais oficiais e localização.
- `consultar.html`, `validar.html`, `admin.html` e `privacidade.html`: serviços existentes preservados.

## Publicação e manutenção

A Netlify está configurada em `netlify.toml` para publicar `liga laute/`. O repositório já continha arquivos também na raiz. Edite a versão da raiz e execute `npm run prepare:release` para sincronizar o espelho publicado, pré-renderizar a navegação e renovar as referências de cache.

O processo não faz migrações nem altera inscrições, pagamentos, permissões ou certificados do Supabase. A configuração pública continua em `config.js`; nunca inclua chaves `service_role`, `sb_secret`, senhas ou tokens no frontend.

`js/media-data.js` contém o acervo fotográfico desta atualização. A galeria também consulta a tabela e o bucket já usados pelo painel. Textos e fotos remotos não são inseridos como HTML.

Não foram anunciados cursos futuros sem confirmação. A edição de sutura permanece no histórico e não exibe formulário para novas inscrições.

## Verificação

```sh
npm run prepare:release
npm test
python tests/validate_static.py
```

A validação Python requer `lxml`. Os testes Node não têm dependências externas. Eles verificam filtros, navegação de fotos, URLs permitidas, funcionamento do menu, disponibilidade de recursos e a preservação dos identificadores dos serviços.

As verificações estáticas não substituem uma conferência visual em navegadores reais. Não use testes que criem inscrições ou emitam certificados reais sem autorização específica.
