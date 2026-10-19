"""Validação de estrutura HTML, referências, recursos e espelho publicado — sem alterar dados reais."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import Counter
import re
from lxml import html

root = Path(__file__).resolve().parent.parent
issues = []
documents = {}
for file in root.glob('*.html'):
    documents[file.name] = html.fromstring(file.read_text())

for filename, doc in documents.items():
    if len(doc.xpath('//main[@id="conteudo"]')) != 1:
        issues.append(f'{filename}: marco principal ausente ou duplicado')
    for node in doc.xpath('//*[@id]'):
        identifier = node.get('id')
        if len(doc.xpath('//*[@id=$value]', value=identifier)) > 1:
            issues.append(f'{filename}: id duplicado: {identifier}')
    # O painel existente tem títulos separados para login e sessão autenticada.
    if filename != 'admin.html' and len(doc.xpath('//h1')) != 1:
        issues.append(f'{filename}: deve haver um único h1')
    if not doc.xpath('//html[@lang="pt-BR"]'):
        issues.append(f'{filename}: idioma ausente')
    for element in doc.xpath('//*[@src] | //*[@href]'):
        attr = 'src' if element.get('src') is not None else 'href'
        value = element.get(attr)
        if not value or value.startswith(('http:', 'https:', 'data:', 'mailto:', 'tel:', 'blob:')):
            continue
        parsed = urlsplit(value)
        local_path = unquote(parsed.path).lstrip('/') or filename
        target = root / local_path
        if not target.exists():
            issues.append(f'{filename}: recurso não encontrado: {value}')
        if parsed.fragment and local_path in documents and 'galeria' not in local_path:
            if not documents[local_path].xpath('//*[@id=$value]', value=unquote(parsed.fragment)):
                issues.append(f'{filename}: âncora ausente: {value}')
    for image in doc.xpath('//img'):
        if image.get('alt') is None:
            issues.append(f'{filename}: imagem sem texto alternativo')
    for link in doc.xpath('//a[@target="_blank"]'):
        if 'noopener' not in (link.get('rel') or ''):
            issues.append(f'{filename}: link externo sem noopener')
    for node in doc.xpath('//*[@aria-controls] | //*[@aria-labelledby]'):
        for attr in ('aria-controls', 'aria-labelledby'):
            for value in (node.get(attr) or '').split():
                if not doc.xpath('//*[@id=$value]', value=value):
                    issues.append(f'{filename}: referência de acessibilidade ausente: {value}')
    if doc.get('class') != 's-institutional' and doc.xpath('//body[contains(@class,"s-institutional")]'):
        if not doc.xpath('//*[@id="site-header"]//nav'):
            issues.append(f'{filename}: navegação institucional não foi pré-renderizada')

for file in (root / 'js').glob('*.js'):
    for spec in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]", file.read_text()):
        if spec.startswith('.') and not (file.parent / urlsplit(spec).path).exists():
            issues.append(f'{file.name}: importação não encontrada: {spec}')

css = (root / 'site.css').read_text()
stripped = re.sub(r'/\*[\s\S]*?\*/', '', css)
if stripped.count('{') != stripped.count('}'):
    issues.append('site.css: blocos de estilo desequilibrados')
for width in ('1200px', '1080px', '760px', '370px'):
    if f'max-width:{width}' not in css:
        issues.append(f'site.css: breakpoint esperado ausente: {width}')
if 'prefers-reduced-motion:reduce' not in css:
    issues.append('site.css: opção de movimento reduzido ausente')

public = [*root.glob('*.html'), root/'site.css', root/'_headers', root/'_redirects', *(root/'js').glob('*.js'), *(root/'assets/photos').glob('*.webp')]
for file in public:
    mirror = root/'liga laute'/file.relative_to(root)
    if not mirror.exists() or mirror.read_bytes() != file.read_bytes():
        issues.append(f'espelho Netlify divergente: {file.relative_to(root)}')

for issue in sorted(set(issues)):
    print('ERRO:', issue)
if issues:
    raise SystemExit(1)
print(f'OK: {len(documents)} páginas, links locais, âncoras, IDs, recursos, ARIA e espelho Netlify.')
print('OK: breakpoints 370/760/1080/1200 px e opção de movimento reduzido presentes.')
print('Limite: validação estática; não substitui inspeção visual em navegador.')
