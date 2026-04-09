/**
 * Scopes sindresorhus/github-markdown-css under .gh-md-light / .gh-md-dark
 * so markdown matches app theme (Tailwind `dark` class) instead of OS preference only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import prefixSelector from 'postcss-prefix-selector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, '..');
const pkg = path.join(uiRoot, 'node_modules/github-markdown-css');
const outDir = path.join(uiRoot, 'src/styles');

const jobs = [
  { file: 'github-markdown-light.css', prefix: '.gh-md-light', out: 'gh-md-light.css' },
  { file: 'github-markdown-dark.css', prefix: '.gh-md-dark', out: 'gh-md-dark.css' },
];

async function scopeFile(relIn, prefix, outName) {
  const inputPath = path.join(pkg, relIn);
  const css = fs.readFileSync(inputPath, 'utf8');
  const result = await postcss([
    prefixSelector({
      prefix,
      transform(prefix, selector, prefixedSelector) {
        if (selector.startsWith(prefix.trim())) return selector;
        return prefixedSelector;
      },
    }),
  ]).process(css, { from: inputPath });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, outName), result.css, 'utf8');
}

for (const { file, prefix, out } of jobs) {
  await scopeFile(file, prefix, out);
}

console.log('Scoped GitHub markdown CSS → src/styles/gh-md-{light,dark}.css');
