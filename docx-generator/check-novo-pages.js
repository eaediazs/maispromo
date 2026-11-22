const JSZip = require("jszip");
const fs = require("fs");

async function checkNovoPages() {
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";
  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");
  const novoParas = novoXml.split('</w:p>');

  console.log("=== P250 a P260 ===");
  for (let i = 250; i <= 260; i++) {
    console.log(`[P${i}] ${novoParas[i].replace(/<[^>]+>/g, '')}`);
  }

  console.log("\n=== P478 a P488 ===");
  for (let i = 478; i <= 488; i++) {
    console.log(`[P${i}] ${novoParas[i].replace(/<[^>]+>/g, '')}`);
  }
}

checkNovoPages().catch(console.error);
