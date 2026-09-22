import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { smokeOffline } from './smoke-offline.mjs';

export async function verifyRelease(directory = resolve('dist')) {
  const files = (await readdir(directory)).sort();
  assert.deepEqual(
    files,
    ['.nojekyll', 'index.html', 'offline.html'],
    'Unexpected release content',
  );
  const html = await readFile(resolve(directory, 'index.html'), 'utf8');
  assert.equal(html, await readFile(resolve(directory, 'offline.html'), 'utf8'));
  const document = new JSDOM(html).window.document;
  const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content;
  for (const directive of [
    "default-src 'none'",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ]) {
    assert.ok(csp?.includes(directive), 'Required offline CSP directive missing');
  }
  assert.equal(document.documentElement.dataset.offline, 'true');
  assert.ok(
    document.querySelector('#application-licenses'),
    'Distribution licence notices missing',
  );
  assert.ok(
    !/\bconsole\s*(?:\.|\[)/.test(document.querySelector('script')?.textContent ?? ''),
    'Console logging API remains in the production bundle',
  );
  assert.equal(
    document.querySelectorAll('script').length,
    1,
    'Unexpected scripts or embedded data',
  );
  assert.equal(
    document.querySelectorAll('[src], link[href], iframe, object, embed').length,
    0,
    'External runtime asset',
  );
  assert.equal(
    document.querySelector('#root')?.innerHTML,
    '',
    'Release contains rendered project data',
  );
  assert.equal(
    document.querySelector('#bootData, #boot-data, [data-project]'),
    null,
    'Embedded project data',
  );
  const comments = document.createTreeWalker(document, 128);
  let bootMarkers = 0;
  while (comments.nextNode()) if (comments.currentNode.textContent === 'BOOT') bootMarkers++;
  assert.equal(bootMarkers, 1, 'Missing clean export marker');
  assert.ok(
    !/<script[^>]*type=["']module/i.test(html),
    'Offline build cannot depend on module requests',
  );
  assert.ok(
    !/@import\s|url\(\s*["']?https?:/i.test(document.querySelector('style')?.textContent ?? ''),
    'Remote stylesheet asset',
  );
  assert.ok(!/sourceMappingURL=/.test(html), 'Source map included in public build');
  await smokeOffline(html);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyRelease();
}
