const JSZip = require("jszip");
const fs = require("fs");

async function checkLengths() {
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";
  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");
  const novoParas = novoXml.split('</w:p>');

  let totalChars = 0;
  for (let i = 0; i < novoParas.length; i++) {
    const text = novoParas[i].replace(/<[^>]+>/g, '').trim();
    totalChars += text.length;
    if (i === 232) {
      console.log(`At P232 (end of 5.6): ${totalChars} chars (~${Math.round(totalChars/1800)} pages)`);
    }
    if (i === 253) {
      console.log(`At P253 (6. DESENVOLVIMENTO): ${totalChars} chars (~${Math.round(totalChars/1800)} pages)`);
    }
    if (i === 481) {
      console.log(`At P481 (6. CARACTERIZAÇÃO DA EMPRESA): ${totalChars} chars (~${Math.round(totalChars/1800)} pages)`);
    }
  }
  console.log(`Total: ${totalChars} chars (~${Math.round(totalChars/1800)} pages)`);
}

checkLengths().catch(console.error);
