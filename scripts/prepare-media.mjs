// Otimização mecânica das fotografias enviadas. Sem recortes, retoques ou metadados pessoais.
// Uso: node scripts/prepare-media.mjs /caminho/dos/anexos
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{sharp=require(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp'));}
const input=process.argv[2];if(!input)throw new Error('Informe o diretório dos anexos.');
const output=resolve('assets/photos');mkdirSync(output,{recursive:true});
const mapping={
  '6a884443-8aad-4cbb-8f92-5a068b10da07.jpeg':'turma-sutura',
  'IMG_5064.jpeg':'orientacao-pratica',
  'IMG_5061.jpeg':'aprendizado-bancada',
  'IMG_5060.jpeg':'pratica-supervisionada',
  'IMG_5062.jpeg':'tecnica-sutura',
  'IMG_5065.jpeg':'detalhes-simulacao',
  '00eb84f3-22db-4e93-9094-f2f534788481.jpeg':'equipe-organizacao',
  '3d220387-eb8c-4e71-b66e-cc5adab618b9.jpeg':'equipe-liga',
  '1ed0432c-9122-482d-8d1f-66654bd42223.jpeg':'encontro-laute',
  'IMG_5066.jpeg':'lembranca-curso'
};
for(const [file,name] of Object.entries(mapping)){
  const info=await sharp(resolve(input,file)).rotate().resize({width:1280,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:79,effort:6}).toFile(resolve(output,name+'.webp'));
  console.log(`${name}.webp · ${info.width}×${info.height} · ${(info.size/1024).toFixed(0)} KB`);
}
