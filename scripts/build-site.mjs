// Builds the folder GitHub Pages publishes: the app at the root of the site, a /app/ page that sends visitors to the root,
// and (when the repository has them) the CNAME file and the .well-known folder. Run: node scripts/build-site.mjs [out-folder]
// Everything in the app uses relative paths, so the same folder works at https://app.lifecentre.sg/ and under a repository
// path such as https://lifecentresg.github.io/lifecentre-app/.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

// A page at /app/ for links that still point there: it goes to the root, keeping any ?query and #route.
export const APP_REDIRECT = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Life Centre</title>
<meta http-equiv="refresh" content="0; url=../">
<script>location.replace('../' + location.search + location.hash);</script>
</head>
<body><a href="../">Open the Life Centre app</a></body>
</html>
`;

export function buildSite(out = resolve(ROOT, '_site')) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(resolve(ROOT, 'app'), out, { recursive: true, filter: (src) => !/[\\/]app[\\/]tests([\\/]|$)/.test(src) });
  mkdirSync(resolve(out, 'app'), { recursive: true });
  writeFileSync(resolve(out, 'app/index.html'), APP_REDIRECT);
  writeFileSync(resolve(out, '.nojekyll'), '');
  if (existsSync(resolve(ROOT, 'CNAME'))) cpSync(resolve(ROOT, 'CNAME'), resolve(out, 'CNAME'));
  if (existsSync(resolve(ROOT, 'well-known'))) cpSync(resolve(ROOT, 'well-known'), resolve(out, '.well-known'), { recursive: true });
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Built', buildSite(process.argv[2] ? resolve(process.argv[2]) : undefined));
}
