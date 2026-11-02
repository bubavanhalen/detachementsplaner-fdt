// V11-deep und der Lizenzblock der Einzeldatei (Nachtrag-Test, Befund E1-01-28; R-H-11): In HTML-Dateien prüft
// deepPrivacyScan den Inhalt von genau einem <template id="application-licenses">…</template> nicht auf das
// Muster «E-Mail-Adresse» (Copyright-Zeilen gebündelter npm-Pakete). Alle übrigen Muster gelten dort weiter,
// ausserhalb des Blocks gilt das E-Mail-Muster unverändert. Mehrere Blöcke, ein Block ausserhalb von
// <head>/<body> oder ein nicht geschlossener Block → keine Ausnahme (fail closed). Meldungen nennen nur Datei
// und Muster, nie den Treffer.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md, «Änderungsnotiz E1-01-28 (05.10.2026, Orchestrator)»;
// §2 deepPrivacyScan (Pfad-Modus). Fiktive HTML-Dateien in einer Sandbox; E-Mail-Adresse und Telefonnummer
// werden zur Laufzeit gebildet; Sperrliste fiktiv (WAP_REFERENCE_DIR).
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ahvNummer,
  aufraeumen,
  FIKTIVER_NAME,
  neueSandbox,
  neuesRepo,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { privacyDeep } from './support/vertrag';

afterEach(aufraeumen);

// Fiktive Sperrliste (WAP_REFERENCE_DIR) für jeden Test: zeigePfad und der Scan lesen nie die echte Liste.
beforeEach(() => {
  prozessUmgebung(neueSandbox());
});

/** Fiktive E-Mail-Adresse eines Paketautors, zur Laufzeit gebildet (nie als Literal im Quelltext). */
function email(): string {
  return ['fiktiv.autor', 'beispiel.invalid'].join('@');
}

/** Fiktive Schweizer Telefonnummer, zur Laufzeit gebildet (nie als Literal im Quelltext). */
function telefon(): string {
  return ['04', '4 000 00 ', '00'].join('');
}

/** Lizenztext eines fiktiven npm-Pakets mit Copyright-Zeile (HTML-maskiert wie im Bau). */
function lizenz(kontakt: string): string {
  return [
    'fiktiv-paket',
    'MIT License',
    '',
    `Copyright (c) 2026 Fiktiv Autor &lt;${kontakt}&gt;`,
    '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy (fiktiv).',
  ].join('\n');
}

const block = (inhalt: string) =>
  `<template id="application-licenses"><pre>${inhalt}</pre></template>`;

/** Einzeldatei in der Form von buildEinzeldatei; `koerperEnde` steht vor </body>, `nachHtml` nach </html>. */
function seite(
  o: {
    koerperText?: string;
    koerperEnde?: string;
    nachHtml?: string;
    vorKopf?: string;
    kopfEnde?: string;
  } = {},
): string {
  return [
    '<!doctype html>',
    '<html lang="de-CH" data-offline="true">',
    ...(o.vorKopf === undefined ? [] : [`  ${o.vorKopf}`]),
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <title>Probe</title>',
    '    <style>.a{color:#010203}</style>',
    ...(o.kopfEnde === undefined ? [] : [`    ${o.kopfEnde}`]),
    '  </head>',
    '  <body>',
    `    <div id="root">${o.koerperText ?? ''}</div>`,
    "    <script>(function(){document.title='Probe';})();</script>",
    `    ${o.koerperEnde ?? ''}`,
    '  </body>',
    '</html>',
    o.nachHtml ?? '',
    '',
  ].join('\n');
}

function repo(sb: Sandbox): string {
  prozessUmgebung(sb);
  return neuesRepo(sb, 'lizenzblock');
}

async function scanne(root: string, rel: string) {
  const { deepPrivacyScan } = await privacyDeep();
  return deepPrivacyScan({ cwd: root, pfade: [join(root, ...rel.split('/'))] });
}

