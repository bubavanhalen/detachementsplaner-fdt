'use strict';
const LSKEY = 'detplaner.v2'; // Retain the established browser storage key.
const ARCHIVEKEY = 'detplaner.archives.v1';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => p + '_' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
const GRADE_OF = ['Br','Oberst','Oberstlt','Maj','Hptm','Oblt','Lt'];
const GRADE_UOF = ['Adj Uof','Hptadj','Stabsadj','Four','Hptfw','Fw','Obwm','Wm','Kpl'];
const GRADE_ORDER = [...GRADE_OF,...GRADE_UOF,'Obgfr','Gfr','Sdt','Rekr'];
let S = leerZustand();
let UI = { view:'home', query:'', filter:'all', personId:null, groupId:null, groupQuery:'', selected:new Set(), sourceOpen:false, pisaId:null, pisaStep:'details', archiveQuery:'' };
let TEMPLATE = '';

function leerZustand() {
  return { v:4, id:uid('project'), name:'Neue Dienstleistung', persons:[], dets:[], assign:{},
    service:{ start:'', end:'', year:'', note:'' }, src:{pisa:null,milo:null}, maps:{fkt:{},lic:{}},
    settings:{eigeneEinheit:'',puffer:60,nurMilo:false}, pisa:{entered:{},verified:null}, archive:null };
}
function neuesDet(o = {}) {
  const d = Object.assign({id:uid('d'),name:'',ec:'',datum:'',von:'',bis:'',bisDatum:'',ort:'',treffpunkt:'',anzug:'',entlassungsort:'',bem:'',soll:'',fahrzeug:'',zusatzIds:[]},o);
  for (const k of ['name','ec','datum','von','bis','bisDatum','ort','treffpunkt','anzug','entlassungsort','bem','soll','fahrzeug']) d[k] = String(d[k] ?? '');
  d.zusatzIds = [...new Set(Array.isArray(d.zusatzIds) ? d.zusatzIds : [])];
  return d;
}
function projektNormalisieren(o) {
  if (!o || !Array.isArray(o.persons) || (o.dets && !Array.isArray(o.dets))) throw Error('Die Datei enthält kein gültiges Projekt.');
  const validIds = list => list.every(x => x && typeof x.id === 'string' && x.id) && new Set(list.map(x => x.id)).size === list.length;
  if (!validIds(o.persons) || !validIds(o.dets || [])) throw Error('Personen oder Gruppen haben fehlende/doppelte IDs. Die Datei wurde nicht geladen.');
  const base = leerZustand();
  const migrated = Object.assign(base,o,{v:4,service:Object.assign({},base.service,o.service || {}),
    settings:Object.assign({},base.settings,o.settings || {}),src:Object.assign({},base.src,o.src || {}),maps:Object.assign({},base.maps,o.maps || {}),
    persons:o.persons.map(p => Object.assign({name:'',grad:'',funktion:'',lics:[],raw:{}},p,{planning:Object.assign({status:'unreviewed',reason:''},p.planning || {})})),
    dets:(o.dets || []).map(neuesDet), assign:o.assign || {},
    pisa:{entered:o.pisa?.entered || {},verified:o.pisa?.verified || null},archive:o.archive?.at ? o.archive : null});
  for (const d of migrated.dets) {
    if (!Array.isArray(migrated.assign[d.id])) migrated.assign[d.id] = [];
  }
  for(const p of migrated.persons){if(!['unreviewed','included','excluded'].includes(p.planning.status))p.planning.status='unreviewed';}
  return migrated;
}
function istArchiv() { return !!S.archive; }
function pById(id) { return S.persons.find(p => p.id === id); }
function detById(id) { return S.dets.find(d => d.id === id); }
function personen() { return S.persons.slice(); }
function directGroups(pid) { return S.dets.filter(d => (S.assign[d.id] || []).includes(pid)); }
function detsVon(pid) {
  const direct = directGroups(pid), ids = new Set(direct.flatMap(d => [d.id,...d.zusatzIds]));
  return S.dets.filter(d => ids.has(d.id)).sort((a,b) => (a.datum+a.von).localeCompare(b.datum+b.von));
}
function zugeteilt(pid) { return directGroups(pid).length > 0; }
function groupPeople(d) {
  const ids = new Set(S.assign[d.id] || []);
  S.dets.filter(g => g.zusatzIds.includes(d.id)).forEach(g => (S.assign[g.id] || []).forEach(id => ids.add(id)));
  return S.persons.filter(p => ids.has(p.id));
}
function participation(p) { return p.planning?.status || 'unreviewed'; }
function participationLabel(p) { return {unreviewed:'Teilnahme klären',included:'Einplanen',excluded:'Nicht einplanen'}[participation(p)] || 'Teilnahme klären'; }
function personSource(p) { return [p.pisa ? 'PISA' : '',p.milo ? 'MILOFFICE' : ''].filter(Boolean).join(' + ') || 'Manuell'; }
function fmtDatum(iso) { if (!iso) return 'Offen'; const [y,m,d] = iso.split('-'); return d && m && y ? `${d}.${m}.${y}` : iso; }
function zeitpunkt(iso) { return iso ? new Date(iso).toLocaleString('de-CH') : 'Unbekannt'; }
function fmtRange(d) { return `${fmtDatum(d.datum)}${d.bisDatum ? ' – '+fmtDatum(d.bisDatum) : ''}`; }
function ecGueltig(ec) { const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz£!#$*+-:=?@[]^{}~'; return [...ec].length===2 && [...ec].every(c=>chars.includes(c)); }
function detailWerte(d) { return [['Einrückcode',d.ec],['Einrückdatum',fmtDatum(d.datum)],['Einrückzeit',d.von],['Einrückort',d.ort],['Treffpunkt',d.treffpunkt],['Anzug',d.anzug],['Entlassungsdatum',d.bisDatum ? fmtDatum(d.bisDatum) : ''],['Entlassungsort',d.entlassungsort],['Bemerkung MB',d.bem]]; }
function pisaFehler(d) {
  const list=[];
  if (!ecGueltig(d.ec)) list.push('Einrückcode: genau zwei zulässige Zeichen.');
  if (d.ec && S.dets.some(x=>x.id!==d.id && x.ec.toUpperCase()===d.ec.toUpperCase())) list.push('Dieser Einrückcode ist mehrfach vergeben.');
  const missing=[['datum','Einrückdatum'],['von','Einrückzeit'],['ort','Einrückort'],['treffpunkt','Treffpunkt'],['anzug','Anzug'],['bisDatum','Entlassungsdatum'],['entlassungsort','Entlassungsort']].filter(([k])=>!d[k]).map(([,l])=>l);
  if(missing.length) list.push('Offen: '+missing.join(', ')+'.');
  if(d.datum && d.bisDatum && d.bisDatum<d.datum) list.push('Entlassung liegt vor dem Einrücken.');
  if([...d.bem].length>240) list.push('Bemerkung hat mehr als 240 Zeichen.');
  if(d.zusatzIds.length>5) list.push('Höchstens fünf Zusatz-MB pro Hauptdetachement.');
  if(d.zusatzIds.some(id=>id===d.id || !detById(id) || detById(id).zusatzIds.length)) list.push('Zusatz-MB müssen vorhandene Gruppen ohne eigene Zusatz-Verknüpfungen sein.');
  return list;
}
function personIssues(p) {
  const issues=[], main=directGroups(p.id), all=detsVon(p.id);
  if(participation(p)==='unreviewed') issues.push('Einrückungspflicht/DVM prüfen und Teilnahme festlegen.');
  if(participation(p)==='included' && !main.length) issues.push('Noch keiner Einrückungsgruppe zugewiesen.');
  if(main.length>1) issues.push('Mehrere direkte Zuteilungen aus dem bisherigen Plan. Ein Hauptdetachement festlegen.');
  if(participation(p)==='excluded' && main.length) issues.push('Trotz Ausschluss noch einer Gruppe zugeteilt.');
  if(participation(p)==='excluded' && !p.planning?.reason) issues.push('Begründung für «Nicht einplanen» fehlt.');
  if(p.identityReview) issues.push('Identität beim Quellenabgleich überprüfen: '+p.identityReview);
  if(p.pnr&&S.persons.some(q=>q.id!==p.id&&canonicalNumber(q.pnr)===canonicalNumber(p.pnr)))issues.push('Versicherten-Nr. ist bei mehreren Personen vorhanden. Quelldaten prüfen.');
  all.forEach(d=>pisaFehler(d).forEach(t=>issues.push(`EC ${d.ec || 'offen'}: ${t}`)));
  const ranges=all.filter(d=>d.datum&&d.bisDatum).sort((a,b)=>a.datum.localeCompare(b.datum));
  for(let i=1;i<ranges.length;i++) if(ranges[i].datum<=ranges[i-1].bisDatum) issues.push(`Dienstperioden von EC ${ranges[i-1].ec} und ${ranges[i].ec} überschneiden sich oder berühren denselben Tag; Zeiten prüfen.`);
  if(main.some(d=>d.zusatzIds.length)) issues.push('Haupt-/Zusatz-MB mit dem Dienstverlauf abgleichen; KVK/WK-Sonderfälle gemäss PAT/KF klären.');
  return [...new Set(issues)];
}
function validationSummary() {
  return {unreviewed:S.persons.filter(p=>participation(p)==='unreviewed'),
    unassigned:S.persons.filter(p=>participation(p)==='included'&&!zugeteilt(p.id)),
    identity:S.persons.filter(p=>p.identityReview),
    multiple:S.persons.filter(p=>directGroups(p.id).length>1),
    excludedAssigned:S.persons.filter(p=>participation(p)==='excluded'&&zugeteilt(p.id)),
    excludedReason:S.persons.filter(p=>participation(p)==='excluded'&&!p.planning?.reason),
    duplicateNumbers:S.persons.filter(p=>p.pnr&&S.persons.some(q=>q.id!==p.id&&canonicalNumber(q.pnr)===canonicalNumber(p.pnr))),
    groupErrors:S.dets.filter(d=>pisaFehler(d).length),
    dangling:S.dets.filter(d=>(S.assign[d.id]||[]).some(id=>!pById(id))),
    empty:S.dets.filter(d=>!groupPeople(d).length)};
}
function detSignatur(d) {
  const details = g => [g.id,g.name,g.ec,g.datum,g.von,g.ort,g.treffpunkt,g.anzug,g.bisDatum,g.entlassungsort,g.bem,g.zusatzIds];
  return JSON.stringify([details(d),d.zusatzIds.map(id=>detById(id)).filter(Boolean).map(details),groupPeople(d).map(p=>[p.id,p.pnr||'',p.name,p.grad,p.funktion,participation(p),directGroups(p.id).map(g=>g.id)]).sort((a,b)=>a[0].localeCompare(b[0]))]);
}
function planSignatur() { return JSON.stringify([S.name,S.service,S.settings.eigeneEinheit,S.persons,S.dets.map(detSignatur)]); }
function erfasst(d) { return S.pisa.entered[d.id]?.signature===detSignatur(d); }
function pisaGeprueft() { return S.pisa.verified?.signature===planSignatur(); }
function erfassungsStatus(d) { return erfasst(d)?'Abgeglichen':S.pisa.entered[d.id]?'Erneut abgleichen':'Abgleich offen'; }
function isReady() { const v=validationSummary(); return S.persons.length>0 && S.dets.length>0 && Object.values(v).every(l=>l.length===0) && S.dets.every(erfasst); }
function assignMain(pid,did) {
  if(istArchiv()) return;
  const p=pById(pid); if(!p || (did&&!detById(did))) return;
  S.dets.forEach(d=>S.assign[d.id]=(S.assign[d.id]||[]).filter(id=>id!==pid));
  if(did) { S.assign[did].push(pid); p.planning={...p.planning,status:'included',reason:participation(p)==='excluded'?'':p.planning?.reason||''}; }
}
function canonicalNumber(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function matchImportPerson(key,pnr,allowNames=false) {
  const canon=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const number=canon(pnr);
  if(number) {const hits=S.persons.filter(p=>canon(p.pnr)===number); if(hits.length===1)return hits[0]; if(hits.length>1)return null;}
  if(!allowNames)return null;
  const candidates=S.persons.filter(p=>p.key===key && (!number || !canon(p.pnr) || canon(p.pnr)===number));
  if(candidates.length===1){candidates[0].identityReview='Nur über den Namen zugeordnet.';return candidates[0];}
  return null;
}
function personenSuche(q=UI.query) {
  const tokens=norm(q).split(/\s+/).filter(Boolean);
  return S.persons.filter(p=>{
    const text=norm([p.name,p.grad,p.pnr,String(p.pnr||'').replace(/\D/g,''),p.funktion,p.zug,p.einteilung,p.mail,...detsVon(p.id).flatMap(d=>[d.name,d.ec,d.ort,d.treffpunkt])].join(' '));
    return tokens.every(t=>text.includes(t));
  }).sort((a,b)=>a.name.localeCompare(b.name,'de-CH')||String(a.pnr||'').localeCompare(String(b.pnr||'')));
}
function visiblePeople() { return personenSuche().filter(p=>UI.filter==='all'||UI.filter==='unassigned'&&participation(p)==='included'&&!zugeteilt(p.id)||UI.filter==='issues'&&personIssues(p).length||participation(p)===UI.filter); }
function speichern() {
  try{localStorage.setItem(LSKEY,JSON.stringify(S));setState('Gespeichert · '+new Date().toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}));return true;}
  catch(e){setState('Speicher voll · Projektdatei sichern');toast('Speichern fehlgeschlagen. Bitte Projektdatei sichern.');return false;}
}
function setState(text){const el=$('#saveState');if(el)el.textContent=text;}
function laden(){try{const raw=localStorage.getItem(LSKEY);if(!raw)return false;S=projektNormalisieren(JSON.parse(raw));return true;}catch(e){toast('Gespeichertes Projekt konnte nicht gelesen werden. Der gespeicherte Inhalt bleibt erhalten.');return false;}}
function archiveLibrary(){try{const raw=JSON.parse(localStorage.getItem(ARCHIVEKEY)||'[]');if(!Array.isArray(raw)||raw.some(x=>!x?.archive?.id||!x.archive.at||!Array.isArray(x.persons)||!Array.isArray(x.dets)))throw Error();return raw;}catch(e){throw Error('Die lokale Archivablage ist nicht lesbar. Sie wurde nicht überschrieben.');}}
function storeSnapshot(snapshot){const list=archiveLibrary();if(!list.some(x=>x.archive?.id===snapshot.archive.id)){list.unshift(snapshot);localStorage.setItem(ARCHIVEKEY,JSON.stringify(list));}}
function archiveCurrent(){
  if(istArchiv())return;
  const snapshot=JSON.parse(JSON.stringify(S));snapshot.archive={id:uid('archive'),at:new Date().toISOString()};
  storeSnapshot(snapshot);S=snapshot;speichern();UI.view='persons';UI.query='';UI.filter='all';render();
}
function resumeCurrent(){
  if(!istArchiv())return;
  if(!S.archive.id)S.archive.id=uid('archive');
  storeSnapshot(JSON.parse(JSON.stringify(S)));
  S=JSON.parse(JSON.stringify(S));S.archive=null;S.id=uid('project');speichern();UI.view='home';render();
}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
function dateiname(ext){return(S.name||'Einrueckungsplanung').replace(/[^\wÄÖÜäöü -]/g,'').trim().replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.'+ext;}
function saveFile(){download(dateiname('json'),JSON.stringify(S,null,2),'application/json');toast('Projektdatei erstellt.');}
function bundleHtml(){const marker='<!--'+'BOOT'+'-->';const pattern=new RegExp('<scr'+'ipt id="boot-data">[\\s\\S]*?<\\/script>','g');const clean=TEMPLATE.replace(pattern,marker);return clean.replace(marker,()=>'<scr'+'ipt id="boot-data">window.__BOOTDATA='+JSON.stringify(S).replace(/</g,'\\u003c')+';<\/script>');}
function exportBundle(){download(dateiname('html'),bundleHtml(),'text/html');}
function toast(text){$$('.toast').forEach(e=>e.remove());const el=document.createElement('div');el.className='toast';el.textContent=text;document.body.appendChild(el);const live=$('#liveMessage');if(live)live.textContent=text;setTimeout(()=>el.remove(),3500);}
function modal(title,body,buttons){const dlg=$('#dlg');$('#dlgH').textContent=title;$('#dlgB').innerHTML=body;$('#dlgF').innerHTML='';
  for(const b of buttons||[{t:'Schliessen'}]){const el=document.createElement('button');el.className='button'+(b.primary?' primary':'')+(b.danger?' danger':'');el.textContent=b.t;el.onclick=()=>{try{if(!b.fn||b.fn()!==false)dlg.close();}catch(e){toast(e.message);}};$('#dlgF').appendChild(el);}
  if(!dlg.open)dlg.showModal();return dlg;
}
function formField(key,label,value='',type='text',extra=''){return `<label class="field"><span>${label}</span><input id="field-${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
function field(key){return $('#field-'+key).value.trim();}
function go(view){UI.view=view;UI.selected.clear();if(view!=='persons'){UI.query='';$('#globalSearch').value='';}render();window.scrollTo(0,0);}
function openPerson(id){UI.view='persons';UI.personId=id;UI.query='';UI.filter='all';$('#globalSearch').value='';render();}
function afterChange(){speichern();render();}
