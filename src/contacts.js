// Local preview and Google Contacts CSV. No data is sent to Google by the app.
// Field names: https://support.google.com/contacts/answer/15147365?hl=de
function contactState(){
  if(!UI.contacts||UI.contacts.projectId!==S.id){
    UI.contacts={projectId:S.id,query:'',scope:'all',group:'',rank:false,groups:false,label:S.name,
      selected:new Set(S.persons.filter(p=>participation(p)==='included'&&hasContactData(p)).map(p=>p.id))};
  }
  return UI.contacts;
}
function hasContactData(p){return !!(String(p.tel||'').trim()||String(p.mail||'').trim());}
function contactNames(p){
  const first=String(p.vorname||'').trim(),last=String(p.nachname||'').trim();
  // Preserve explicitly separated names when they still match the current name.
  // Legacy/manual names remain intact instead of guessing where a surname begins.
  if((first||last)&&norm([first,last].join(' '))===norm(p.name))return {first,last};
  return {first:String(p.name||'').trim(),last:''};
}
function contactLabels(p,options){
  return [...new Set([String(options.label||'').trim(),...(options.groups?detsVon(p.id).map(d=>d.name):[])].filter(Boolean))];
}
function contactExportName(p,options){
  const names=contactNames(p);return [options.rank?p.grad:'',names.first,names.last].filter(Boolean).join(' ');
}
function contactWarnings(p){
  const warnings=[],phone=String(p.tel||'').trim(),mail=String(p.mail||'').trim();
  if(!String(p.name||'').trim())warnings.push('Name fehlt');
  if(!hasContactData(p))warnings.push('Telefon und E-Mail fehlen');
  if(phone&&!/^\+[\d\s().-]{6,}$/.test(phone))warnings.push('Telefonformat / Ländercode prüfen');
  if(mail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))warnings.push('E-Mail prüfen');
  return warnings;
}
function contactDuplicates(people){
  const ids=new Set();
  for(const key of ['tel','mail']){
    const seen=new Map();
    for(const p of people){
      const value=key==='tel'?String(p.tel||'').replace(/\D/g,'').replace(/^00/,''):String(p.mail||'').trim().toLowerCase();
      if(!value)continue;
      if(seen.has(value)){ids.add(p.id);ids.add(seen.get(value));}else seen.set(value,p.id);
    }
  }
  return ids;
}
function selectedContacts(){const state=contactState();return S.persons.filter(p=>state.selected.has(p.id));}
function visibleContacts(){
  const state=contactState(),query=norm(state.query),digits=state.query.replace(/\D/g,'');
  return S.persons.filter(p=>{
    const groups=detsVon(p.id);
    const text=norm([p.name,p.grad,p.funktion,p.tel,p.mail,...groups.map(d=>d.name+' '+d.ec)].join(' '));
    return (!query||text.includes(query)||(digits.length>=3&&/^\+?[\d\s().-]+$/.test(state.query)&&String(p.tel||'').replace(/\D/g,'').includes(digits)))
      &&(!state.group||groups.some(d=>d.id===state.group))
      &&(state.scope==='all'||state.scope==='included'&&participation(p)==='included'||state.scope==='missing'&&!hasContactData(p)||state.scope==='selected'&&state.selected.has(p.id));
  }).sort((a,b)=>a.name.localeCompare(b.name,'de-CH'));
}
function googleContactRows(people,options={}){
  return [['Name Prefix','First Name','Last Name','Email 1 - Label','Email 1 - Value','Phone 1 - Label','Phone 1 - Value','Labels'],
    ...people.map(p=>{const names=contactNames(p),mail=String(p.mail||'').trim(),phone=String(p.tel||'').trim();
      return [options.rank?p.grad||'':'',names.first,names.last,'',mail,phone?'Mobile':'',phone,contactLabels(p,options).join(' ::: ')];})];
}
function googleContactsCsv(people,options={}){
  const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  return '\uFEFF'+googleContactRows(people,options).map(row=>row.map(cell).join(',')).join('\r\n');
}
function exportContacts(){
  const people=selectedContacts();
  if(!people.length)throw Error('Bitte zuerst Kontakte auswählen.');
  if(people.length>3000)throw Error('Pro Google-Import höchstens 3000 Kontakte auswählen. Nutze dafür die Detachementfilter.');
  download('Google_Kontakte_'+dateiname('csv'),googleContactsCsv(people,contactState()),'text/csv;charset=utf-8');
  toast(people.length+' Kontakte als CSV erstellt. In Google Kontakte unter «Importieren» öffnen.');
}
function saveContact(id,values){
  if(istArchiv())return;
  const p=pById(id);if(!p)throw Error('Person nicht gefunden.');
  const first=String(values.first||'').trim(),last=String(values.last||'').trim();
  if(!first&&!last)throw Error('Bitte einen Namen eingeben.');
  Object.assign(p,{vorname:first,nachname:last,name:[first,last].filter(Boolean).join(' '),tel:String(values.phone||'').trim(),mail:String(values.email||'').trim()});
  p.key=norm(p.name);
}
function contactDialog(id){
  if(!writable())return;const p=pById(id),names=contactNames(p);
  modal('Kontaktdaten · '+p.name,`<p class="muted">Diese Angaben werden im Projekt gespeichert und in der CSV verwendet. Die importierten Originalwerte bleiben in den Quelldaten erhalten.</p><div class="form-grid">${formField('contact-first','Vorname',names.first)}${formField('contact-last','Nachname',names.last)}${formField('contact-phone','Mobiltelefon (mit Ländercode)',p.tel||'','tel')}${formField('contact-mail','E-Mail',p.mail||'','email')}</div><p class="muted">Bei älteren Datensätzen kann der vollständige Name im Feld «Vorname» stehen. Du kannst ihn hier bei Bedarf aufteilen.</p>`,[{t:'Abbrechen'},{t:'Kontaktdaten speichern',primary:true,fn:()=>{saveContact(id,{first:field('contact-first'),last:field('contact-last'),phone:field('contact-phone'),email:field('contact-mail')});afterChange();}}]);
}
function contactsSummaryHtml(){
  const people=selectedContacts(),visible=new Set(visibleContacts().map(p=>p.id)),hidden=people.filter(p=>!visible.has(p.id)).length;
  const warnings=people.filter(p=>contactWarnings(p).length).length,duplicates=contactDuplicates(people).size;
  return `<div class="contact-export-bar"><div><b>${people.length} ${people.length===1?'Kontakt ausgewählt':'Kontakte ausgewählt'}</b><p class="muted">${people.filter(p=>p.tel).length} mit Telefon · ${people.filter(p=>p.mail).length} mit E-Mail${hidden?' · '+hidden+' ausserhalb des aktuellen Filters':''}</p>${warnings||duplicates?`<small class="contact-warning">${warnings?warnings+' mit Prüfhinweisen':''}${warnings&&duplicates?' · ':''}${duplicates?duplicates+' mit mehrfach verwendeter Telefonnummer oder E-Mail':''}. Werte in der Vorschau prüfen; die Auswahl wird vollständig exportiert.</small>`:''}${people.length>3000?'<p class="contact-warning">Für einen Google-Import höchstens 3000 Kontakte auswählen.</p>':''}</div><button class="button primary" data-action="export-contacts" ${!people.length||people.length>3000?'disabled':''}>Google-CSV herunterladen (${people.length})</button></div>`;
}
function contactsTableHtml(){
  const state=contactState(),people=visibleContacts(),duplicates=contactDuplicates(selectedContacts());
  return `<div class="panel-head"><b>${people.length} ${people.length===1?'Person':'Personen'} angezeigt</b><div class="actions">${btn('Alle angezeigten auswählen','contacts-select')}${btn('Auswahl leeren','contacts-clear')}</div></div><div class="scroll"><table class="contacts-table"><thead><tr><th>Export</th><th>Name im Export</th><th>Mobiltelefon</th><th>E-Mail</th><th>Detachemente / Labels</th><th>Prüfen</th></tr></thead><tbody>${people.map(p=>{
    const warnings=contactWarnings(p);if(duplicates.has(p.id))warnings.push('Kontaktdaten mehrfach verwendet');
    return `<tr><td><input type="checkbox" data-contact-person="${esc(p.id)}" aria-label="${esc(p.name)} exportieren" ${state.selected.has(p.id)?'checked':''}></td><td><b>${esc(contactExportName(p,state))}</b><small class="muted">${esc(participationLabel(p))}</small></td><td class="contact-value">${esc(p.tel||'—')}</td><td class="contact-value">${esc(p.mail||'—')}</td><td><small>${detsVon(p.id).map(d=>esc(d.name)).join('<br>')||'Ohne Detachement'}</small><small class="muted">Labels: ${contactLabels(p,state).map(esc).join(' · ')||'Keine'}</small></td><td>${warnings.map(w=>`<small class="contact-warning">${esc(w)}</small>`).join('')||'<small class="muted">Bereit</small>'}${istArchiv()?'':btn('Bearbeiten','contact-edit',p.id)}</td></tr>`;
  }).join('')||'<tr><td colspan="6">Keine passenden Personen. Suche oder Filter ändern.</td></tr>'}</tbody></table></div>`;
}
function refreshContacts(){
  $('#contactsSummary').innerHTML=contactsSummaryHtml();$('#contactsTable').innerHTML=contactsTableHtml();
}
function viewContacts(){
  const state=contactState();
  const head=heading('Google-Kontakte vorbereiten','Kontaktdaten prüfen, Personen auswählen und die CSV für Google Kontakte herunterladen.','','KONTAKTEXPORT');
  if(!S.persons.length)return head+empty('Noch keine Personen','Lade zuerst deine PISA- oder MILOFFICE-Liste mit Kontaktdaten.',navbtn('Datenquellen öffnen','sources',true));
  return head+`<section class="panel panel-body"><div class="contact-controls"><label class="field"><span>Personen suchen</span><input type="search" id="contactSearch" aria-label="Kontakte suchen" placeholder="Name, Telefon, E-Mail oder Funktion…" value="${esc(state.query)}"></label><label class="field"><span>Detachement</span><select data-contact-filter="group" aria-label="Kontakte nach Detachement filtern"><option value="">Alle Detachemente</option>${S.dets.map(d=>`<option value="${esc(d.id)}" ${state.group===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><label class="field"><span>Personenkreis</span><select data-contact-filter="scope" aria-label="Kontakte nach Status filtern">${[['all','Alle Personen'],['included','Eingeplante Personen'],['missing','Ohne Telefon und E-Mail'],['selected','Nur meine Auswahl']].map(([v,t])=>`<option value="${v}" ${state.scope===v?'selected':''}>${t}</option>`).join('')}</select></label></div><p class="muted contact-hint">Beim ersten Öffnen sind eingeplante Personen mit Telefon oder E-Mail vorausgewählt. Filter ändern nur die Anzeige; deine Auswahl bleibt erhalten.</p><details class="contact-options"><summary>Name und Google-Labels anpassen</summary><div class="contact-controls"><label class="field"><span>Gemeinsames Google-Label</span><input id="contactLabel" aria-label="Gemeinsames Google-Label" value="${esc(state.label)}" placeholder="Zum Beispiel WK 2027"></label><label class="check"><input type="checkbox" data-contact-option="rank" ${state.rank?'checked':''}><span>Grad als Namenspräfix exportieren</span></label><label class="check"><input type="checkbox" data-contact-option="groups" ${state.groups?'checked':''}><span>Detachemente zusätzlich als Google-Labels</span></label></div></details></section><section class="panel" id="contactsTable">${contactsTableHtml()}</section><section class="panel panel-body" id="contactsSummary" aria-live="polite">${contactsSummaryHtml()}</section><section class="panel panel-body"><h2>CSV in Google Kontakte importieren</h2><p>Die heruntergeladene Datei in <a href="https://contacts.google.com/" target="_blank" rel="noopener noreferrer">Google Kontakte</a> über <b>Importieren → Datei auswählen → Importieren</b> laden. <a href="https://support.google.com/contacts/answer/15147365?hl=de" target="_blank" rel="noopener noreferrer">Google-Anleitung</a></p><small class="muted">Die App erstellt nur die Datei. Exportiert werden Name, optional Grad, Telefon, E-Mail und die angezeigten Labels. Versicherten-Nr., Planungsnotizen und Marschbefehlsangaben sind nicht enthalten.</small></section>`;
}
