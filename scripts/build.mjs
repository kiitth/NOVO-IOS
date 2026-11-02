import { mkdir, copyFile, rm } from 'node:fs/promises';
const files = ['index.html', 'style.css', 'inventory.js', 'app.js', 'forecast.js', 'dashboard.js'];
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of files) await copyFile(file, `dist/${file}`);
console.log(`Built Black Edition: ${files.length} static application files copied to dist/.`);
