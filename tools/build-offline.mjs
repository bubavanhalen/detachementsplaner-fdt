import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { verifyRelease } from './verify-release.mjs';

// A single self-contained build serves both the public app and local HTML exports.
// User storage and user files are deliberately never read by the build process.
const result = await build({
  configFile: false,
  base: './',
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    // Also cover callbacks such as promise.catch(console.error), which ordinary
    // dropConsole only removes when the console method is called directly.
    ...Object.fromEntries(
      ['log', 'info', 'warn', 'error', 'debug', 'trace', 'table', 'dir', 'dirxml', 'assert'].map(
        (method) => [`console.${method}`, '(() => {})'],
      ),
    ),
  },
  build: {
    write: false,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rolldownOptions: {
      // SheetJS and other dependencies can log data-derived parser diagnostics.
      // Remove those calls from the shipped application as well as our own code.
      output: { minify: { compress: { dropConsole: true } } },
    },
    lib: {
      entry: resolve('src/main.tsx'),
      name: 'Detachementsplaner',
      formats: ['iife'],
    },
  },
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
const scripts = outputs.filter((item) => item.type === 'chunk');
const styles = outputs.filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'));
if (scripts.length !== 1 || outputs.length !== scripts.length + styles.length) {
  throw new Error('The offline build must contain one inline script and inline styles only.');
}
const csp = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  "connect-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
].join('; ');
const template = await readFile('index.html', 'utf8');
const script = scripts[0].code.replace(/<\/script/gi, '<\\/script');
const css = styles.map((item) => String(item.source)).join('\n');
const bundledPackages = new Set(
  Object.keys(scripts[0].modules).flatMap((id) => {
    const dependencyPath = id.replaceAll('\\', '/').split('/node_modules/').at(-1);
    if (!id.includes('node_modules') || !dependencyPath) return [];
    const parts = dependencyPath.split('/');
    return [parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]];
  }),
);
const notices = [`Detachementsplaner\n${await readFile('LICENSE', 'utf8')}`];
for (const name of [...bundledPackages].sort()) {
  const directory = resolve('node_modules', name);
  const licenseFile = (await readdir(directory)).find((file) =>
    /^licen[sc]e(?:\..*)?$/i.test(file),
  );
  if (!licenseFile) throw new Error(`Bundled dependency licence missing: ${name}`);
  notices.push(`${name}\n${await readFile(resolve(directory, licenseFile), 'utf8')}`);
}
const licenseText = notices.join('\n\n').replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const html = template
  .replace('<html lang="de-CH">', '<html lang="de-CH" data-offline="true">')
  .replace(
    '<!--OFFLINE-CSP-->',
    () => `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
  )
  .replace('<!--OFFLINE-STYLES-->', () => `<style>${css}</style>`)
  .replace(
    /<script type="module" src="\/src\/main\.tsx"><\/script>/,
    () => `<script>${script}</script>`,
  );

const licensedHtml = html.replace(
  /<\/body>\s*<\/html>\s*$/,
  () => `<template id="application-licenses"><pre>${licenseText}</pre></template></body></html>`,
);

// Never copy the working directory or arbitrary files into a release.
const output = resolve('dist');
if (output !== resolve(process.cwd(), 'dist')) throw new Error('Invalid release directory.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(resolve(output, 'index.html'), licensedHtml),
  writeFile(resolve(output, 'offline.html'), licensedHtml),
  writeFile(resolve(output, '.nojekyll'), ''),
]);
await verifyRelease(output);
