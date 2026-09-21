const FELDER = [
  { k: 'grad', t: 'Grad', pat: /^grad|^gr\b|dienstgrad/i },
  { k: 'name', t: 'Name / Vorname', pat: /name/i, req: true },
  { k: 'funktion', t: 'Funktion', pat: /funktion|fkt/i },
  { k: 'dt', t: 'Noch zu leistende Diensttage (NZL)', pat: /diensttage|nzl|\bdt\b|tage/i },
  { k: 'einteilung', t: 'Einteilung', pat: /einteilung|einheit|truppenkörper|verband|kp\b/i },
  { k: 'lics', t: 'Militärische Führerausweise', pat: /führerschein|fuehrerschein|führerausweis|fahrzeug|kategorie|lenker|kat\b/i },
  { k: 'zug', t: 'Zug / Element (Stufe 2)', pat: /^zug|zugs|gruppe|grp|stufe|niveau|element/i },
  { k: 'pnr', t: 'Versicherten-Nr / AHV', pat: /versicherten|ahv|pers.*nr|personalnr|sozial/i },
  { k: 'tel', t: 'Mobiltelefon', pat: /tel|natel|mobile|handy/i },
  { k: 'mail', t: 'E-Mail', pat: /mail/i },
  { k: 'wohnort', t: 'Wohnort', pat: /wohnort|ort$/i }
];

/* =========================================================
   Übersetzung MILO-Langtexte -> Kurzformen der Kärtchen
   ========================================================= */

/* Funktionen: gesicherte Zuordnungen. Zusammengesetzte Funktionen
   werden am «/» getrennt und Teil für Teil übersetzt.            */
const FKT_TABELLE = {
  'kommandant': 'Kdt', 'kommandant stellvertreter': 'Kdt Stv',
  'einheitfeldweibel': 'Einh Fw', 'einheitsfeldweibel': 'Einh Fw',
  'einheitfourier': 'Einh Four', 'einheitsfourier': 'Einh Four',
  'infanterieoffizier': 'Inf Of', 'infanterieunteroffizier': 'Inf Uof', 'infanteriesoldat': 'Inf Sdt',
  'späheroffizier': 'Späher Of', 'späherunteroffizier': 'Späher Uof', 'späher': 'Späher',
  'mörseroffizier': 'Mö Of', 'mörserunteroffizier': 'Mö Uof',
  'mörser kanonier': 'Mö Kan', 'mörserkanonier': 'Mö Kan',
  'minenwerferoffizier': 'Mw Of', 'minenwerferunteroffizier': 'Mw Uof',
  'minenwerfer kanonier': 'Mw Kan', 'minenwerferkanonier': 'Mw Kan',
  'aufklärungsoffizier': 'Aufkl Of', 'aufklärungsunteroffizier': 'Aufkl Uof', 'aufklärer': 'Aufkl',
  'führungsstaffelsoldat': 'Fhr St Sdt', 'führungsstaffelunteroffizier': 'Fhr St Uof',
  'infanterieeinheitssanitäter': 'Inf Einh San',
  'nachschubsoldat': 'Ns Sdt', 'nachschubunteroffizier': 'Ns Uof',
  'transportunteroffizier': 'Trsp Uof', 'transportsoldat': 'Trsp Sdt',
  'truppenbuchhalter': 'Trp Buchh', 'truppenkoch': 'Trp Koch',
  'küchenchef': 'Kü Chef', 'küchenlogistik soldat': 'Kü Log Sdt', 'küchenlogistiksoldat': 'Kü Log Sdt',
  'büroordonnanz': 'Büro Ord', 'motorfahrer': 'Motf',
  'abc spürer': 'ABC Spür', 'abc spür': 'ABC Spür',
  'fahrer b': 'Fahr B', 'fahrer c': 'Fahr C', 'fahrer c1': 'Fahr C1', 'fahrer d1': 'Fahr D1',
  'übermittlungssoldat': 'Uem Sdt', 'nachrichtensoldat': 'Na Sdt'
};
const FKT_VORNE = [
  [/^führungsstaffel/i, 'Fhr St '], [/^infanterieeinheits/i, 'Inf Einh '], [/^infanterie/i, 'Inf '],
  [/^minenwerfer\s*/i, 'Mw '], [/^mörser\s*/i, 'Mö '], [/^aufklärungs/i, 'Aufkl '], [/^aufklärer/i, 'Aufkl'],
  [/^späher/i, 'Späher '], [/^nachschub/i, 'Ns '], [/^transport/i, 'Trsp '],
  [/^küchen?\s*/i, 'Kü '], [/^truppen?\s*/i, 'Trp '], [/^einheits?\s*/i, 'Einh '], [/^übermittlungs/i, 'Uem ']
];
const FKT_HINTEN = [
  [/unteroffizier/i, ' Uof'], [/offizier/i, ' Of'], [/soldat/i, ' Sdt'], [/kanonier/i, ' Kan'],
  [/feldweibel/i, ' Fw'], [/fourier/i, ' Four'], [/sanitäter/i, ' San'], [/spürer/i, ' Spür'],
  [/buchhalter/i, ' Buchh'], [/logistik/i, ' Log'], [/ordonnanz/i, ' Ord'], [/fahrer/i, ' Fahr']
];
function kurzTeil(t) {
  const roh = String(t || '').trim(); if (!roh) return '';
  const tab = FKT_TABELLE[roh.toLowerCase()];
  if (tab) return tab;
  let x = roh;
  for (const [re, r] of FKT_VORNE) if (re.test(x)) { x = x.replace(re, r); break; }
  FKT_HINTEN.forEach(([re, r]) => { x = x.replace(re, r); });
  return x.replace(/\s+/g, ' ').trim();
}
function kurzFunktion(lang) {
  const roh = String(lang || '').trim(); if (!roh) return '';
  if (S.maps && S.maps.fkt && S.maps.fkt[roh] !== undefined) return S.maps.fkt[roh];
  return roh.split('/').map(kurzTeil).filter(Boolean).join('/');
}

