const JSZip = require("jszip");
const fs = require("fs");

async function listDocxTopics() {
  const docPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - OFICIAL FINALIZADO.docx";
  const zip = await JSZip.loadAsync(fs.readFileSync(docPath));
  const docXml = await zip.file("word/document.xml").async("string");
  const paras = docXml.split('</w:p>');

  console.log("=== TÓPICOS NO ARQUIVO OFICIAL FINALIZADO ===");
  for (let i = 0; i < paras.length; i++) {
    const text = paras[i].replace(/<[^>]+>/g, '').trim();
    if (text.match(/^[1-9]\d*(\.\d+)*\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/) || text.match(/^[1-9]\d*\.\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/) || text.includes("ARQUITETURA") || text.includes("DESIGN") || text.includes("INSERIR") || text.includes("FIGURA") || text.includes("DIAGRAMA")) {
      console.log(`[P${i}] ${text}`);
    }
  }
}

listDocxTopics().catch(console.error);
