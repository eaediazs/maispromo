const JSZip = require("jszip");
const fs = require("fs");

async function analyzeDocs() {
  const origPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC ORIGINAL.docx";
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";

  console.log("=== LENDO TCC ORIGINAL ===");
  const origZip = await JSZip.loadAsync(fs.readFileSync(origPath));
  const origXml = await origZip.file("word/document.xml").async("string");

  console.log("=== LENDO TCC NOVO ===");
  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");

  // Quebrar em parágrafos
  const origParas = origXml.split('</w:p>');
  console.log(`TCC ORIGINAL tem ${origParas.length} blocos/parágrafos.`);

  const novoParas = novoXml.split('</w:p>');
  console.log(`TCC NOVO tem ${novoParas.length} blocos/parágrafos.`);

  // Procurar por "5.6 Síntese Metodológica" ou "5.6" no TCC ORIGINAL
  console.log("\nBuscando '5.6' ou 'Síntese' no TCC ORIGINAL:");
  for (let i = 0; i < origParas.length; i++) {
    const text = origParas[i].replace(/<[^>]+>/g, '').trim();
    if (text.includes("5.6") || text.includes("Síntese Metodológica") || text.includes("Sintese Metodologica")) {
      console.log(`[ORIG P${i}] ${text.substring(0, 100)}...`);
    }
  }

  // Listar os últimos parágrafos do TCC ORIGINAL
  console.log("\nÚltimos 10 parágrafos com texto do TCC ORIGINAL:");
  let count = 0;
  for (let i = origParas.length - 1; i >= 0 && count < 10; i--) {
    const text = origParas[i].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      console.log(`[ORIG P${i}] ${text.substring(0, 100)}`);
      count++;
    }
  }

  // Procurar por "6. DESENVOLVIMENTO" ou "6." no TCC NOVO
  console.log("\nBuscando '6. DESENVOLVIMENTO' ou '6.' no TCC NOVO:");
  for (let i = 0; i < novoParas.length; i++) {
    const text = novoParas[i].replace(/<[^>]+>/g, '').trim();
    if (text.includes("6. DESENVOLVIMENTO") || text.includes("6. DESENVOLVIMENTO") || text.match(/^6\.\s/)) {
      console.log(`[NOVO P${i}] ${text.substring(0, 100)}...`);
    }
  }

  // Verificar mídias e relações em ambos
  console.log("\nMídias no TCC ORIGINAL:");
  origZip.forEach((path) => {
    if (path.startsWith("word/media/") || path.startsWith("media/")) console.log("  " + path);
  });

  console.log("\nMídias no TCC NOVO:");
  novoZip.forEach((path) => {
    if (path.startsWith("word/media/") || path.startsWith("media/")) console.log("  " + path);
  });
}

analyzeDocs().catch(console.error);
