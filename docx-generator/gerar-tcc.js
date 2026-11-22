const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, PageNumber, Header, Footer,
  NumberFormat, TabStopPosition, TabStopType,
  BorderStyle, ShadingType, convertInchesToTwip,
  LevelFormat, PageBreak, LineRuleType, SpacingRule
} = require("docx");
const fs = require("fs");

// =====================================================
// CONFIGURAÇÕES ABNT
// =====================================================
const FONT = "Times New Roman";
const FONT_SIZE_PT = 12;
const FONT_SIZE_H1 = 12;
const FONT_SIZE_H2 = 12;
const FONT_SIZE_H3 = 12;
const LINE_SPACING = 360;  // 1,5 linhas
const INDENT_FIRST_LINE = 709; // 1,25 cm em twips
const MARGIN_TOP = 1701;    // 3cm
const MARGIN_BOTTOM = 1134; // 2cm
const MARGIN_LEFT = 1701;   // 3cm
const MARGIN_RIGHT = 1134;  // 2cm

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function bodyParagraph(text, options = {}) {
  const runs = parseInlineFormatting(text);
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE_SPACING, after: 0, before: 0 },
    indent: options.noIndent ? {} : { firstLine: INDENT_FIRST_LINE },
    children: runs,
  });
}

function emptyParagraph() {
  return new Paragraph({
    spacing: { line: LINE_SPACING, after: 0, before: 0 },
    children: [new TextRun({ text: "", font: FONT, size: FONT_SIZE_PT * 2 })],
  });
}

function heading1(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, before: 480, after: 240 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: FONT,
        size: FONT_SIZE_H1 * 2,
      }),
    ],
  });
}

function heading2(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, before: 360, after: 200 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: FONT,
        size: FONT_SIZE_H2 * 2,
      }),
    ],
  });
}

function heading3(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, before: 240, after: 120 },
    children: [
      new TextRun({
        text: text,
        bold: true,
        font: FONT,
        size: FONT_SIZE_H3 * 2,
      }),
    ],
  });
}

function listItem(text, level = 0) {
  const runs = parseInlineFormatting(text);
  const indent = 709 + (level * 360);
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE_SPACING, after: 0, before: 0 },
    indent: { left: indent, hanging: 280 },
    children: [
      new TextRun({ text: "– ", font: FONT, size: FONT_SIZE_PT * 2 }),
      ...runs,
    ],
  });
}

function referenceParagraph(text) {
  const runs = parseInlineFormatting(text);
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 240, after: 120, before: 0 },
    children: runs,
  });
}

function codeBlock(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 240, before: 200, after: 200 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
    },
    shading: { type: ShadingType.SOLID, color: "F5F5F5" },
    children: [
      new TextRun({
        text: text,
        font: "Courier New",
        size: 20,
        color: "333333",
      }),
    ],
  });
}

function insertionMark(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING, before: 240, after: 240 },
    border: {
      top: { style: BorderStyle.DASHED, size: 1, color: "CC0000" },
      bottom: { style: BorderStyle.DASHED, size: 1, color: "CC0000" },
      left: { style: BorderStyle.DASHED, size: 1, color: "CC0000" },
      right: { style: BorderStyle.DASHED, size: 1, color: "CC0000" },
    },
    children: [
      new TextRun({
        text: text,
        font: FONT,
        size: FONT_SIZE_PT * 2,
        color: "CC0000",
        bold: true,
        italics: true,
      }),
    ],
  });
}

function parseInlineFormatting(text) {
  const runs = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], font: FONT, size: FONT_SIZE_PT * 2, bold: true, italics: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], font: FONT, size: FONT_SIZE_PT * 2, bold: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: FONT, size: FONT_SIZE_PT * 2, italics: true }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], font: "Courier New", size: 22 }));
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6], font: FONT, size: FONT_SIZE_PT * 2 }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: text, font: FONT, size: FONT_SIZE_PT * 2 }));
  }

  return runs;
}

// =====================================================
// PARSER DO MARKDOWN
// =====================================================

