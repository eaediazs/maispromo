/**
 * Script CORRIGIDO para injetar conteúdo no .docx oficial do TCC +Promo
 * 
 * Regras aplicadas:
 * 1. Cabeçalhos: Arial Bold 12pt, NEGRITO
 * 2. SEM travessões nas listas (texto direto)
 * 3. SEM negrito no corpo do texto (apenas cabeçalhos são bold)
 * 4. SEM páginas em branco entre tópicos (sem page breaks)
 * 5. SEM recuo de primeira linha nos parágrafos
 */

const JSZip = require("jszip");
const fs = require("fs");

// =====================================================
// GERADOR DE XML
// =====================================================

function genParaId() {
  return Math.random().toString(16).substring(2, 10).toUpperCase().padStart(8, '0');
}
function genTextId() {
  return Math.random().toString(16).substring(2, 10).toUpperCase().padStart(8, '0');
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Parágrafo de corpo — SEM recuo, SEM negrito
 */
function bodyXml(text) {
  const runs = parseRuns(text, false); // false = sem negrito
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /></w:pPr>${runs}</w:p>`;
}

/**
 * Parágrafo vazio
 */
function emptyXml() {
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr></w:pPr></w:p>`;
}

/**
 * Cabeçalho principal — Arial Bold 12pt (24 half-points)
 */
function heading1Xml(text) {
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:b /><w:bCs /><w:sz w:val="24" /><w:szCs w:val="24" /></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:b /><w:bCs /><w:sz w:val="24" /><w:szCs w:val="24" /></w:rPr><w:t xml:space="preserve">${escapeXml(text.toUpperCase())}</w:t></w:r></w:p>`;
}

/**
 * Subcabeçalho — Arial Bold 12pt
 */
function heading2Xml(text) {
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:b /><w:bCs /><w:sz w:val="24" /><w:szCs w:val="24" /></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:b /><w:bCs /><w:sz w:val="24" /><w:szCs w:val="24" /></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Sub-subcabeçalho — Arial Bold 12pt
 */
function heading3Xml(text) {
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:b /><w:bCs /><w:sz w:val="24" /><w:szCs w:val="24" /></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:b /><w:bCs /><w:sz w:val="24" /><w:szCs w:val="24" /></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Item de lista — SEM travessão, SEM negrito
 */
function listItemXml(text) {
  const runs = parseRuns(text, false);
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /></w:pPr>${runs}</w:p>`;
}

/**
 * Referência bibliográfica
 */
function referenceXml(text) {
  const runs = parseRuns(text, false);
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto" /><w:jc w:val="both" /></w:pPr>${runs}</w:p>`;
}

/**
 * Lista numerada — SEM negrito
 */
function numberedItemXml(num, text) {
  const runs = parseRuns(text, false);
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto" /><w:jc w:val="both" /></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr><w:t xml:space="preserve">${num}. </w:t></w:r>${runs}</w:p>`;
}

/**
 * Bloco de código / fluxograma
 */
function codeBlockXml(text) {
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="120" w:before="120" w:line="240" w:lineRule="auto" /><w:jc w:val="center" /><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="4" w:color="999999"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5" /></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New" /><w:sz w:val="20" /><w:szCs w:val="20" /><w:color w:val="333333" /></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Marcação de inserção
 */
function insertionMarkXml(text) {
  return `<w:p w14:paraId="${genParaId()}" w14:textId="${genTextId()}"><w:pPr><w:spacing w:after="120" w:before="120" w:line="360" w:lineRule="auto" /><w:jc w:val="center" /><w:pBdr><w:top w:val="dashed" w:sz="4" w:space="4" w:color="CC0000"/><w:left w:val="dashed" w:sz="4" w:space="4" w:color="CC0000"/><w:bottom w:val="dashed" w:sz="4" w:space="4" w:color="CC0000"/><w:right w:val="dashed" w:sz="4" w:space="4" w:color="CC0000"/></w:pBdr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:i /><w:color w:val="CC0000" /></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

// =====================================================
// PARSE INLINE — SEM NEGRITO no corpo (bold ignorado)
// =====================================================

function parseRuns(text, allowBold) {
  let result = '';
  // Strip markdown bold/italic markers and render as plain text
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // ***bold italic*** → just italic (no bold in body)
      if (allowBold) {
        result += `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:b /><w:i /></w:rPr><w:t xml:space="preserve">${escapeXml(match[2])}</w:t></w:r>`;
      } else {
        result += `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:i w:val="1" /><w:iCs w:val="1" /></w:rPr><w:t xml:space="preserve">${escapeXml(match[2])}</w:t></w:r>`;
      }
    } else if (match[3]) {
      // **bold** → plain text (no bold in body)
      result += `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr><w:t xml:space="preserve">${escapeXml(match[3])}</w:t></w:r>`;
    } else if (match[4]) {
      // *italic*
      result += `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /><w:i w:val="1" /><w:iCs w:val="1" /></w:rPr><w:t xml:space="preserve">${escapeXml(match[4])}</w:t></w:r>`;
    } else if (match[5]) {
      // `code` → plain text (no special font)
      result += `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr><w:t xml:space="preserve">${escapeXml(match[5])}</w:t></w:r>`;
    } else if (match[6]) {
      // plain text
      result += `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr><w:t xml:space="preserve">${escapeXml(match[6])}</w:t></w:r>`;
    }
  }

  if (!result) {
    result = `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial" /></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }

  return result;
}

// =====================================================
// MARKDOWN → XML (sem page breaks, sem travessões, sem recuo)
// =====================================================

function markdownToXml(mdContent) {
  const lines = mdContent.split("\n");
  let xmlParts = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inReferences = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        xmlParts.push(codeBlockXml(codeLines.join("  >  ")));
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(trimmed);
      continue;
    }

    if (trimmed === "") continue;

    // --- separators → just an empty line (NO page break)
    if (trimmed === "---") {
      xmlParts.push(emptyXml());
      continue;
    }

    // References section
    if (trimmed.match(/^#{1,2}\s+REFERÊNCIAS/i)) {
      inReferences = true;
      xmlParts.push(emptyXml());
      xmlParts.push(heading1Xml("REFERÊNCIAS"));
      xmlParts.push(emptyXml());
      continue;
    }

    // # Heading 1 → NO page break, just empty line + heading
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      const text = trimmed.replace(/^#\s+/, "");
      inReferences = false;
      xmlParts.push(emptyXml());
      xmlParts.push(heading1Xml(text));
      xmlParts.push(emptyXml());
      continue;
    }

    // ## Heading 2
    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^##\s+/, "");
      if (text.match(/REFERÊNCIAS/i)) {
        inReferences = true;
        xmlParts.push(emptyXml());
        xmlParts.push(heading1Xml("REFERÊNCIAS"));
        xmlParts.push(emptyXml());
      } else {
        xmlParts.push(emptyXml());
        xmlParts.push(heading2Xml(text));
        xmlParts.push(emptyXml());
      }
      continue;
    }

    // ### Heading 3
    if (trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^###\s+/, "");
      xmlParts.push(heading3Xml(text));
      continue;
    }

    // Insertion marks
    if (trimmed.match(/^\`?\[INSERIR .+?\]\`?$/)) {
      const clean = trimmed.replace(/`/g, "").replace(/^\[/, "").replace(/\]$/, "");
      xmlParts.push(insertionMarkXml(clean));
      continue;
    }

    // References list
    if (inReferences && trimmed.startsWith("- ")) {
      const text = trimmed.replace(/^-\s+/, "");
      xmlParts.push(referenceXml(text));
      continue;
    }

    // Bullet list → SEM travessão, texto direto
    if (trimmed.match(/^[-*]\s+/)) {
      const text = trimmed.replace(/^[-*]\s+/, "");
      xmlParts.push(listItemXml(text));
      continue;
    }

    // Numbered list
    if (trimmed.match(/^\d+\.\s+/)) {
      const text = trimmed.replace(/^\d+\.\s+/, "");
      const num = trimmed.match(/^(\d+)\./)[1];
      xmlParts.push(numberedItemXml(num, text));
      continue;
    }

    // Body paragraph — SEM recuo
    xmlParts.push(bodyXml(trimmed));
  }

  return xmlParts.join("");
}

