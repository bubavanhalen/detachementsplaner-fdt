// Data-integrity regressions. Browser UI is verified separately; no browser packages required.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sources=['core.js','person-helpers.js','import.js','views.js','planning.js','contacts.js'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
const storage=new Map();
let failWrites=false;
const context=vm.createContext({console,crypto:require('node:crypto').webcrypto,document:{querySelector:()=>null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(failWrites)throw Error('Quota');storage.set(k,v);}}});
vm.runInContext(sources+'\nrender=()=>{};toast=()=>{};',context);
const run=code=>vm.runInContext(code,context);
const read=code=>JSON.parse(run(`JSON.stringify(${code})`));
const test=(name,fn)=>{fn();console.log('PASS '+name);};
const legacy={v:2,name:'TEST WK',persons:[{id:'p1',name:'Alex Muster',key:'alex muster',pnr:'TEST-001',pisa:true,raw:{Preserve:'yes'},lics:[]},{id:'p2',name:'Alex Muster',key:'alex muster',pnr:'TEST-002',milo:true,raw:{},lics:[]}],dets:[{id:'d1',name:'WK',ec:'W1',datum:'2027-05-03',von:'08:00',ort:'Bern',treffpunkt:'Tor',anzug:'Uniform',bisDatum:'2027-05-21',entlassungsort:'Bern'},{id:'d2',name:'Zusatz',ec:'Z1',datum:'2027-05-01',von:'09:00',ort:'Thun',treffpunkt:'Bahnhof',anzug:'Uniform',bisDatum:'2027-05-02',entlassungsort:'Thun'}],assign:{d1:['p1'],d2:['p1']},settings:{nurMilo:true},maps:{fkt:{},lic:{}}};
function reset(){storage.clear();failWrites=false;context.fixture=structuredClone(legacy);run('S=projektNormalisieren(fixture);UI.planFilters=null;UI.planQuery="";UI.planScope="available";UI.planSelected=new Set();');}
test('v2 migration preserves records and ambiguous direct assignments',()=>{reset();assert.equal(run('S.v'),4);assert.equal(run('S.persons[0].raw.Preserve'),'yes');assert.equal(run('directGroups("p1").length'),2);assert.equal(run('participation(S.persons[0])'),'unreviewed');assert.equal(run('validationSummary().multiple.length'),1);assert.deepEqual(read('S.dets[0].zusatzIds'),[]);});
test('all-source search, same names, identifiers, no-result state',()=>{reset();assert.equal(run('personenSuche("Alex").length'),2);assert.equal(run('personenSuche("TEST-002")[0].id'),'p2');assert.equal(run('personenSuche("nobody").length'),0);run('UI.personId="p1";UI.query="nobody";viewPersons();');assert.equal(run('UI.personId'),null);});
test('primary assignment is explicit and Zusatz membership is inherited once',()=>{reset();run('assignMain("p1","d1");S.dets[0].zusatzIds=["d2"];');assert.deepEqual(read('directGroups("p1").map(d=>d.id)'),['d1']);assert.deepEqual(read('detsVon("p1").map(d=>d.id)'),['d2','d1']);assert.equal(run('groupPeople(S.dets[1]).length'),1);assert.equal(run('participation(S.persons[0])'),'included');});
test('EC validation, duplicate case, maximum five extras, missing target and cycles',()=>{reset();assert.equal(run('ecGueltig("£!")'),true);assert.equal(run('ecGueltig("A_")'),false);run('S.dets[1].ec="w1"');assert.ok(read('pisaFehler(S.dets[0])').some(t=>t.includes('mehrfach')));run('S.dets[1].ec="Z1";S.dets[0].zusatzIds=["d2"];S.dets[1].zusatzIds=["d1"];');assert.ok(read('pisaFehler(S.dets[0])').some(t=>t.includes('Zusatz-MB')));run('S.dets[0].zusatzIds=["a","b","c","d","e","f"];');assert.ok(read('pisaFehler(S.dets[0])').some(t=>t.includes('fünf')));});
test('PISA marker invalidation follows members, child details and final plan',()=>{reset();run('assignMain("p1","d1");S.dets[0].zusatzIds=["d2"];S.pisa.entered.d1={signature:detSignatur(S.dets[0])};S.pisa.entered.d2={signature:detSignatur(S.dets[1])};S.pisa.verified={signature:planSignatur()};');assert.equal(run('erfasst(S.dets[0])'),true);assert.equal(run('pisaGeprueft()'),true);run('S.dets[1].ort="Basel"');assert.equal(run('erfasst(S.dets[0])'),false);assert.equal(run('erfasst(S.dets[1])'),false);assert.equal(run('pisaGeprueft()'),false);});
test('participation, excluded reasons and duplicate identifiers block final completion',()=>{reset();run('assignMain("p1","d1");S.dets[0].zusatzIds=["d2"];S.persons[1].planning={status:"excluded",reason:"Testentscheid"};S.dets.forEach(d=>S.pisa.entered[d.id]={signature:detSignatur(d)});');assert.equal(run('isReady()'),true);run('S.persons[1].planning.reason=""');assert.equal(run('isReady()'),false);run('S.persons[1].planning.reason="Test";S.persons[1].pnr="TEST.001";');assert.equal(run('validationSummary().duplicateNumbers.length'),2);assert.equal(run('isReady()'),false);});
test('source matching prefers unique identifier and never silently joins different IDs',()=>{reset();assert.equal(run('matchImportPerson("renamed", "TEST.001").id'),'p1');assert.equal(run('matchImportPerson("alex muster", "TEST-003",true)'),null);assert.equal(run('matchImportPerson("alex muster", "")'),null);run('S.persons.pop();');assert.equal(run('matchImportPerson("alex muster", "",true).id'),'p1');assert.ok(run('!!S.persons[0].identityReview'));});
test('import integration keeps namesakes separate and preserves per-source values',()=>{reset();context.rows=[['Name','Nr','Funktion'],['Muster, Alex','TEST-003','Motf'],['Muster, Alex','TEST-001','Inf Sdt']];run('uebernehmen("pisa",rows,0,{name:0,pnr:1,funktion:2},"fixture.csv");');assert.equal(run('S.persons.length'),3);assert.equal(run('S.persons[0].funktion'),'Inf Sdt');assert.equal(run('S.persons[0].rawSources.pisa.Nr'),'TEST-001');assert.equal(run('participation(S.persons[2])'),'unreviewed');});
test('archive snapshots remain unchanged when a working copy is reopened',()=>{reset();run('archiveCurrent();');assert.equal(run('istArchiv()'),true);const snapshot=storage.get('detplaner.archives.v1');run('assignMain("p2","d1")');assert.equal(run('directGroups("p2").length'),0);run('resumeCurrent();S.persons[0].name="Changed";');assert.equal(run('istArchiv()'),false);assert.equal(storage.get('detplaner.archives.v1'),snapshot);assert.equal(run('archiveLibrary().length'),1);});
test('archive quota and corrupt archive never discard active project',()=>{reset();failWrites=true;assert.throws(()=>run('archiveCurrent()'),/Quota/);assert.equal(run('istArchiv()'),false);failWrites=false;storage.set('detplaner.archives.v1','broken');assert.throws(()=>run('archiveCurrent()'),/nicht lesbar/);assert.equal(storage.get('detplaner.archives.v1'),'broken');assert.equal(run('istArchiv()'),false);});
test('invalid duplicate IDs rejected; damaged active storage preserved',()=>{reset();context.invalid={...structuredClone(legacy),persons:[legacy.persons[0],legacy.persons[0]]};assert.throws(()=>run('projektNormalisieren(invalid)'),/IDs/);storage.set('detplaner.v2','broken');assert.equal(run('laden()'),false);assert.equal(storage.get('detplaner.v2'),'broken');});
test('standalone export can be re-exported without corrupting scripts or data',()=>{reset();context.html=fs.readFileSync(path.join(root,'index.html'),'utf8');run('TEMPLATE=html;S.name="Test $& <unsafe>"');const first=run('bundleHtml()');context.first=first;run('TEMPLATE=first;S.name="Second $& <safe>"');const second=run('bundleHtml()');for(const html of [first,second]){const scripts=[...html.matchAll(/<script(?: id="boot-data")?>\s*([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,9);scripts.forEach((s,i)=>new vm.Script(s[1],{filename:'bundle-'+i}));const data=scripts[8][1];const boot={window:{}};vm.runInNewContext(data,boot);assert.equal(boot.window.__BOOTDATA.persons.length,2);}assert.ok(second.includes('Second $& \\u003csafe>'));});
test('bulk reassignment preserves existing planning notes',()=>{reset();run('S.persons[0].planning={status:"included",reason:"Contact confirmed"};assignMain("p1","d1");');assert.equal(run('S.persons[0].planning.reason'),'Contact confirmed');});
test('every workspace renders legacy data, archives and no-match archive searches',()=>{reset();for(const view of ['viewHome','viewPersons','viewGroups','viewPisa','viewOrders','viewDetails','viewSources','viewFiles','viewContacts'])assert.ok(run(view+'()').length>50);run('archiveCurrent();UI.archiveQuery="No matching service";');assert.ok(run('viewFiles()').includes('Keine passenden Archivstände'));run('UI.archiveQuery="Alex";');assert.ok(run('viewFiles()').includes('Alex Muster'));});
test('Excel export round-trips every person and complete MB details',()=>{
  reset();context.document.addEventListener=()=>{};context.document.querySelector=()=>({});context.window={addEventListener:()=>{}};
  context.XLSX=require('../src/vendor/xlsx.js');let output;
  context.XLSX.writeFile=wb=>{output=context.XLSX.read(context.XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});};
  vm.runInContext(fs.readFileSync(path.join(root,'src/app.js'),'utf8'),context);
  run('exportXlsx()');
  const people=context.XLSX.utils.sheet_to_json(output.Sheets.Personal),groups=context.XLSX.utils.sheet_to_json(output.Sheets['Einrückungsdetails']);
  assert.equal(people.length,2);assert.equal(groups.length,2);assert.equal(groups[0].Entlassungsdatum,'21.05.2027');assert.equal(groups[0].Anzug,'Uniform');assert.equal(groups[0].Entlassungsort,'Bern');
});
test('planning starts with names only and allows assignment before MB details',()=>{reset();run('S=leerZustand();createPlanningGroups([" WK Gros ","WK Fahrer","WK Fahrer"," "]);');assert.equal(run('S.dets.length'),2);assert.equal(run('S.dets[0].name'),'WK Gros');assert.equal(run('S.dets[0].ec'),'');assert.equal(run('S.dets[0].datum'),'');run('S.persons=[fixture.persons[0]];assignMain("p1",S.dets[0].id);');assert.equal(run('groupPeople(S.dets[0]).length'),1);const page=run('viewGroups()');for(const field of ['Einrückort','Treffpunkt','Anzug','Abgleich offen'])assert.ok(!page.includes(field));assert.ok(run('pisaFehler(S.dets[0]).length')>0);});
test('additional orders affect only their primary group and display the actual recipients',()=>{reset();run('assignMain("p1","d1");S.assign.d2=[];createPlanningGroups(["Other WK"]);assignMain("p2",S.dets[2].id);setAdditionalOrders("d1",["d2"]);');assert.equal(run('groupPeople(S.dets[1]).length'),1);assert.deepEqual(read('detsVon("p2").map(d=>d.name)'),['Other WK']);const preview=run('orderPreview(S.dets[1])');assert.ok(preview.includes('Zusatzmarschbefehl'));assert.ok(!preview.includes('<small>Hauptmarschbefehl</small>'));assert.ok(preview.includes('Alex Muster'));assert.throws(()=>run('setAdditionalOrders("d2",["d1"])'),/Zusatzverknüpfung/);});
test('draft planning and additional-order changes respect archive protection',()=>{reset();run('archiveCurrent();');const before=run('JSON.stringify(S)');run('createPlanningGroups(["Not allowed"]);setAdditionalOrders("d1",["d2"]);');assert.equal(run('JSON.stringify(S)'),before);});

test('planning filters combine grade alternatives with function, unit and source',()=>{
 reset();run(`S.persons=[{id:'a',name:'A',grad:'Wachtmeister',funktion:'Motf',zug:'1',einteilung:'Kp',pisa:true,milo:true,lics:['30 Lastwagen']},{id:'b',name:'B',grad:'Obwm',funktion:'Inf Sdt',zug:'1',einteilung:'Kp',pisa:true,lics:['21 Personenwagen']},{id:'c',name:'C',grad:'Wm',funktion:'Inf Sdt',zug:'2',einteilung:'Kp',milo:true,lics:['97 Kein Ausweis']}];S.assign={};planningState();UI.planFilters.grades=['Wm'];`);
 assert.deepEqual(read('planningPeople(S.dets[0]).map(p=>p.id)'),['a','c']);
 run("UI.planFilters.grades.push('Obwm');UI.planFilters.platoons=['1'];UI.planFilters.source='both';");
 assert.deepEqual(read('planningPeople(S.dets[0]).map(p=>p.id)'),['a']);
 run("UI.planFilters.source='';UI.planFilters.functions=['Inf Sdt'];UI.planFilters.units=['Kp'];");
 assert.deepEqual(read('planningPeople(S.dets[0]).map(p=>p.id)'),['b']);
 run("UI.planFilters=null;planningState();UI.planFilters.driver='function';");
 assert.deepEqual(read('planningPeople(S.dets[0]).map(p=>p.id)'),['a']);
 run("UI.planFilters.driver='licence';");assert.deepEqual(read('planningPeople(S.dets[0]).map(p=>p.id)'),['a','b']);
 run("UI.planFilters.licences=['30'];");assert.deepEqual(read('planningPeople(S.dets[0]).map(p=>p.id)'),['a']);
});
test('remaining assignment ignores search filters and preserves assigned and excluded people',()=>{
 reset();run(`assignMain('p1','d2');S.persons.push({id:'p3',name:'Excluded',lics:[],planning:{status:'excluded',reason:'Test'}});planningState();UI.planQuery='nobody';UI.planFilters.grades=['Wm'];`);
 assert.equal(run('assignRemaining("d1")'),1);assert.deepEqual(read('S.assign.d1'),['p2']);assert.deepEqual(read('S.assign.d2'),['p1']);assert.equal(run('directGroups("p3").length'),0);
});
test('connecting a populated special creates only its main cohort and empties direct Zusatz personnel',()=>{
 reset();run(`assignMain('p1','d2');assignMain('p2','d1');S.dets[0].custom={keep:true};S.persons[0].planning.reason='Keep note';var connected=connectSpecial('d2','d1');`);
 assert.equal(run('S.dets.length'),3);assert.deepEqual(read('S.assign.d1'),['p2']);assert.deepEqual(read('S.assign.d2'),[]);assert.deepEqual(read('S.assign[connected.id]'),['p1']);
 assert.equal(run('connected.ec'),'');assert.equal(run('connected.ort'),'Bern');assert.equal(run('connected.custom.keep'),true);assert.equal(run('S.persons[0].planning.reason'),'Keep note');assert.deepEqual(read('connected.zusatzIds'),['d2']);
 assert.equal(run('groupPeople(S.dets[1]).length'),1);assert.equal(run('pisaPersonnel(S.dets[1]).length'),0);assert.equal(run('pisaPersonnel(connected).length'),1);
 assert.ok(run('pisaPersonnelHtml(S.dets[1])').includes('0 Personen hier'));assert.ok(!run('pisaPersonnelHtml(S.dets[1])').includes('<table>'));assert.ok(run('pisaPersonnelHtml(connected)').includes('TEST-001'));assert.ok(!run('pisaPersonnelHtml(connected)').includes('TEST-002'));
 context.outputFixture=read('S');run('S=projektNormalisieren(outputFixture)');assert.equal(run('pisaPersonnel(S.dets[1]).length'),0);assert.equal(run('groupPeople(S.dets[1]).length'),1);
});
test('invalid special connection is atomic and archive mutations are blocked',()=>{
 reset();let before=run('JSON.stringify(S)');assert.throws(()=>run('connectSpecial("d2","d1")'),/Mehrfachzuteilungen/);assert.equal(run('JSON.stringify(S)'),before);
 run('assignMain("p1","d2");archiveCurrent();');before=run('JSON.stringify(S)');run('connectSpecial("d2","d1");assignRemaining("d1");');assert.equal(run('JSON.stringify(S)'),before);
});
test('PISA export contains only direct main personnel, no duplicate Zusatz rows',()=>{
 reset();run(`assignMain('p1','d2');assignMain('p2','d1');connectSpecial('d2','d1');`);let wb;context.XLSX.writeFile=value=>wb=value;run('exportXlsx()');
 const rows=context.XLSX.utils.sheet_to_json(wb.Sheets['PISA-Zuteilungen']);assert.equal(rows.length,2);assert.ok(!rows.some(r=>r.Hauptdetachement==='Zusatz'));assert.equal(rows.find(r=>r['Versicherten-Nr.']==='TEST-001')['Zusatz-EC'],'Z1');
});
test('new main cohort proposes later main details without overwriting its own edits or EC',()=>{
 reset();run(`S.dets[0]=neuesDet({id:'d1',name:'WK'});assignMain('p1','d2');var linked=connectSpecial('d2','d1');S.dets[0].ort='Bern';S.dets[0].ec='W1';`);
 assert.equal(run('detailsDraft(linked).ort'),'Bern');assert.equal(run('detailsDraft(linked).ec'),'');assert.equal(run('linked.ort'),'');run("linked.ort='Thun'");assert.equal(run('detailsDraft(linked).ort'),'Thun');
});
test('driver function filter does not mistake vehicle mechanics for drivers',()=>{
 reset();assert.equal(run('istFahrer({funktion:"Fahrzeugmechaniker"})'),false);assert.equal(run('istFahrer({funktion:"Motorfahrer"})'),true);assert.equal(run('istFahrer({funktion:"Fahr C"})'),true);
});

test('contact overview preselects planned reachable people and keeps selection across filters',()=>{
 reset();run(`S.persons[0].tel='+41 79 000 00 01';assignMain('p1','d1');S.persons[1].mail='other@example.invalid';`);
 assert.deepEqual(read('selectedContacts().map(p=>p.id)'),['p1']);
 run("contactState().scope='missing';");assert.equal(run('visibleContacts().length'),0);assert.equal(run('selectedContacts().length'),1);assert.ok(run('contactsSummaryHtml()').includes('1 ausserhalb'));
 run("contactState().scope='all';contactState().query='0790000001';");assert.equal(run('visibleContacts().length'),0);
 run("contactState().query='790000001';");assert.deepEqual(read('visibleContacts().map(p=>p.id)'),['p1']);
 run("contactState().query='';S.dets[0].zusatzIds=['d2'];contactState().group='d2';");assert.deepEqual(read('visibleContacts().map(p=>p.id)'),['p1']);
 run("S=leerZustand();");assert.equal(run('selectedContacts().length'),0);assert.equal(run('contactState().group'),'');
});
test('Google CSV round-trips quoted names, Unicode, phone text and documented columns only',()=>{
 reset();run(`S.persons[0].name='Zoë "Test", Muster';S.persons[0].vorname='wrong';S.persons[0].nachname='stale';S.persons[0].tel='+41 79 000 00 01';S.persons[0].mail='zoe@example.invalid';assignMain('p1','d1');S.dets[0].zusatzIds=['d2'];S.persons[0].grad='Wm';`);
 context.csvOptions={rank:true,groups:true,label:'Dienst, "Test"\n2027'};
 const csv=run('googleContactsCsv([S.persons[0]],csvOptions)');
 const wb=context.XLSX.read(Buffer.from(csv,'utf8'),{type:'buffer',raw:true}),rows=context.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});
 assert.deepEqual(rows[0],['Name Prefix','First Name','Last Name','Email 1 - Label','Email 1 - Value','Phone 1 - Label','Phone 1 - Value','Labels']);
 assert.equal(rows.length,2);assert.equal(rows[1][1],'Zoë "Test", Muster');assert.equal(rows[1][2],'');assert.equal(rows[1][6],'+41 79 000 00 01');assert.equal(rows[1][0],'Wm');assert.ok(rows[1][7].includes('Dienst, "Test"\n2027'));assert.ok(rows[1][7].includes('Zusatz'));
 assert.ok(!csv.includes('TEST-001'));assert.ok(!csv.includes('Preserve'));assert.ok(!csv.includes('Einrück'));
});
test('contact warnings flag absent and duplicate data without merging distinct people',()=>{
 reset();assert.ok(read('contactWarnings(S.persons[0])').includes('Telefon und E-Mail fehlen'));
 run(`S.persons[0].tel='0790000001';S.persons[0].mail='invalid';S.persons[1].mail='INVALID';`);
 assert.equal(run('contactWarnings(S.persons[0]).length'),2);assert.equal(run('contactDuplicates(S.persons).size'),2);assert.equal(read('googleContactRows(S.persons)').length,3);
});
test('contact corrections retain source values and assignments and respect archived data',()=>{
 reset();run(`saveContact('p1',{first:'Alex Marie',last:'von Muster',phone:'+49 30 123456',email:'alex@example.invalid'});`);
 assert.equal(run('S.persons[0].name'),'Alex Marie von Muster');assert.equal(run('contactNames(S.persons[0]).last'),'von Muster');assert.equal(run('S.persons[0].raw.Preserve'),'yes');assert.equal(run('directGroups("p1").length'),2);
 assert.throws(()=>run(`saveContact('p1',{first:'',last:''})`),/Namen/);
 run('archiveCurrent();');const before=run('JSON.stringify(S)');run(`saveContact('p1',{first:'Changed'});googleContactsCsv(S.persons);viewContacts();`);assert.equal(run('JSON.stringify(S)'),before);
});
test('contact download exports the selected subset and refuses empty or oversized selections',()=>{
 reset();let exported;context.download=(name,content,type)=>exported={name,content,type};
 assert.throws(()=>run('exportContacts()'),/auswählen/);run(`contactState().selected.add('p2');exportContacts();`);assert.ok(exported.name.startsWith('Google_Kontakte_'));assert.equal(context.XLSX.utils.sheet_to_json(context.XLSX.read(Buffer.from(exported.content,'utf8'),{type:'buffer',raw:true}).Sheets.Sheet1).length,1);
 run(`S.persons=Array.from({length:3001},(_,i)=>({id:'many'+i,name:'Test '+i,lics:[]}));UI.contacts=null;S.persons.forEach(p=>contactState().selected.add(p.id));`);assert.throws(()=>run('exportContacts()'),/3000/);
});
console.log('30 planner integrity regressions passed.');