/* Führerscheine: Zifferncode -> Kurzform. 97 Sehhilfe ist eine Auflage,
   keine Fahrzeugkategorie, und wird ausgeblendet.                      */
const LIC_TABELLE = {
  '21': 'G-Klasse', '22': 'PW', '23': 'G-Klasse mit Anh', '24': 'PW mit Anh',
  '30': 'Lastwagen', '31': 'Duro', '32': 'Lastwagen mit Anh', '33': 'Duro mit Anh',
  '44': 'Gabelstapler', '45': 'FUG', '62': 'Piranha 6x6', '63': 'Piranha 8x8',
  '97': ''
};
const LIC_FAMILIE = { '21': ['21', '23'], '23': ['21', '23'], '22': ['22', '24'], '24': ['22', '24'], '30': ['30', '32'], '32': ['30', '32'], '31': ['31', '33'], '33': ['31', '33'] };
function licCode(t) { const m = String(t || '').trim().match(/^(\d{2,3})\b/); return m ? m[1] : ''; }
function kurzKategorie(t) {
  const roh = String(t || '').trim(); if (!roh) return '';
  if (S.maps && S.maps.lic && S.maps.lic[roh] !== undefined) return S.maps.lic[roh];
  const c = licCode(roh);
  if (c && LIC_TABELLE[c] !== undefined) return LIC_TABELLE[c];
  return roh.replace(/^\d{2,3}\s*/, '');
}
function splitLics(t) { return String(t || '').split(/[;\n]/).map(x => x.trim()).filter(Boolean); }

/* Anzeige-Helfer: überall statt p.funktion / p.lics verwenden */
function fkt(p) { return kurzFunktion(p.funktion); }
function kats(p) {
  const roh = p.lics || [];
  const codes = roh.map(licCode);
  const behalten = roh.filter((t, i) => {
    const c = codes[i]; if (!c) return true;
    const fam = LIC_FAMILIE[c];
    if (!fam) return true;
    const hoch = fam[fam.length - 1];              // Anhänger-Variante schlägt Grundkategorie
    return c === hoch || !codes.includes(hoch);
  });
  const out = []; behalten.forEach(t => { const k = kurzKategorie(t); if (k && !out.includes(k)) out.push(k); });
  return out;
}
function fahrStufe(p) {
  const c = (p.lics || []).map(licCode);
  if (c.includes('30') || c.includes('32')) return 'C';
  if (c.includes('31') || c.includes('33')) return 'C1';
  if (c.some(x => ['21', '22', '23', '24'].includes(x))) return 'B';
  return '';
}

function leseArbeitsmappe(file, cb) {
  const fr = new FileReader();
  fr.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      cb(wb);
    } catch (err) { toast('Datei konnte nicht gelesen werden: ' + err.message); }
  };
  fr.readAsArrayBuffer(file);
}

/* findet die Kopfzeile: erste Zeile mit >=2 nicht-leeren Textzellen, die von Daten gefolgt wird */
function kopfzeile(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] || [];
    const gefuellt = r.filter(c => String(c || '').trim() !== '').length;
    if (gefuellt >= 2 && rows[i + 1] && rows[i + 1].filter(c => String(c || '').trim() !== '').length >= 2) return i;
  }
  return 0;
}

