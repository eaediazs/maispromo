// Script para inspecionar a formatação XML do .docx existente
const JSZip = require("jszip");
const fs = require("fs");

async function inspect() {
  const docxPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo (MaisPromo) 3° ADM (2).docx";
  const data = fs.readFileSync(docxPath);
  const zip = await JSZip.loadAsync(data);

  // Listar todos os arquivos no ZIP
  console.log("=== ARQUIVOS NO DOCX ===");
  zip.forEach((path, file) => {
    console.log(`  ${path} (${file.dir ? 'DIR' : 'FILE'})`);
  });

  // Ler o document.xml
  const docXml = await zip.file("word/document.xml").async("string");
  
  // Salvar para inspeção
  fs.writeFileSync("C:\\Users\\lipwc\\Downloads\\+ Promo\\docx-generator\\document_inspect.xml", docXml, "utf-8");
  console.log("\n=== document.xml salvo para inspeção ===");
  console.log("Tamanho:", docXml.length, "caracteres");
  
  // Mostrar os últimos 3000 caracteres (final do documento) para ver onde inserir
  console.log("\n=== FINAL DO DOCUMENTO (ultimos 3000 chars) ===");
  console.log(docXml.slice(-3000));

  // Mostrar os primeiros 3000 para ver namespaces
  console.log("\n=== INICIO DO DOCUMENTO (primeiros 2000 chars) ===");
  console.log(docXml.slice(0, 2000));

  // Tentar encontrar estilos de heading usados
  const headingMatches = docXml.match(/w:pStyle w:val="([^"]+)"/g);
  if (headingMatches) {
    const unique = [...new Set(headingMatches)];
    console.log("\n=== ESTILOS DE PARÁGRAFO ENCONTRADOS ===");
    unique.forEach(m => console.log("  " + m));
  }

  // Encontrar fontes usadas
  const fontMatches = docXml.match(/w:rFonts[^/]* w:ascii="([^"]+)"/g);
  if (fontMatches) {
    const unique = [...new Set(fontMatches)];
    console.log("\n=== FONTES ENCONTRADAS ===");
    unique.forEach(m => console.log("  " + m));
  }

  // Encontrar tamanhos de fonte
  const sizeMatches = docXml.match(/<w:sz w:val="(\d+)"\/>/g);
  if (sizeMatches) {
    const unique = [...new Set(sizeMatches)];
    console.log("\n=== TAMANHOS DE FONTE (half-points) ===");
    unique.forEach(m => console.log("  " + m));
  }
  
  // Ler styles.xml se existir
  const stylesFile = zip.file("word/styles.xml");
  if (stylesFile) {
    const stylesXml = await stylesFile.async("string");
    fs.writeFileSync("C:\\Users\\lipwc\\Downloads\\+ Promo\\docx-generator\\styles_inspect.xml", stylesXml, "utf-8");
    console.log("\n=== styles.xml salvo ===");
    console.log("Tamanho:", stylesXml.length, "caracteres");
  }
}

inspect().catch(console.error);
