const JSZip = require("jszip");
const fs = require("fs");

async function verifyMerged() {
  const outPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - OFICIAL FINALIZADO.docx";
  const zip = await JSZip.loadAsync(fs.readFileSync(outPath));
  const xml = await zip.file("word/document.xml").async("string");
  const paras = xml.split('</w:p>');

  console.log(`Documento unificado gerado com ${paras.length} blocos/parágrafos.`);

  console.log("\n=== TÓPICOS ENCONTRADOS NO ARQUIVO FINAL ===");
  for (let i = 0; i < paras.length; i++) {
    const text = paras[i].replace(/<[^>]+>/g, '').trim();
    if (text.match(/^[1-9]\d*(\.\d+)*\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/) || text.match(/^[1-9]\d*\.\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/) || text.match(/^REFERÊNCIAS/) || text.match(/^RESUMO/)) {
      console.log(`[P${i}] ${text}`);
    }
  }

  console.log("\n=== TRANSIÇÃO EXATA ENTRE OS DOIS DOCUMENTOS ===");
  for (let i = 228; i <= 238 && i < paras.length; i++) {
    const text = paras[i].replace(/<[^>]+>/g, '').trim();
    console.log(`[P${i}] ${text}`);
  }
}

verifyMerged().catch(console.error);
