const JSZip = require("jszip");
const fs = require("fs");

function genParaId() {
  return Math.random().toString(16).substring(2, 10).toUpperCase().padStart(8, '0');
}
function genTextId() {
  return Math.random().toString(16).substring(2, 10).toUpperCase().padStart(8, '0');
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const referencesList = [
  "ADMINISTRADORES.COM.BR. Funções administrativas: controle. Disponível em: https://www.administradores.com.br/artigos/funcoes-administrativas-controle. Acesso em: 1 jun. 2026.",
  "ANHEMBI MORUMBI. Conceito de administração: entenda o que é e sua importância. Disponível em: https://portal.anhembi.br/blog/conceito-de-administracao/. Acesso em: 1 jun. 2026.",
  "BALDINI, I. et al. Serverless Computing: Current Trends and Open Problems. In: Research Advances in Cloud Computing. Springer, 2017.",
  "CLOUDFLARE. Cloudflare Workers Documentation. Disponível em: https://developers.cloudflare.com/workers/. Acesso em: 22 ago. 2026.",
  "DETERDING, S. et al. From Game Design Elements to Gamefulness: Defining Gamification. In: MindTrek '11: Proceedings of the 15th International Academic MindTrek Conference, 2011.",
  "ESAMC. O que é gestão financeira? Disponível em: https://www.esamc.br/o-que-e-gestao-financeira/. Acesso em: 1 jun. 2026.",
  "FIELDING, Roy Thomas. Architectural Styles and the Design of Network-based Software Architectures. 2000. Tese (Doutorado em Ciência da Computação) – University of California, Irvine, 2000. Disponível em: https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm. Acesso em: 22 ago. 2026.",
  "FIREBASE. Cloud Firestore Documentation. Google Cloud, 2026. Disponível em: https://firebase.google.com/docs/firestore. Acesso em: 22 ago. 2026.",
  "FUNDAÇÃO INSTITUTO DE ADMINISTRAÇÃO (FIA). Peter Drucker: quem foi, conceitos e legado para a administração. Disponível em: https://fia.com.br/blog/peter-drucker/. Acesso em: 1 jun. 2026.",
  "GRASSI, P. A. et al. Digital Identity Guidelines: Authentication and Lifecycle Management. NIST Special Publication 800-63B. Gaithersburg: National Institute of Standards and Technology, 2017. Disponível em: https://pages.nist.gov/800-63-3/sp800-63b.html. Acesso em: 22 ago. 2026.",
  "HTML5-QRCODE. HTML5-QRCode: Cross-platform HTML5 QR Code & Barcode reader. Repositório GitHub, 2026. Disponível em: https://github.com/mebjas/html5-qrcode. Acesso em: 22 ago. 2026.",
  "KRUG, Steve. Don't Make Me Think, Revisited: A Common Sense Approach to Web Usability. 3. ed. San Francisco: New Riders, 2014.",
  "LCM TREINAMENTO. As perspectivas de controle. Disponível em: https://lcmtreinamento.com.br/as-perspectivas-de-controle/. Acesso em: 1 jun. 2026.",
  "NAT ELIASON. Financial Intelligence: Karen Berman e Joe Knight (resumo). Disponível em: https://www-nateliason-com.translate.goog/notes/financial-intelligence-karen-berman-joe-knight. Acesso em: 1 jun. 2026.",
  "NFE.IO. Documentação da API de Consulta e Emissão de Notas Fiscais. Disponível em: https://nfe.io/docs/. Acesso em: 22 ago. 2026.",
  "NIELSEN, Jakob. 10 Usability Heuristics for User Interface Design. Nielsen Norman Group, 1994. Disponível em: https://www.nngroup.com/articles/ten-usability-heuristics/. Acesso em: 22 ago. 2026.",
  "NORMAN, Don. The Design of Everyday Things: Revised and Expanded Edition. New York: Basic Books, 2013.",
  "PENSADOR. Frases de Michael Porter. Disponível em: https://www.pensador.com/frases_de_michael_porter/. Acesso em: 1 jun. 2026.",
  "POLI JÚNIOR. O que são as 5 forças de Porter? Disponível em: https://polijunior.com.br/blog/o-que-sao-5-forcas-de-porter/. Acesso em: 1 jun. 2026.",
  "PRESSMAN, Roger S.; MAXIM, Bruce R. Engenharia de Software: Uma Abordagem Profissional. 8. ed. Porto Alegre: McGraw-Hill / Bookman, 2016.",
  "RD STATION. Marketing: conceito, objetivos e estratégias. Disponível em: https://www.rdstation.com/blog/marketing/marketing/. Acesso em: 1 jun. 2026.",
  "RESEND. Resend Email API Documentation. Disponível em: https://resend.com/docs. Acesso em: 22 ago. 2026.",
  "SADALAGE, Pramod J.; FOWLER, Martin. NoSQL Distilled: A Brief Guide to the Emerging World of Polyglot Persistence. Boston: Addison-Wesley, 2013.",
  "SALESFORCE. O que é marketing? Disponível em: https://www.salesforce.com/br/marketing/what-is-marketing/. Acesso em: 1 jun. 2026.",
  "SANKHYA. Liderança: conceito, importância e características. Disponível em: https://www.sankhya.com.br/gestao-de-negocios/lideranca/. Acesso em: 1 jun. 2026.",
  "SCRIBD. Chiavenato: organização. Disponível em: https://pt.scribd.com/document/680084773/Chiavenato-organizacao. Acesso em: 1 jun. 2026.",
  "SEBRAE SANTA CATARINA. A importância da gestão de pessoas para as empresas. Disponível em: https://www.sebrae-sc.com.br/blog/importancia-da-gestao-de-pessoas. Acesso em: 1 jun. 2026.",
  "SIGNIFICADOS. Organização: significado e conceito. Disponível em: https://www.significados.com.br/organizacao/. Acesso em: 1 jun. 2026.",
  "TRIBUNAL DE JUSTIÇA DE MINAS GERAIS (TJMG). Joel Dutra fala sobre comportamentos e gestão de pessoas. Disponível em: https://www.tjmg.jus.br/portal-tjmg/noticias/joel-dutra-fala-sobre-comportamentos-e-gestao-de-pessoas.htm. Acesso em: 1 jun. 2026.",
  "UNIVERSIDADE FEDERAL DO RIO GRANDE DO NORTE (UFRN). Conceitos básicos de planejamento. Disponível em: https://proplan.ufrn.br/pagina.php?alias=a_conc_bas_plan. Acesso em: 1 jun. 2026."
];

async function updateReferences() {
  const docPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - OFICIAL FINALIZADO.docx";
  const zip = await JSZip.loadAsync(fs.readFileSync(docPath));
  const docXml = await zip.file("word/document.xml").async("string");

  const paras = docXml.split('</w:p>');

  // Encontrar o início do cabeçalho REFERÊNCIAS
  let refHeaderIdx = -1;
  for (let i = 0; i < paras.length; i++) {
    const text = paras[i].replace(/<[^>]+>/g, '').trim();
    if (text === "REFERÊNCIAS" || text === "8. REFERÊNCIAS" || text === "REFERENCIAS") {
      refHeaderIdx = i;
      console.log(`Cabeçalho REFERÊNCIAS encontrado em P${i}`);
      break;
    }
  }

  if (refHeaderIdx === -1) {
    console.error("Não encontrei cabeçalho REFERÊNCIAS!");
    return;
  }

  // Cortar do início até o cabeçalho REFERÊNCIAS (inclusive)
  const partBeforeRefs = paras.slice(0, refHeaderIdx + 1).join('</w:p>') + '</w:p>';

  // Construir parágrafos XML para as 30 referências (formatação ABNT padrão, Arial 12pt, sem negrito no corpo, espaçamento simples com gap entre refs)
  let newRefsXml = '';
  // Linha vazia após o cabeçalho
  newRefsXml += `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr></w:pPr></w:p>`;

  for (const refText of referencesList) {
    newRefsXml += `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto" /><w:jc w:val="both" /><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr><w:t xml:space="preserve">${escapeXml(refText)}</w:t></w:r></w:p>`;
  }

  // Pegar o sectPr do documento original
  const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : '';

  const updatedDocXml = partBeforeRefs + '\n' + newRefsXml + '\n' + sectPr + '</w:body></w:document>';

  zip.file("word/document.xml", updatedDocXml);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  fs.writeFileSync(docPath, buffer);
  console.log(`\n✅ ${referencesList.length} REFERÊNCIAS ATUALIZADAS COM SUCESSO NO ARQUIVO!`);
  console.log(`📁 Arquivo: ${docPath}`);
}

updateReferences().catch(console.error);
