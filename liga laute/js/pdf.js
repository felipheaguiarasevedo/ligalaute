import {download} from './common.js';
export async function certificatePDF(c){
  if(!c?.valid)throw new Error('Certificado não está disponível ou foi revogado.');
  if(!window.PDFLib)throw new Error('Não foi possível carregar o gerador de PDF. Atualize a página.');
  const {PDFDocument,rgb,degrees}=window.PDFLib;
  const preview=c.preview===true;
  if(!window.fontkit)throw new Error('Não foi possível carregar as fontes do certificado. Atualize a página.');
  const doc=await PDFDocument.create(),page=doc.addPage([841.89,595.28]);
  doc.registerFontkit(window.fontkit);
  const fontBytes=await Promise.all(['regular','bold'].map(name=>fetch(`assets/fonts/${name}.ttf`).then(r=>{if(!r.ok)throw new Error('Fontes do certificado indisponíveis.');return r.arrayBuffer();})));
  const regular=await doc.embedFont(fontBytes[0],{subset:true}),bold=await doc.embedFont(fontBytes[1],{subset:true});
  const navy=rgb(.04,.13,.23),red=rgb(.64,.1,.2),gray=rgb(.35,.43,.51),light=rgb(.88,.91,.94);
  const safe=t=>String(t??'').normalize('NFC').replace(/[\u2010-\u2015]/g,'-').replace(/[\x00-\x1f\x7f]/g,' ');
  const markPreview=()=>{
    const label='PREVIA DE TESTE - SEM VALIDADE';
    page.drawText(label,{x:175,y:275,size:29,font:bold,color:rgb(.65,.05,.10),rotate:degrees(12),opacity:.24});
    page.drawText('DOCUMENTO DE TESTE - NAO E CERTIFICADO VALIDO',{x:290,y:42,size:7.5,font:bold,color:rgb(.65,.05,.10)});
  };
  const center=(t,y,size=12,font=regular,color=navy)=>{t=safe(t);page.drawText(t,{x:(841.89-font.widthOfTextAtSize(t,size))/2,y,size,font,color});};
  const wrap=(text,maxWidth,font,size)=>{const tokens=[];for(const word of safe(text).split(/\s+/)){let part='';for(const char of word){if(font.widthOfTextAtSize(part+char,size)>maxWidth&&part){tokens.push(part);part='';}part+=char;}if(part)tokens.push(part);}const lines=[];let line='';for(const word of tokens){const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)>maxWidth&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;};
  // Certificado do minicurso de 15/10/2026: usa o modelo oficial entregue pela LAUTE.
  // Para outros eventos, permanece o modelo dinâmico existente.
  const modelSutura2026=/sutura/i.test(String(c.title||''))&&/2026/.test(String(c.date||''))&&Number(c.hours)===6;
  if(modelSutura2026){
    const source=await fetch('assets/certificado-modelo-sutura-2026.png').then(r=>{if(!r.ok)throw new Error('Modelo do certificado indisponível.');return r.arrayBuffer();});
    const background=await doc.embedPng(source);
    page.drawImage(background,{x:0,y:0,width:841.89,height:595.28});
    let fs=31,lines=[];
    for(;fs>=17;fs--){lines=wrap(c.full_name,620,bold,fs);if(lines.length<=2)break;}
    if(lines.length>2)throw new Error('O nome está muito longo para o modelo. Contate a organização para corrigir.');
    const nameColor=rgb(.08,.1,.2),startY=lines.length===1?277:287;
    lines.forEach((line,i)=>center(line,startY-i*30,fs,bold,nameColor));
    // Código de autenticidade e QR de verificação: mantidos sem encobrir o nome ou assinatura.
    const verifyURL=new URL(`validar.html?id=${encodeURIComponent(c.id)}`,document.baseURI).href;
    if(window.qrcode){
      const qr=window.qrcode(0,'M');qr.addData(verifyURL);qr.make();
      const count=qr.getModuleCount(),box=49,unit=box/(count+8),left=89,bottom=71;
      page.drawRectangle({x:left,y:bottom,width:box,height:box,color:rgb(1,1,1)});
      for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))page.drawRectangle({x:left+(col+4)*unit,y:bottom+(count+3-row)*unit,width:unit,height:unit,color:rgb(0,0,0)});
    }
    const verificationSite=new URL('validar.html',document.baseURI);
    page.drawText('Validação: '+safe(verificationSite.hostname)+'/validar',{x:146,y:103,size:7,font:regular,color:rgb(.20,.24,.35)});
    page.drawText('Código de validação:',{x:146,y:90,size:7,font:regular,color:rgb(.20,.24,.35)});
    page.drawText(safe(c.id),{x:146,y:79,size:7,font:regular,color:rgb(.20,.24,.35)});
    if(preview)markPreview();
    doc.setTitle(`${preview?'PREVIA SEM VALIDADE - ':''}Certificado LAUTE - ${safe(c.full_name)}`);doc.setAuthor('LAUTE e Estácio');doc.setSubject('Mini Curso de Sutura Simples - 15/10/2026');
    download(await doc.save(),`${preview?'PREVIA_SEM_VALIDADE':'Certificado'}_LAUTE_${safe(c.full_name).replace(/[^A-Za-z0-9]+/g,'_')}.pdf`,'application/pdf');
    return;
  }
  page.drawRectangle({x:0,y:0,width:20,height:595.28,color:navy});page.drawRectangle({x:20,y:0,width:6,height:595.28,color:red});page.drawRectangle({x:43,y:25,width:768,height:545,borderColor:light,borderWidth:1});
  const logo=await fetch('assets/laute-logo.jpeg').then(r=>{if(!r.ok)throw new Error('Logo indisponível.');return r.arrayBuffer();});const image=await doc.embedJpg(logo);page.drawImage(image,{x:378,y:453,width:86,height:71.5});
  center('LIGA ACADÊMICA DE URGÊNCIA, TRAUMA E EMERGÊNCIA',432,10,bold);center('CERTIFICADO',379,36,bold);center('DE PARTICIPAÇÃO EM CURSO DE EXTENSÃO',356,11,regular,gray);
  center('A LAUTE certifica que',319,13);
  let nameSize=28;while(bold.widthOfTextAtSize(safe(c.full_name),nameSize)>660&&nameSize>16)nameSize--;
  const nameLines=wrap(c.full_name,660,bold,nameSize);let y=278;nameLines.forEach(line=>{center(line,y,nameSize,bold);y-=nameSize+5;});
  y-=9;const paragraph=`participou do ${c.title}, ministrado por ${c.instructor}, em ${c.date}${c.session_label?`, no turno ${c.session_label.toLowerCase()} (${c.time})`:''}, com carga horária de ${Number(c.hours).toLocaleString('pt-BR')} horas de atividades extracurriculares.`;
  wrap(paragraph,650,regular,14).forEach(line=>{center(line,y,14);y-=21;});
  const signatures=[{x:245,name:c.signer_name,role:c.signer_role},{x:602,name:c.coordinator_name,role:c.coordinator_role}];
  for(const s of signatures){page.drawLine({start:{x:s.x-115,y:137},end:{x:s.x+115,y:137},thickness:.7,color:gray});let fs=11;while(bold.widthOfTextAtSize(safe(s.name),fs)>240&&fs>7)fs--;const text=safe(s.name);page.drawText(text,{x:s.x-bold.widthOfTextAtSize(text,fs)/2,y:120,size:fs,font:bold,color:navy});const role=safe(s.role);page.drawText(role,{x:s.x-regular.widthOfTextAtSize(role,9)/2,y:105,size:9,font:regular,color:gray});}
  const url=new URL(`validar.html?id=${c.id}`,document.baseURI).href;
  if(window.qrcode){const qr=window.qrcode(0,'M');qr.addData(url);qr.make();const count=qr.getModuleCount(),unit=56/(count+8);page.drawRectangle({x:59,y:39,width:56,height:56,color:rgb(1,1,1)});for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))page.drawRectangle({x:59+(col+4)*unit,y:39+(count+3-row)*unit,width:unit,height:unit,color:rgb(0,0,0)});}
  page.drawText('Valide a autenticidade pelo QR Code ou no endereço do site:',{x:130,y:77,size:8,font:regular,color:gray});
  const shortURL=new URL('validar.html',document.baseURI).href;let urlSize=8;while(regular.widthOfTextAtSize(safe(shortURL),urlSize)>620&&urlSize>5)urlSize--;
  page.drawText(safe(shortURL),{x:130,y:63,size:urlSize,font:regular,color:navy});page.drawText(`Código: ${c.id}`,{x:130,y:49,size:8,font:regular,color:gray});
  center('Atividade de extensão. Não confere habilitação profissional nem autoriza suturas em pacientes.',32,7,regular,gray);
  if(preview)markPreview();
  doc.setTitle(`${preview?'PREVIA SEM VALIDADE - ':''}Certificado - ${c.full_name}`);doc.setAuthor('LAUTE');doc.setSubject('Participação em curso de extensão');
  download(await doc.save(),`${preview?'PREVIA_SEM_VALIDADE':'Certificado'}_LAUTE_${safe(c.full_name).replace(/[^A-Za-z0-9]+/g,'_')}.pdf`,'application/pdf');
}
