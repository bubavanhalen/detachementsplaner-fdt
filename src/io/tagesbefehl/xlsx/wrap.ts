// Line estimate for wrapped cells, ported from Python's textwrap (used by the
// reference build): whitespace/hyphen chunking, greedy fill, long words broken.

const WP = String.raw`[\p{L}\p{N}_!"'&.,?]`;
const LT = String.raw`[\p{L}_]`;
const W = String.raw`[\p{L}\p{N}_]`;
const WS = String.raw`[\t\n\v\f\r ]`;
const NWS = String.raw`[^\t\n\v\f\r ]`;
const WORDSEP = new RegExp(
  `(${WS}+|(?<=${WP})-{2,}(?=${W})|${NWS}+?(?:-(?:(?<=${LT}{2}-)|(?<=${LT}-${LT}-))(?=${LT}-?${LT})|(?=${WS}|$)|(?<=${WP})(?=-{2,}${W})))`,
  'u',
);

function wrapParagraph(text: string, width: number): number {
  const chunks = text
    .replace(/[\t\n\v\f\r]/g, ' ')
    .split(WORDSEP)
    .filter(Boolean)
    .reverse();
  let lines = 0;
  while (chunks.length) {
    const line: string[] = [];
    let length = 0;
    if (lines > 0 && chunks[chunks.length - 1].trim() === '') chunks.pop();
    while (chunks.length) {
      const size = chunks[chunks.length - 1].length;
      if (length + size > width) break;
      length += size;
      line.push(chunks.pop() as string);
    }
    if (chunks.length && chunks[chunks.length - 1].length > width) {
      const chunk = chunks[chunks.length - 1];
      const spaceLeft = width < 1 ? 1 : width - length;
      let end = spaceLeft;
      if (chunk.length > spaceLeft) {
        const hyphen = chunk.lastIndexOf('-', spaceLeft - 1);
        if (hyphen > 0 && /[^-]/.test(chunk.slice(0, hyphen))) end = hyphen + 1;
      }
      line.push(chunk.slice(0, end));
      chunks[chunks.length - 1] = chunk.slice(end);
    }
    if (line.length && line[line.length - 1].trim() === '') line.pop();
    if (line.length) lines++;
  }
  return lines;
}

/** Number of lines a text needs at ≈`width` characters per line (at least 1). */
export function wrappedLines(text: string, width: number): number {
  if (!text) return 1;
  const total = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .reduce((sum, paragraph) => sum + Math.max(1, wrapParagraph(paragraph, width)), 0);
  return Math.max(1, total);
}
