/* Prints the CV page to src/files/Matthew-Lau-CV.pdf with Playwright's Chromium.
   Run after changing src/about.json or src/css/cv.css, then rebuild:
     node build.js --relative && node scripts/cv-pdf.js && node build.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
	const root = path.join(__dirname, '..');
	const b = await chromium.launch();
	const p = await b.newPage();
	await p.goto('file://' + path.join(root, 'preview', 'CV.html'), { waitUntil: 'networkidle' });
	await p.evaluate(() => document.fonts.ready);
	await p.emulateMedia({ media: 'print' });
	await p.pdf({ path: path.join(root, 'src', 'files', 'Matthew-Lau-CV.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
	await b.close();
	console.log('printed src/files/Matthew-Lau-CV.pdf');
})();
