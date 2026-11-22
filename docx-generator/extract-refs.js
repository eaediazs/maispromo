const JSZip = require("jszip");
const fs = require("fs");

async function extractRefs() {
  const docxPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo (MaisPromo) 3° ADM (2).docx";
  const data = fs.readFileSync(docxPath);
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file("word/document.xml").async("string");

  // Extrair todo o texto do documento
  const textParts = [];
  const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
  let match;
  let currentParagraph = '';
  
  // Split by paragraphs first
  const paragraphs = docXml.split('</w:p>');
  
  let inRefs = false;
  const refs = [];
  
  for (const para of paragraphs) {
    // Extract all text from this paragraph
    let paraText = '';
    const tRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(para)) !== null) {
      paraText += tMatch[1];
    }
    
    paraText = paraText.trim();
    
    if (!paraText) continue;
    
    // Detect start of references section
    if (paraText.match(/^REFERÊNCIAS$/i) || paraText.match(/^8\.\s*REFERÊNCIAS$/i) || paraText === 'REFERÊNCIAS') {
      inRefs = true;
      console.log("=== ENCONTREI SEÇÃO DE REFERÊNCIAS ===\n");
      continue;
    }
    
    if (inRefs && paraText.length > 10) {
      refs.push(paraText);
    }
  }
  
  console.log("Total de referências encontradas:", refs.length);
  console.log("\n=== REFERÊNCIAS DO DOCUMENTO ORIGINAL ===\n");
  refs.forEach((r, i) => {
    console.log(`[${i+1}] ${r}`);
    console.log('');
  });
}

extractRefs().catch(console.error);