// =====================================================
// MAIN
// =====================================================

async function injectIntoDocx() {
  const sourcePath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo (MaisPromo) 3° ADM (2).docx";
  const mdPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - Reestruturado.md";
  const outputPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo (MaisPromo) 3° ADM - COMPLETO.docx";

  console.log("1. Lendo documento .docx oficial...");
  const docxData = fs.readFileSync(sourcePath);
  const zip = await JSZip.loadAsync(docxData);

  console.log("2. Lendo Markdown com conteudo novo...");
  const mdContent = fs.readFileSync(mdPath, "utf-8");

  console.log("3. Convertendo Markdown para XML Word...");
  const newXml = markdownToXml(mdContent);

  console.log("4. Injetando conteudo no documento...");
  let docXml = await zip.file("word/document.xml").async("string");

  // Encontrar o sectPr (último elemento do body)
  const sectPrMatch = docXml.match(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/);
  if (!sectPrMatch) {
    console.error("ERRO: Nao encontrei <w:sectPr> no documento!");
    return;
  }

  const sectPr = sectPrMatch[0];
  const insertPoint = docXml.lastIndexOf(sectPr);

  if (insertPoint === -1) {
    console.error("ERRO: Nao consegui encontrar o ponto de insercao!");
    return;
  }

  const beforeInsert = docXml.substring(0, insertPoint);
  const afterInsert = docXml.substring(insertPoint);

  // Apenas uma linha vazia de separação (SEM page break)
  const separator = emptyXml();

  docXml = beforeInsert + separator + newXml + afterInsert;

  console.log("5. Salvando documento modificado...");
  zip.file("word/document.xml", docXml);

  const outputBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  fs.writeFileSync(outputPath, outputBuffer);

  console.log("");
  console.log("========================================");
  console.log("  DOCUMENTO GERADO COM SUCESSO!");
  console.log("========================================");
  console.log("");
  console.log("Arquivo: " + outputPath);
  console.log("");
  console.log("Correcoes aplicadas:");
  console.log("  [x] Cabecalhos: Arial Bold 12pt, NEGRITO");
  console.log("  [x] SEM travessoes nas listas");
  console.log("  [x] SEM negrito no corpo do texto");
  console.log("  [x] SEM paginas em branco entre topicos");
  console.log("  [x] SEM recuo de primeira linha");
  console.log("");
}

injectIntoDocx().catch(console.error);
