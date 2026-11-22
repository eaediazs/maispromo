const JSZip = require("jszip");
const fs = require("fs");

async function checkFinalRefs() {
  const docPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - OFICIAL FINALIZADO.docx";
  const zip = await JSZip.loadAsync(fs.readFileSync(docPath));
  const docXml = await zip.file("word/document.xml").async("string");
  const paras = docXml.split('</w:p>');

  let inRefs = false;
  let count = 0;
  console.log("=== ÚLTIMOS PARÁGRAFOS DO DOCUMENTO (SEÇÃO REFERÊNCIAS) ===");
  for (let i = 0; i < paras.length; i++) {
    const text = paras[i].replace(/<[^>]+>/g, '').trim();
    if (text === "REFERÊNCIAS" || text === "8. REFERÊNCIAS") {
      inRefs = true;
      console.log(`[P${i}] ${text}`);
      continue;
    }
    if (inRefs && text.length > 0) {
      count++;
      console.log(`[${count}] ${text.substring(0, 90)}...`);
    }
  }
  console.log(`\nTotal de referências contabilizadas: ${count}`);
}

checkFinalRefs().catch(console.error);
