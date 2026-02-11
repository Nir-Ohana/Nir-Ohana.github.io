import fs from 'node:fs/promises';

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function extractLocalRefs(html, attr) {
  const refs = [];
  const re = new RegExp(`${attr}="(\.\/[^"]+)"`, 'g');
  let match;
  while ((match = re.exec(html))) {
    refs.push(match[1]);
  }
  return refs;
}

async function main() {
  const entries = await fs.readdir('.', { withFileTypes: true });
  const htmlFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => e.name)
    .sort();

  if (htmlFiles.length === 0) {
    console.error('No .html files found at repo root.');
    process.exit(1);
  }

  const requiredMenuLinks = [
    './index.html',
    './algorithm-visualizations.html',
    './json-beautifier.html',
    './html-renderer.html',
  ];

  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf8');

    // Validate local asset refs exist.
    const hrefs = extractLocalRefs(html, 'href');
    const srcs = extractLocalRefs(html, 'src');
    const refs = [...new Set([...hrefs, ...srcs])];

    for (const ref of refs) {
      // Keep it simple: only validate same-folder refs.
      const normalized = ref.startsWith('./') ? ref.slice(2) : ref;
      if (!(await fileExists(normalized))) {
        console.error(`${file}: missing referenced file: ${ref}`);
        process.exit(1);
      }
    }

    // Validate the hamburger menu contains the shared tool links.
    const hasAllLinks = requiredMenuLinks.every((link) => html.includes(`href="${link}"`));
    if (!hasAllLinks) {
      console.error(`${file}: nav menu is missing one of: ${requiredMenuLinks.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`OK: validated ${htmlFiles.length} HTML files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
