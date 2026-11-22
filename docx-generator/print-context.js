const JSZip = require("jszip");
const fs = require("fs");

async function printContext() {
  const docPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - OFICIAL FINALIZADO.docx";
  const zip = await JSZip.loadAsync(fs.readFileSync(docPath));
  const docXml = await zip.file("word/document.xml").async("string");
  const paras = docXml.split('</w:p>');

  console.log("=== CONTEXTO DE 7.6 ARQUITETURA ===");
  for (let i = 320; i <= 330; i++) {
    console.log(`[P${i}] ${paras[i].replace(/<[^>]+>/g, '').trim()}`);
  }

  console.log("\n=== CONTEXTO DE 7.9 DESIGN E A EXPERIÊNCIA DO USUÁRIO ===");
  for (let i = 349; i <= 360; i++) {
    console.log(`[P${i}] ${paras[i].replace(/<[^>]+>/g, '').trim()}`);
  }
}

printContext().catch(console.error);
