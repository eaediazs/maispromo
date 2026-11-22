const JSZip = require("jszip");
const fs = require("fs");

async function detailInspect() {
  const origPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC ORIGINAL.docx";
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";

  const origZip = await JSZip.loadAsync(fs.readFileSync(origPath));
  const origXml = await origZip.file("word/document.xml").async("string");
  const origParas = origXml.split('</w:p>');

  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");
  const novoParas = novoXml.split('</w:p>');

  console.log("=== TCC ORIGINAL: Parágrafos 225 a 250 ===");
  for (let i = 225; i <= 250 && i < origParas.length; i++) {
    const text = origParas[i].replace(/<[^>]+>/g, '').trim();
    console.log(`[ORIG P${i}] ${text}`);
  }

  console.log("\n=== TCC NOVO: Parágrafos 245 a 270 ===");
  for (let i = 245; i <= 270 && i < novoParas.length; i++) {
    const text = novoParas[i].replace(/<[^>]+>/g, '').trim();
    console.log(`[NOVO P${i}] ${text}`);
  }

  console.log("\n=== TCC NOVO: Parágrafos 475 a 500 ===");
  for (let i = 475; i <= 500 && i < novoParas.length; i++) {
    const text = novoParas[i].replace(/<[^>]+>/g, '').trim();
    console.log(`[NOVO P${i}] ${text}`);
  }
}

detailInspect().catch(console.error);