/** Rot mit Datei und Muster, ohne Treffertext. */
function erwarteRot(
  r: Awaited<ReturnType<typeof scanne>>,
  o: { datei: string; muster: string; treffer: string[] },
): void {
  expect(r.ok, 'Scan grün statt rot').toBe(false);
  const text = schrittText(r);
  expect(text).toContain(o.datei);
  expect(text).toContain(o.muster);
  const kompakt = text.replace(/\s/g, '').toLowerCase();
  for (const t of o.treffer) {
    expect(kompakt.includes(t.replace(/\s/g, '').toLowerCase()), 'Treffer in der Meldung').toBe(
      false,
    );
  }
}

const EINZELDATEI = 'test-results/wap/einzeldatei/probe.html';

describe('deepPrivacyScan: E-Mail im Lizenzblock (E1-01-28)', () => {
  it.each([[EINZELDATEI], ['dist/index.html']])(
    '[R-H-11][R-H-24] E-Mail-Adresse (Copyright-Zeile) in genau einem Lizenzblock von %s → grün',
    async (rel) => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, rel, seite({ koerperEnde: block(lizenz(email())) }));
      const r = await scanne(root, rel);
      expect(r.ok, schrittText(r)).toBe(true);
    },
  );

  it('[R-H-11][R-H-24] Gegenprobe (Regression): dieselbe E-Mail-Adresse ausserhalb des Lizenzblocks (im #root), Block daneben ebenfalls mit E-Mail → rot «E-Mail-Adresse», ohne Treffer', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(
      root,
      EINZELDATEI,
      seite({ koerperText: `Kontakt ${email()}`, koerperEnde: block(lizenz(email())) }),
    );
    erwarteRot(await scanne(root, EINZELDATEI), {
      datei: 'probe.html',
      muster: 'E-Mail-Adresse',
      treffer: [email()],
    });
  });

  it('[R-H-11][R-H-24] Gegenprobe (Regression): Telefonnummer im Lizenzblock → rot «Telefonnummer», ohne Treffer', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, EINZELDATEI, seite({ koerperEnde: block(lizenz(`Tel. ${telefon()}`)) }));
    erwarteRot(await scanne(root, EINZELDATEI), {
      datei: 'probe.html',
      muster: 'Telefonnummer',
      treffer: [telefon()],
    });
  });

  it('[R-H-11][R-H-24] Gegenprobe (Regression): Name aus der Sperrliste im Lizenzblock → rot «Name aus der Sperrliste», ohne Treffer', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, EINZELDATEI, seite({ koerperEnde: block(lizenz(`${FIKTIVER_NAME} Fiktiv`)) }));
    erwarteRot(await scanne(root, EINZELDATEI), {
      datei: 'probe.html',
      muster: 'Name aus der Sperrliste',
      treffer: [FIKTIVER_NAME],
    });
  });

  it('[R-H-11][R-H-24] Gegenprobe (Regression): zwei Lizenzblöcke, je mit E-Mail-Adresse → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(
      root,
      EINZELDATEI,
      seite({ koerperEnde: `${block(lizenz(email()))}\n${block(lizenz(email()))}` }),
    );
    erwarteRot(await scanne(root, EINZELDATEI), {
      datei: 'probe.html',
      muster: 'E-Mail-Adresse',
      treffer: [email()],
    });
  });

  it('[R-H-11][R-H-24] Gegenprobe (Regression): nicht geschlossener Lizenzblock mit E-Mail-Adresse → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(
      root,
      EINZELDATEI,
      seite({
        koerperEnde: `<template id="application-licenses"><pre>${lizenz(email())}</pre>`,
      }),
    );
    erwarteRot(await scanne(root, EINZELDATEI), {
      datei: 'probe.html',
      muster: 'E-Mail-Adresse',
      treffer: [email()],
    });
  });

  it('[R-H-11][R-H-24] Gegenprobe (Regression): Lizenzblock ausserhalb von <head>/<body> (nach </html>) mit E-Mail-Adresse → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, EINZELDATEI, seite({ nachHtml: block(lizenz(email())) }));
    erwarteRot(await scanne(root, EINZELDATEI), {
      datei: 'probe.html',
      muster: 'E-Mail-Adresse',
      treffer: [email()],
    });
  });

  it('[R-H-11][R-H-24] Gegenprobe (Regression): derselbe Inhalt in einer Nicht-HTML-Datei (.json) → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const rel = 'test-results/wap/einzeldatei/probe.json';
    writeText(
      root,
      rel,
      `${JSON.stringify({ html: seite({ koerperEnde: block(lizenz(email())) }) })}\n`,
    );
    erwarteRot(await scanne(root, rel), {
      datei: 'probe.json',
      muster: 'E-Mail-Adresse',
      treffer: [email()],
    });
  });
  it.each([['docs/probe.html'], ['test-results/wap/andere/probe.html']])(
    '[R-H-11][R-H-24] Gegenprobe (Regression): dieselbe HTML-Datei mit E-Mail im Lizenzblock an anderem Ort (%s) → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer',
    async (rel) => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, rel, seite({ koerperEnde: block(lizenz(email())) }));
      erwarteRot(await scanne(root, rel), {
        datei: 'probe.html',
        muster: 'E-Mail-Adresse',
        treffer: [email()],
      });
    },
  );

  it.each([
    [
      'einfache Anführungszeichen',
      (inhalt: string) => `<template id='application-licenses'><pre>${inhalt}</pre></template>`,
    ],
    [
      'zusätzliches Attribut',
      (inhalt: string) =>
        `<template class="fiktiv" id="application-licenses"><pre>${inhalt}</pre></template>`,
    ],
    [
      'ID ohne Anführungszeichen',
      (inhalt: string) => `<template id=application-licenses><pre>${inhalt}</pre></template>`,
    ],
  ])(
    '[R-H-11][R-H-24] Gegenprobe (Regression): Lizenzblock in anderer Schreibweise (%s) mit E-Mail → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer',
    async (_form, element) => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, EINZELDATEI, seite({ koerperEnde: element(lizenz(email())) }));
      erwarteRot(await scanne(root, EINZELDATEI), {
        datei: 'probe.html',
        muster: 'E-Mail-Adresse',
        treffer: [email()],
      });
    },
  );
});

