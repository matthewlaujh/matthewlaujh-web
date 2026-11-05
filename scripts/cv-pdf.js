/* Prints the Resume and the Artist CV to src/files/ with Playwright's Chromium.
   Run after changing src/about.json or src/css/cv.css, then rebuild:
     node scripts/cv-pdf.js && node build.js
   It records this month as the documents' "Updated" month
   (src/files/updated.json) and builds the preview before printing. */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const DOCS = [['Resume', 'Matthew-Lau-Resume.pdf'], ['Artist-CV', 'Matthew-Lau-Artist-CV.pdf']];
(async () => {
	const root = path.join(__dirname, '..');
	fs.writeFileSync(path.join(root, 'src', 'files', 'updated.json'), JSON.stringify({ month: new Date().toISOString().slice(0, 7) }) + '\n');
	execFileSync('node', [path.join(root, 'build.js'), '--relative'], { cwd: root, stdio: 'inherit' });
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
