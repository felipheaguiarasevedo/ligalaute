// Mantém as duas estruturas de upload existentes sincronizadas e pré-renderiza a navegação.
// O diretório publicado permanece definido em netlify.toml. Não altera dados do Supabase.
import {readFileSync,writeFileSync,readdirSync,copyFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {header,footer,SITE_VERSION,icon} from '../js/site-shell.js';
const pages=readdirSync('.').filter(file=>file.endsWith('.html'));
for(const path of pages){
  let html=readFileSync(path,'utf8');
  if(html.includes('class="s-institutional"')){
    const active=/data-page="([^"]+)"/.exec(html)?.[1]||'';
    html=html.replace(/<div id="site-header">[\s\S]*?<\/div>(?=<main)/,`<div id="site-header">${header(active)}</div>`);
    html=html.replace(/<div id="site-footer">[\s\S]*?<\/div>(?=<(?:noscript|\/body))/,`<div id="site-footer">${footer()}</div>`);
    // As marcações originais são vazias; estas alternativas cobrem quebras de linha.
    html=html.replace('<div id="site-header"></div>',`<div id="site-header">${header(active)}</div>`);
    html=html.replace('<div id="site-footer"></div>',`<div id="site-footer">${footer()}</div>`);
    html=html.replace(/<span data-icon="([a-z-]+)"><\/span>/g,(_,name)=>icon(name));
  }else{
    if(!html.includes('data-official-style'))html=html.replace('</head>',`<link rel="stylesheet" href="site.css?v=${SITE_VERSION}" data-official-style></head>`);
  }
  html=html.replace(/(src="js\/[^"?]+\.js)(?:\?v=[^"]*)?"/g,`$1?v=${SITE_VERSION}"`);
  writeFileSync(path,html);
}
for(const file of readdirSync('js').filter(file=>file.endsWith('.js')&&!file.startsWith('site')&&file!=='media-data.js')){
  const path=join('js',file);let js=readFileSync(path,'utf8');
  js=js.replace(/(['"])(\.\/common\.js)(?:\?v=[^'"]*)?\1/g,`'./common.js?v=${SITE_VERSION}'`);
  writeFileSync(path,js);
}
const publicFiles=[...pages,'styles.css','site.css','config.js','_headers','_redirects','robots.txt','favicon.ico'];
const filesUnder=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesUnder(join(dir,entry.name)):[join(dir,entry.name)]);
publicFiles.push(...filesUnder('js'),...filesUnder('assets'));
for(const path of publicFiles){const target=join('liga laute',path);mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);}
console.log(`Preparadas ${pages.length} páginas; navegação e assets sincronizados para a Netlify.`);
