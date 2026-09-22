// Only source code and wholly fictional fixtures are examined here.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(path) ? [path] : [];
  });
}

describe('hard offline boundary', () => {
  it('has no application network, remote logging, tracking, or cookie APIs', () => {
    for (const path of sourceFiles('src')) {
      const source = readFileSync(path, 'utf8');
      // Intentionally strict: adding any network API requires reviewing this policy gate.
      expect(source, path).not.toMatch(
        /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection)\s*\(/,
      );
      expect(source, path).not.toMatch(/\bconsole\s*\.|\bdocument\s*\.\s*cookie\b/);
      expect(source, path).not.toMatch(/(?:https?:)?\/\/[^\s"']+\.(?:js|css|woff2?)(?:["'\s?]|$)/);
    }
  });

  it('keeps the release source empty and limits it to the application entry', () => {
    const source = readFileSync('index.html', 'utf8');
    expect(source).toContain('<div id="root"></div>');
    expect(source).toContain('<!--BOOT-->');
    expect(source).not.toMatch(/__BOOTDATA\s*=/);
    expect(source).not.toMatch(/https?:\/\//);
  });
});
