function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[àáâä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function rolle(grad) {
  const g = String(grad || '').trim();
  if (GRADE_OF.some(x => x.toLowerCase() === g.toLowerCase())) return 'of';
  if (GRADE_UOF.some(x => x.toLowerCase() === g.toLowerCase())) return 'uof';
  return 'mannschaft';
}
function gradIdx(g) { const i = GRADE_ORDER.findIndex(x => x.toLowerCase() === String(g || '').trim().toLowerCase()); return i < 0 ? 99 : i; }
function istFahrer(p) {            // Fahrer laut Funktion
  return /\b(?:motf|fahr)\b|fahrer|chauffeur|driver|conducteur/i.test(String(p.funktion || ''));
}
function hatAusweis(p) { return kats(p).length > 0; }
