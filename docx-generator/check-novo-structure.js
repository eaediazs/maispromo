const JSZip = require("jszip");
const fs = require("fs");

async function checkNovoStructure() {
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";
  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");
  const novoParas = novoXml.split('</w:p>');

  console.log("=== SEÇÕES DO TCC NOVO ===");
  for (let i = 0; i < novoParas.length; i++) {
    const text = novoParas[i].replace(/<[^>]+>/g, '').trim();
    if (text.match(/^[1-9]\d*(\.\d+)*\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/) || text.match(/^[1-9]\d*\.\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/) || text.match(/^REFERÊNCIAS/)) {
      console.log(`[P${i}] ${text}`);
    }
  }
}

checkNovoStructure().catch(console.error);
