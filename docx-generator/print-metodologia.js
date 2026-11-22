const JSZip = require("jszip");
const fs = require("fs");

async function printMetodologia() {
  const docPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - OFICIAL FINALIZADO.docx";
  const zip = await JSZip.loadAsync(fs.readFileSync(docPath));
  const docXml = await zip.file("word/document.xml").async("string");
  const paras = docXml.split('</w:p>');

  console.log("=== TÓPICOS DA METODOLOGIA ===");
  for (let i = 179; i <= 233; i++) {
    const text = paras[i].replace(/<[^>]+>/g, '').trim();
    if (text.startsWith("5.") || text.startsWith("Etapa") || text.includes("Etapa") || text.includes("FIGURA") || text.includes("DIAGRAMA")) {
      console.log(`[P${i}] ${text}`);
    }
  }
}

printMetodologia().catch(console.error);