function importDialog(quelle, file) {
  if(istArchiv())return;
  leseArbeitsmappe(file, wb => {
    let sheet = wb.SheetNames[0];
    const bau = () => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false, defval: '', raw: false });
      const hr = kopfzeile(rows);
      const heads = (rows[hr] || []).map((h, i) => String(h || '').trim() || 'Spalte ' + (i + 1));
      const auto = {};
      FELDER.forEach(f => {
        const i = heads.findIndex((h, ix) => f.pat.test(h) && !Object.values(auto).includes(ix));
        if (i >= 0) auto[f.k] = i;
      });
      const opt = (sel) => '<option value="-1">— nicht verwenden —</option>' +
        heads.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h)}</option>`).join('');
      const vorschau = rows.slice(hr + 1, hr + 4).map(r =>
        '<tr>' + heads.map((_, i) => `<td>${esc(String(r[i] == null ? '' : r[i]).slice(0, 22))}</td>`).join('') + '</tr>').join('');

      const html = `
        <div class="row" style="margin-bottom:10px">
          <div style="min-width:220px"><label class="f" for="mSheet">Tabellenblatt</label>
            <select id="mSheet">${wb.SheetNames.map(n => `<option ${n === sheet ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          <div><label class="f" for="mHr">Kopfzeile</label><input type="number" id="mHr" value="${hr + 1}" min="1" style="width:80px"></div>
          <div class="hint" style="flex:1">${rows.length - hr - 1} Datenzeilen erkannt. Zuordnung prüfen und bei Bedarf korrigieren.</div>
        </div>
        <div class="scroll" style="max-height:120px;border:1px solid var(--line2);margin-bottom:12px">
          <table class="t"><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${vorschau}</tbody></table>
        </div>
        <table class="t"><thead><tr><th style="width:44%">Feld in der App</th><th>Spalte in der Datei</th></tr></thead><tbody>
        ${FELDER.map(f => `<tr><td>${esc(f.t)}${f.req ? ' <span class="tag">Pflicht</span>' : ''}</td>
          <td><select aria-label="Spalte für ${esc(f.t)}" data-map="${f.k}">${opt(auto[f.k] === undefined ? -1 : auto[f.k])}</select></td></tr>`).join('')}
        </tbody></table>
        <div class="hint" style="margin-top:8px">Alle übrigen Spalten werden mitgeführt und erscheinen im Export. Ohne eindeutige Versicherten-Nr. wird ein neuer Datensatz angelegt.</div><label class="check"><input type="checkbox" id="allowNameMatch"><span>Zusätzlich eindeutige Namen zum Abgleich verwenden. Diese Zuordnungen anschliessend im Dossier prüfen.</span></label>`;

      modal('Import ' + quelle.toUpperCase() + ' — Spalten zuordnen', html, [
        { t: 'Abbrechen' },
        {
          t: 'Importieren', primary: true, fn: () => {
            const map = {}; $$('#dlgB [data-map]').forEach(s => { const v = +s.value; if (v >= 0) map[s.dataset.map] = v; });
            if (map.name === undefined) { toast('Spalte "Name" ist zwingend.'); return false; }
            const hrNow = Math.max(1, +$('#mHr').value) - 1;
            uebernehmen(quelle, rows, hrNow, map, file.name, $('#allowNameMatch').checked);
          }
        }
      ]);
      $('#mSheet').onchange = e => { sheet = e.target.value; bau(); };
      $('#mHr').onchange = () => { /* neu bauen mit gewählter Kopfzeile */
        const v = Math.max(1, +$('#mHr').value) - 1;
        const rows2 = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false, defval: '', raw: false });
        bauMitHr(rows2, v);
      };
      function bauMitHr(rows2, v) {
        const heads2 = (rows2[v] || []).map((h, i) => String(h || '').trim() || 'Spalte ' + (i + 1));
        $$('#dlgB [data-map]').forEach(s => {
          const cur = +s.value;
          s.innerHTML = '<option value="-1">— nicht verwenden —</option>' + heads2.map((h, i) => `<option value="${i}" ${cur === i ? 'selected' : ''}>${esc(h)}</option>`).join('');
        });
      }
    };
    bau();
  });
}

