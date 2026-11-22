const puppeteer = require('puppeteer');
const path = require('path');

async function renderDiagrams() {
  console.log("Iniciando navegador para captura de alta resolução...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  await page.setViewport({
    width: 1400,
    height: 2400,
    deviceScaleFactor: 2 // Ultra-sharp quality
  });

  const htmlPath = path.join(__dirname, 'diagrams.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  // Capturar Diagrama 0 (Metodologia)
  const el0 = await page.$('#diagram-metodologia');
  const outPath0 = path.join(__dirname, '..', 'diagrama_5_metodologia.png');
  await el0.screenshot({ path: outPath0 });
  console.log(`✅ Diagrama 0 (Metodologia) salvo em: ${outPath0}`);

  // Capturar Diagrama 1 (Arquitetura)
  const el1 = await page.$('#diagram-arquitetura');
  const outPath1 = path.join(__dirname, '..', 'diagrama_7_6_arquitetura.png');
  await el1.screenshot({ path: outPath1 });
  console.log(`✅ Diagrama 1 (Arquitetura) salvo em: ${outPath1}`);

  // Capturar Diagrama 2 (UX / Design)
  const el2 = await page.$('#diagram-ux');
  const outPath2 = path.join(__dirname, '..', 'diagrama_7_9_ux_design.png');
  await el2.screenshot({ path: outPath2 });
  console.log(`✅ Diagrama 2 (UX/Design) salvo em: ${outPath2}`);

  await browser.close();
  console.log("Renderização finalizada com sucesso!");
}

renderDiagrams().catch(console.error);
