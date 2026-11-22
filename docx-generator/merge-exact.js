const JSZip = require("jszip");
const fs = require("fs");

async function mergeDocs() {
  const origPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC ORIGINAL.docx";
  const novoPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC NOVO.docx";
  const outPath = "C:\\Users\\lipwc\\Downloads\\+ Promo\\TCC +Promo - OFICIAL FINALIZADO.docx";

  console.log("1. Carregando arquivos...");
  const origZip = await JSZip.loadAsync(fs.readFileSync(origPath));
  const origXml = await origZip.file("word/document.xml").async("string");

  const novoZip = await JSZip.loadAsync(fs.readFileSync(novoPath));
  const novoXml = await novoZip.file("word/document.xml").async("string");

  // Quebrar em parágrafos preservando as tags
  // Um parágrafo no Word vai de <w:p ...> até </w:p>
  // Vamos localizar os parágrafos exatos.
  
  const origParas = origXml.split('</w:p>');
  const novoParas = novoXml.split('</w:p>');

  console.log(`ORIG paras: ${origParas.length}, NOVO paras: ${novoParas.length}`);

  // Encontrar o final de 5.6 no ORIG
  let origCutIdx = -1;
  for (let i = 0; i < origParas.length; i++) {
    const text = origParas[i].replace(/<[^>]+>/g, '').trim();
    if (text.includes("A metodologia adotada com a Pesquisa Aplicada com Prototipação Incremental")) {
      origCutIdx = i;
      console.log(`Encontrado fim de 5.6 no ORIG no índice P${i}`);
      break;
    }
  }

  // Encontrar o início de 6. CARACTERIZAÇÃO no NOVO (que é a página 35)
  let novoStartIdx = -1;
  for (let i = 0; i < novoParas.length; i++) {
    const text = novoParas[i].replace(/<[^>]+>/g, '').trim();
    if (text.includes("6. CARACTERIZAÇÃO DA EMPRESA OU NEGÓCIO")) {
      novoStartIdx = i;
      console.log(`Encontrado início da nova parte no NOVO no índice P${i}`);
      break;
    }
  }

  if (origCutIdx === -1 || novoStartIdx === -1) {
    console.error("ERRO ao encontrar os índices de corte!");
    return;
  }

  // Pegar parte 1: do início do ORIG até o final de 5.6 (inclusive)
  const part1Paras = origParas.slice(0, origCutIdx + 1);
  const part1Xml = part1Paras.join('</w:p>') + '</w:p>';

  // Pegar parte 2: do início do novo desenvolvimento até o fim do NOVO (antes do sectPr)
  const lastNovoPara = novoParas[novoParas.length - 1]; // Contém o </w:body></w:document> ou sectPr
  const part2Paras = novoParas.slice(novoStartIdx, novoParas.length - 1);
  const part2Xml = part2Paras.join('</w:p>') + '</w:p>';

  // Pegar o sectPr do ORIG (para manter margens, cabeçalho e rodapé originais)
  const sectPrMatch = origXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : '';

  // Montar o document.xml final
  const finalDocXml = part1Xml + '\n' + part2Xml + '\n' + sectPr + '</w:body></w:document>';

  // Atualizar no ZIP do ORIG (preserva todas as fontes, temas, configurações, estilos originais)
  origZip.file("word/document.xml", finalDocXml);

  // Copiar qualquer mídia ou relação que exista no NOVO para o ORIG
  // Verificar se há relações no NOVO que não existem no ORIG
  const origRelsXml = await origZip.file("word/_rels/document.xml.rels").async("string");
  const novoRelsXml = await novoZip.file("word/_rels/document.xml.rels").async("string");

  // Salvar o arquivo final
  console.log("Salvando arquivo final...");
  const buffer = await origZip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  fs.writeFileSync(outPath, buffer);
  console.log(`\n✅ ARQUIVO UNIFICADO COM SUCESSO!`);
  console.log(`📁 Caminho: ${outPath}`);
}

mergeDocs().catch(console.error);