describe('deepPrivacyScan: Lizenzblock, Ergänzung nach Test-Review (P01–P09)', () => {
  /** Rote Gegenprobe in der Einzeldatei unter test-results/wap/einzeldatei/ (bzw. `rel`). */
  async function rotIn(
    inhalt: string,
    muster: string,
    treffer: string[],
    rel = EINZELDATEI,
  ): Promise<void> {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, rel, inhalt);
    erwarteRot(await scanne(root, rel), {
      datei: rel.split('/').at(-1) ?? rel,
      muster,
      treffer,
    });
  }

  it.each([
    ['Telefonnummer', () => `${email()} Tel. ${telefon()}`, () => [email(), telefon()]],
    [
      'Name aus der Sperrliste',
      () => `${email()} ${FIKTIVER_NAME}`,
      () => [email(), FIKTIVER_NAME],
    ],
  ])(
    '[R-H-11][R-H-24] P01 Gegenprobe (Regression): E-Mail-Adresse und %s auf derselben Zeile im Lizenzblock → rot mit diesem Muster, ohne Treffer',
    async (muster, zeile, treffer) => {
      await rotIn(seite({ koerperEnde: block(lizenz(zeile())) }), muster, treffer());
    },
  );

  it.each([
    ['allein', () => `AHV ${ahvNummer()}`],
    ['mit E-Mail-Adresse auf derselben Zeile', () => `${email()} AHV ${ahvNummer()}`],
  ])(
    '[R-H-11][R-H-24] P02 Gegenprobe (Regression): AHV-Nummer im Lizenzblock (%s) → rot «AHV-Nummer», ohne Treffer',
    async (_fall, zeile) => {
      await rotIn(seite({ koerperEnde: block(lizenz(zeile())) }), 'AHV-Nummer', [
        ahvNummer(),
        ahvNummer().slice(4),
        email(),
      ]);
    },
  );

  it.each([
    ['nach </template> im body', () => `${block(lizenz(email()))}\n    <p>${email()}</p>`],
    [
      'zwischen Lizenzblock und weiterem <template id="x">',
      () => `${block(lizenz(email()))}<p>${email()}</p><template id="x"></template>`,
    ],
  ])(
    '[R-H-11][R-H-24] P03 Gegenprobe (Regression): E-Mail-Adresse %s → rot «E-Mail-Adresse», ohne Treffer',
    async (_fall, ende) => {
      await rotIn(seite({ koerperEnde: ende() }), 'E-Mail-Adresse', [email()]);
    },
  );

  it.each([
    ['nur im ersten', () => `${block(lizenz(email()))}\n${block(lizenz('ohne Kontakt'))}`],
    ['nur im zweiten', () => `${block(lizenz('ohne Kontakt'))}\n${block(lizenz(email()))}`],
  ])(
    '[R-H-11][R-H-24] P04 Gegenprobe (Regression): zwei Lizenzblöcke, E-Mail-Adresse %s → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer',
    async (_fall, ende) => {
      await rotIn(seite({ koerperEnde: ende() }), 'E-Mail-Adresse', [email()]);
    },
  );

  it.each([['docs/dist/probe.html'], ['tests/x/test-results/wap/einzeldatei/probe.html']])(
    '[R-H-11][R-H-24] P05 Gegenprobe (Regression): Ausnahmeort nur repo-relativ am Anfang – %s mit E-Mail im Lizenzblock → rot «E-Mail-Adresse», ohne Treffer',
    async (rel) => {
      await rotIn(seite({ koerperEnde: block(lizenz(email())) }), 'E-Mail-Adresse', [email()], rel);
    },
  );

  it.each([['probe.txt'], ['probe.js']])(
    '[R-H-11][R-H-24] P06 Gegenprobe (Regression): dieselbe Seite als %s unter test-results/wap/einzeldatei/ → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer',
    async (name) => {
      await rotIn(
        seite({ koerperEnde: block(lizenz(email())) }),
        'E-Mail-Adresse',
        [email()],
        `test-results/wap/einzeldatei/${name}`,
      );
    },
  );

  it('[R-H-11][R-H-24] P07 Gegenprobe (Regression): Lizenzblock zwischen <html> und <head> mit E-Mail-Adresse → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer', async () => {
    await rotIn(seite({ vorKopf: block(lizenz(email())) }), 'E-Mail-Adresse', [email()]);
  });

  it('[R-H-11][R-H-24] P08 Gegenprobe (Regression): <TEMPLATE ID="application-licenses"> (Grossschreibung) mit E-Mail-Adresse → keine Ausnahme, rot «E-Mail-Adresse», ohne Treffer', async () => {
    await rotIn(
      seite({
        koerperEnde: `<TEMPLATE ID="application-licenses"><pre>${lizenz(email())}</pre></TEMPLATE>`,
      }),
      'E-Mail-Adresse',
      [email()],
    );
  });

  it('[R-H-11][R-H-24] P09 Lizenzblock mit E-Mail-Adresse im <head> → grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, EINZELDATEI, seite({ kopfEnde: block(lizenz(email())) }));
    const r = await scanne(root, EINZELDATEI);
    expect(r.ok, schrittText(r)).toBe(true);
  });

  it('[R-H-11][R-H-24] P09 dist-Form des Baus (</pre></template></body></html> auf einer Zeile) mit E-Mail-Adresse im Lizenzblock → grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const rel = 'dist/index.html';
    writeText(
      root,
      rel,
      [
        '<!doctype html>',
        '<html lang="de-CH">',
        '  <head>',
        '    <meta charset="UTF-8" />',
        '  </head>',
        '  <body>',
        '  <div id="root"></div>',
        `  <template id="application-licenses"><pre>${lizenz(email())}`,
        '</pre></template></body></html>',
        '',
      ].join('\n'),
    );
    const r = await scanne(root, rel);
    expect(r.ok, schrittText(r)).toBe(true);
  });
});