function splitNameValue(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return { vorname: '', nachname: '', display: '' };
  const comma = s.indexOf(',');
  if (comma >= 0) {
    const nachname = s.slice(0, comma).trim();
    const vorname = s.slice(comma + 1).trim();
    if (nachname && vorname) return { vorname, nachname, display: `${vorname} ${nachname}`.trim() };
    if (nachname) return { vorname: '', nachname, display: nachname };
  }
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { vorname: '', nachname: parts[0], display: parts[0] };
  return { vorname: parts.slice(0, -1).join(' '), nachname: parts[parts.length - 1], display: s };
}
function normalizePhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  let norm = digits;
  if (norm.startsWith('00')) norm = norm.slice(2);
  if (norm.startsWith('41') && norm.length === 11) norm = norm.slice(2);
  if (norm.startsWith('0') && norm.length === 10) norm = norm.slice(1);
  if (norm.length !== 9 || !/^7\d|^[1-9]\d{1,7}$/.test(norm)) return '';
  return `+41 ${norm.slice(0, 2)} ${norm.slice(2, 5)} ${norm.slice(5, 7)} ${norm.slice(7, 9)}`;
}

function uebernehmen(quelle, rows, hr, map, dateiname, allowNames=false) {
  if(istArchiv())return;
  const heads = (rows[hr] || []).map((h, i) => String(h || '').trim() || 'Spalte ' + (i + 1));
  const daten = rows.slice(hr + 1).filter(r => String(r[map.name] || '').trim() !== '');
  let neu = 0, ergaenzt = 0;

  daten.forEach(r => {
    const get = k => map[k] === undefined ? '' : String(r[map[k]] == null ? '' : r[map[k]]).trim();
    const nameRaw = get('name');
    const { display, vorname, nachname } = splitNameValue(nameRaw);
    const name = display || nameRaw.replace(/\s*,\s*/, ' ').replace(/\s+/g, ' ');
    if (!name) return;
    const grad = get('grad');
    const key = norm(name);
    const raw = {}; heads.forEach((h, i) => { const v = String(r[i] == null ? '' : r[i]).trim(); if (v) raw[h] = v; });
    const lics = splitLics(get('lics'));
    const telNorm = normalizePhone(get('tel'));

    let p = matchImportPerson(key, get('pnr'), allowNames);
    if (!p) {
      p = { id: uid('p'), key, grad, name, vorname, nachname, funktion: get('funktion'), dt: get('dt'), einteilung: get('einteilung'), lics, zug: get('zug'), pnr: get('pnr'), tel: telNorm || get('tel'), mail: get('mail'), wohnort: get('wohnort'), pisa: false, milo: false, raw: {} };
      p.planning={status:'unreviewed',reason:''};
      S.persons.push(p); neu++;
    } else ergaenzt++;

    const setzen = (k, v, master) => { if (v && (master || !p[k])) p[k] = v; };
    const master = quelle === 'pisa';           // PISA ist Master der Personendaten
    setzen('grad', grad, master);
    setzen('funktion', get('funktion'), master);
    setzen('dt', get('dt'), master);
    setzen('einteilung', get('einteilung'), master);
    setzen('zug', get('zug'), master);
    setzen('pnr', get('pnr'), master);
    setzen('tel', telNorm || get('tel'), master);
    setzen('mail', get('mail'), master);
    setzen('wohnort', get('wohnort'), master);
    if (vorname || nachname) {
      if (vorname && (!p.vorname || master)) p.vorname = vorname;
      if (nachname && (!p.nachname || master)) p.nachname = nachname;
      if (!p.name || master) p.name = display;
    }
    if (lics.length && (master || !(p.lics || []).length)) p.lics = lics;
    Object.assign(p.raw, raw);
    p.key=norm(p.name);
    p.rawSources=Object.assign({},p.rawSources,{[quelle]:raw});
    p[quelle] = true;
  });

  mapsAktualisieren();
  S.src[quelle] = { datei: dateiname, zeit: new Date().toISOString(), anz: daten.length };
  UI.view='groups'; speichern(true); render();
  toast(`${quelle.toUpperCase()}: ${daten.length} Zeilen — ${neu} neue Personen, ${ergaenzt} ergänzt.`);
}

/* trägt neu aufgetauchte Langtexte mit ihrer Kurzform in die Tabellen ein */
function mapsAktualisieren() {
  if (!S.maps) S.maps = { fkt: {}, lic: {} };
  S.persons.forEach(p => {
    const f = String(p.funktion || '').trim();
    if (f && S.maps.fkt[f] === undefined) S.maps.fkt[f] = f.split('/').map(kurzTeil).filter(Boolean).join('/');
    (p.lics || []).forEach(t => {
      if (S.maps.lic[t] === undefined) {
        const c = licCode(t);
        S.maps.lic[t] = c && LIC_TABELLE[c] !== undefined ? LIC_TABELLE[c] : t.replace(/^\d{2,3}\s*/, '');
      }
    });
  });
}

/* =========================================================
   Ansicht 1 — Daten
   ========================================================= */
