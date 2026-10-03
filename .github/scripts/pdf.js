// Imprime la page du CV en PDF A4 avec Chrome sans tête (Puppeteer).
// La feuille de style d'impression de index.html donne exactement la mise en page du CV papier, QR code compris.
// Usage : node .github/scripts/pdf.js <dossier du site>
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const site = path.resolve(process.argv[2] || '_site');
  const navigateur = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await navigateur.newPage();
    await page.goto('file://' + path.join(site, 'index.html'), { waitUntil: 'networkidle0', timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: path.join(site, 'CV_Jean-Francois_TIXIER.pdf'),
      format: 'A4', printBackground: true, preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    console.log('PDF écrit dans', site);
  } finally {
    await navigateur.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
