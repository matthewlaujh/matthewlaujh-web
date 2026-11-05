/* Prints the Resume and the Artist CV to src/files/ with Playwright's Chromium.
   Run after changing src/about.json or src/css/cv.css, then rebuild:
     node build.js --relative && node scripts/cv-pdf.js && node build.js */
const path = require('path');
const { chromium } = require('playwright');
const DOCS = [['Resume', 'Matthew-Lau-Resume.pdf'], ['Artist-CV', 'Matthew-Lau-Artist-CV.pdf']];
(async () => {
	const root = path.join(__dirname, '..');
	const b = await chromium.launch();
	for (const [slug, pdf] of DOCS) {
		const p = await b.newPage();
		await p.goto('file://' + path.join(root, 'preview', slug + '.html'), { waitUntil: 'networkidle' });
		await p.evaluate(() => document.fonts.ready);
		await p.emulateMedia({ media: 'print' });
		await p.pdf({ path: path.join(root, 'src', 'files', pdf), format: 'A4', printBackground: true, preferCSSPageSize: true });
		await p.close();
		console.log('printed src/files/' + pdf);
	}
	await b.close();
})();
