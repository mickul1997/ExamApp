// Auto-generate web/public/question_sets/manifest.json
// Lists all .json files in that folder (excluding the manifest itself)
// so the web app can auto-load them on open.

import { promises as fs } from 'node:fs';
import path from 'node:path';

async function main() {
  const root = process.cwd();
  // If executed from elsewhere, try to locate the web dir
  const webDir = root.endsWith(path.sep + 'web') ? root : path.join(root, 'ksh_quiz_ready', 'web');
  const setsDir = path.join(webDir, 'public', 'question_sets');
  try {
    const entries = await fs.readdir(setsDir, { withFileTypes: true });
    const files = entries
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((n) => n.toLowerCase().endsWith('.json') && n.toLowerCase() !== 'manifest.json')
      .sort((a, b) => a.localeCompare(b));

    const manifestPath = path.join(setsDir, 'manifest.json');
    const json = JSON.stringify(files, null, 2) + '\n';
    await fs.writeFile(manifestPath, json, { encoding: 'utf8' });
    console.log(`Generated manifest with ${files.length} files at: ${path.relative(webDir, manifestPath)}`);
  } catch (err) {
    console.warn('Skipping manifest generation:', err?.message || err);
  }
}

main();

