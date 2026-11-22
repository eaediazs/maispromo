const JSZip = require("jszip");
const fs = require("fs");

async function checkP450() {
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";
  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");
  const novoParas = novoXml.split('</w:p>');

  console.log("=== P440 a P490 em TCC NOVO ===");
  for (let i = 440; i <= 490 && i < novoParas.length; i++) {
    const text = novoParas[i].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      console.log(`[P${i}] ${text}`);
    }
  }
}

checkP450().catch(console.error);
