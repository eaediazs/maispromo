const JSZip = require("jszip");
const fs = require("fs");

async function checkPageBreaks() {
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";
  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");
  const novoParas = novoXml.split('</w:p>');

  let page = 1;
  for (let i = 0; i < novoParas.length; i++) {
    const p = novoParas[i];
    const text = p.replace(/<[^>]+>/g, '').trim();
    
    // Check page breaks in this paragraph
    const breaks = (p.match(/<w:br[^>]*w:type="page"[^>]*>/g) || []).length;
    const sectBreaks = (p.match(/<w:sectPr/g) || []).length;
    
    if (text.length > 0) {
      if (text.startsWith("6.") || text.startsWith("5.") || text.startsWith("7.") || text.startsWith("8.") || text.startsWith("9.") || text.startsWith("10.") || text.startsWith("11.") || text.startsWith("12.") || text.startsWith("REFERÊNCIAS")) {
        console.log(`[P${i} | ~Page ${page}] ${text.substring(0, 60)}`);
      }
    }
    
    page += breaks;
  }
  
  console.log(`Total page breaks found: ${page}`);
}

checkPageBreaks().catch(console.error);