function parseMarkdown(mdContent) {
  const lines = mdContent.split("\n");
  const paragraphs = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inReferences = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        paragraphs.push(codeBlock(codeLines.join("\n")));
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
    if (trimmed === "---") {
      paragraphs.push(emptyParagraph());
      continue;
    }

    if (trimmed.match(/^#{1,2}\s+REFERÊNCIAS/i)) {
      inReferences = true;
      paragraphs.push(emptyParagraph());
      paragraphs.push(heading1("REFERÊNCIAS"));
      continue;
    }

    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      const text = trimmed.replace(/^#\s+/, "");
      inReferences = false;
      paragraphs.push(emptyParagraph());
      paragraphs.push(heading1(text));
      continue;
    }

    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^##\s+/, "");
      if (text.match(/REFERÊNCIAS/i)) {
        inReferences = true;
        paragraphs.push(emptyParagraph());
        paragraphs.push(heading1("REFERÊNCIAS"));
      } else {
        paragraphs.push(heading2(text));
      }
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^###\s+/, "");
      paragraphs.push(heading3(text));
      continue;
    }

    if (trimmed.match(/^\`?\[INSERIR .+?\]\`?$/)) {
      const clean = trimmed.replace(/`/g, "").replace(/^\[/, "").replace(/\]$/, "");
      paragraphs.push(insertionMark(clean));
      continue;
    }

    if (inReferences && trimmed.startsWith("- ")) {
      const text = trimmed.replace(/^-\s+/, "");
      paragraphs.push(referenceParagraph(text));
      continue;
    }

    if (trimmed.match(/^[-*]\s+/)) {
      const text = trimmed.replace(/^[-*]\s+/, "");
      paragraphs.push(listItem(text));
      continue;
    }

    if (trimmed.match(/^\d+\.\s+/)) {
      const text = trimmed.replace(/^\d+\.\s+/, "");
      const num = trimmed.match(/^(\d+)\./)[1];
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE_SPACING, after: 0, before: 0 },
        indent: { left: 709, hanging: 360 },
        children: [
          new TextRun({ text: `${num}. `, font: FONT, size: FONT_SIZE_PT * 2 }),
          ...parseInlineFormatting(text),
        ],
      }));
      continue;
    }

    paragraphs.push(bodyParagraph(trimmed));
  }

  return paragraphs;
}

// =====================================================
// GERAÇÃO DO DOCUMENTO
// =====================================================

async function generateDocx() {
  console.log("Lendo arquivo Markdown...");

  const mdPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - Reestruturado.md";
  const mdContent = fs.readFileSync(mdPath, "utf-8");

  console.log("Processando conteudo...");
  const contentParagraphs = parseMarkdown(mdContent);

  const coverPage = [
    emptyParagraph(), emptyParagraph(), emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "EE NEUZA MARIA NAZATTO DE CARVALHO", font: FONT, size: FONT_SIZE_PT * 2, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Curso Tecnico em Administracao", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    emptyParagraph(), emptyParagraph(), emptyParagraph(), emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Felipe Dias Melo", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Jhoni de Mello Somera", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Henrick Silvestre de Macedo", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    emptyParagraph(), emptyParagraph(), emptyParagraph(), emptyParagraph(), emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "SITE +PROMO: PROJETO WEB SaaS", font: FONT, size: FONT_SIZE_PT * 2, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Plataforma de Fidelizacao, Promocoes e Cashback por Assinatura", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    emptyParagraph(), emptyParagraph(), emptyParagraph(), emptyParagraph(), emptyParagraph(),
    emptyParagraph(), emptyParagraph(), emptyParagraph(), emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Santa Barbara D'Oeste - SP", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "2026", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const approvalPage = [
    emptyParagraph(), emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Felipe Dias Melo, Jhoni de Mello Somera, Henrick Silvestre de Macedo", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    emptyParagraph(), emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "SITE +PROMO: PROJETO WEB SaaS", font: FONT, size: FONT_SIZE_PT * 2, bold: true })],
    }),
    emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: LINE_SPACING },
      indent: { left: 2268 },
      children: [new TextRun({
        text: "Trabalho de Conclusao de Curso apresentado ao Curso Tecnico em Administracao da EE Neuza Maria Nazatto de Carvalho, como requisito parcial para obtencao do titulo de Tecnico em Administracao.",
        font: FONT, size: 20,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: LINE_SPACING },
      indent: { left: 2268 },
      children: [new TextRun({
        text: "Orientadora: Rafaella Santana Carnavalli",
        font: FONT, size: 20,
      })],
    }),
    emptyParagraph(), emptyParagraph(), emptyParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "Santa Barbara D'Oeste - SP", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING },
      children: [new TextRun({ text: "2026", font: FONT, size: FONT_SIZE_PT * 2 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  console.log("Aplicando formatacao ABNT...");

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: FONT_SIZE_PT * 2,
          },
          paragraph: {
            spacing: { line: LINE_SPACING },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: MARGIN_TOP,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_LEFT,
              right: MARGIN_RIGHT,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...coverPage,
          ...approvalPage,
          ...contentParagraphs,
        ],
      },
    ],
  });

  const outputPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - Reestruturado ABNT.docx";

  console.log("Gerando arquivo .docx...");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  console.log("");
  console.log("Documento gerado com sucesso!");
  console.log("Arquivo: " + outputPath);
  console.log("");
  console.log("Formatacao ABNT aplicada:");
  console.log("  Fonte: Times New Roman, 12pt");
  console.log("  Espacamento: 1,5 linhas");
  console.log("  Margens: Superior 3cm, Inferior 2cm, Esquerda 3cm, Direita 2cm");
  console.log("  Recuo de paragrafo: 1,25cm");
  console.log("  Titulos primarios: CAIXA ALTA + Negrito");
  console.log("  Alinhamento: Justificado");
  console.log("  Numeracao de pagina: canto superior direito");
  console.log("  Tamanho: A4");
  console.log("  Referencias: espacamento simples, alinhadas a esquerda");
}

generateDocx().catch(console.error);
