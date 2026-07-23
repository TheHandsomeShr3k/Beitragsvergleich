/* =============================================================
   Bestandsvergleich — gemeinsamer Kern (BVK)
   Mehrkunden-Speicher, Fachlogik, Versichererverzeichnis,
   Word-Engine. Wird von allen Ansichten geladen; die Daten
   liegen im localStorage der Domain und sind damit in jeder
   Ansicht identisch.
   ============================================================= */
(function(global){
'use strict';
const BVK = { version: 1 };

/* ---------- Speicher ---------- */
const store = (() => {
  try{
    const t = global.localStorage;
    t.setItem('__bvk_t','1'); t.removeItem('__bvk_t');
    return t;
  }catch(e){ return null; }
})();
const K_KUNDEN = 'bv_kunden_v1';
const K_AKTIV  = 'bv_kunde_aktiv_v1';
const K_LEGACY = 'bestandsvergleich_v1';
const K_AB     = 'bv_adressbuch_v1';
let mem = null;

function leererState(){
  return { kunde:'', spalte:'Anderer Versicherer', policies:[], absender:{name:'',strasse:'',ort:''}, kOrtWahl:'Röthenbach' };
}
function ensureStateShape(s){
  s = s && typeof s === 'object' ? s : {};
  return {
    kunde: s.kunde || '',
    spalte: s.spalte || 'Anderer Versicherer',
    policies: Array.isArray(s.policies) ? s.policies : [],
    absender: (s.absender && typeof s.absender === 'object')
      ? { name: s.absender.name || '', strasse: s.absender.strasse || '', ort: s.absender.ort || '' }
      : { name:'', strasse:'', ort:'' },
    kOrtWahl: s.kOrtWahl || 'Röthenbach'
  };
}
function ladeAlles(){
  if(mem) return mem;
  let d = null;
  if(store){ try{ d = JSON.parse(store.getItem(K_KUNDEN) || 'null'); }catch(e){} }
  if(!d || !Array.isArray(d.kunden) || !d.kunden.length){
    let legacy = null;
    if(store){ try{ legacy = JSON.parse(store.getItem(K_LEGACY) || 'null'); }catch(e){} }
    d = { kunden: [ { id: 'k' + Date.now(), angelegt: Date.now(), geaendert: Date.now(), state: ensureStateShape(legacy || {}) } ] };
  }
  d.kunden = d.kunden.map(k => ({
    id: k.id || ('k' + Date.now() + Math.random().toString(36).slice(2,6)),
    angelegt: k.angelegt || Date.now(),
    geaendert: k.geaendert || Date.now(),
    state: ensureStateShape(k.state)
  }));
  let aktiv = null;
  if(store){ try{ aktiv = store.getItem(K_AKTIV); }catch(e){} }
  if(!d.kunden.some(k => k.id === aktiv)) aktiv = d.kunden[0].id;
  d.aktivId = aktiv;
  mem = d;
  return d;
}
function sichere(){
  if(!mem) return;
  if(store){
    try{
      store.setItem(K_KUNDEN, JSON.stringify({ kunden: mem.kunden }));
      store.setItem(K_AKTIV, mem.aktivId);
    }catch(e){}
  }
}
function nameVon(k){ return (k.state.kunde || '').trim() || 'Unbenannter Kunde'; }

BVK.reload = () => { mem = null; };
BVK.liste = () => ladeAlles().kunden
  .map(k => ({ id: k.id, name: nameVon(k), anzahl: k.state.policies.length, geaendert: k.geaendert }));
BVK.aktivId = () => ladeAlles().aktivId;
BVK.setAktiv = id => { const d = ladeAlles(); if(d.kunden.some(k => k.id === id)){ d.aktivId = id; sichere(); } };
BVK.aktiverState = () => {
  const d = ladeAlles();
  const k = d.kunden.find(x => x.id === d.aktivId) || d.kunden[0];
  return JSON.parse(JSON.stringify(k.state));
};
BVK.stateVon = id => {
  const k = ladeAlles().kunden.find(x => x.id === id);
  return k ? JSON.parse(JSON.stringify(k.state)) : null;
};
BVK.speichern = (id, state) => {
  const d = ladeAlles();
  const k = d.kunden.find(x => x.id === id);
  if(!k) return false;
  k.state = ensureStateShape(state);
  k.geaendert = Date.now();
  sichere();
  return true;
};
BVK.neu = name => {
  const d = ladeAlles();
  const st = leererState();
  if(name) st.kunde = name;
  const k = { id: 'k' + Date.now() + Math.random().toString(36).slice(2,6), angelegt: Date.now(), geaendert: Date.now(), state: st };
  d.kunden.push(k);
  d.aktivId = k.id;
  sichere();
  return k.id;
};
BVK.loeschen = id => {
  const d = ladeAlles();
  if(d.kunden.length <= 1) return false;
  d.kunden = d.kunden.filter(k => k.id !== id);
  if(d.aktivId === id) d.aktivId = d.kunden[0].id;
  sichere();
  return true;
};
BVK.adressbuch = () => {
  if(store){ try{ const o = JSON.parse(store.getItem(K_AB) || '{}'); if(o && typeof o === 'object') return o; }catch(e){} }
  return {};
};
BVK.leererState = leererState;
BVK.ensureStateShape = ensureStateShape;

/* ---------- Fachdaten & Helfer ---------- */
BVK.SPARTEN = [
  {id:'phv', k:'PHV', name:'Privathaftpflicht', full:'Privathaftpflichtversicherung'},
  {id:'wg',  k:'WG',  name:'Wohngebäude',       full:'Wohngebäudeversicherung'},
  {id:'hr',  k:'HR',  name:'Hausrat',           full:'Hausratversicherung'},
  {id:'rs',  k:'RS',  name:'Rechtsschutz',      full:'Rechtsschutzversicherung'},
  {id:'uv',  k:'UV',  name:'Unfall',            full:'Unfallversicherung'},
  {id:'bu',  k:'BU',  name:'Berufsunfähigkeit', full:'Berufsunfähigkeitsversicherung'},
  {id:'gl',  k:'GL',  name:'Glas',              full:'Glasversicherung'},
  {id:'kfz', k:'KFZ', name:'Kfz',               full:'Kfz-Versicherung'},
  {id:'kzv', k:'KZV', name:'Krankenzusatz',     full:'Krankenzusatzversicherung'},
  {id:'so',  k:'SO',  name:'Sonstige',          full:'Sonstiger Vertrag'}
];
BVK.ZW = {
  monatlich:{f:12, l:'monatlich'},
  vierteljaehrlich:{f:4, l:'vierteljährlich'},
  halbjaehrlich:{f:2, l:'halbjährlich'},
  jaehrlich:{f:1, l:'jährlich'}
};
function parseEuro(v){
  if(v == null) return null;
  let s = String(v).replace(/[€\s]/g,'');
  if(!s) return null;
  if(s.includes(',')) s = s.replace(/\./g,'').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function fmtNum(n){ return n == null ? '' : n.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
}
function todayStr(){ return new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'}); }
function sparteOf(p){ return BVK.SPARTEN.find(s => s.id === p.sparte) || BVK.SPARTEN[BVK.SPARTEN.length - 1]; }
function displayName(p){
  if(p.sparte === 'so' && p.label) return p.label;
  return sparteOf(p).full;
}
function rvEffective(p){
  if(p.beitragRV == null) return null;
  if(p.rabattApply && p.rabatt > 0) return Math.round(p.beitragRV * (1 - p.rabatt/100) * 100) / 100;
  return p.beitragRV;
}
function annual(p, side){
  const b = side === 'rv' ? rvEffective(p) : p.beitragF;
  const z = side === 'rv' ? p.zwRV : p.zwF;
  if(b == null || !BVK.ZW[z]) return null;
  return b * BVK.ZW[z].f;
}
function beitragsAlt(p){
  return (p.beitragF != null && p.beitragsjahrF && p.beitragsjahrF < new Date().getFullYear()) ? p.beitragsjahrF : null;
}
function fristDate(p){
  if(!p.ablauf) return null;
  const d = new Date(p.ablauf + 'T00:00:00');
  if(isNaN(d)) return null;
  d.setMonth(d.getMonth() - (p.sparte === 'kfz' ? 1 : 3));
  return d;
}
function kuendBez(p){
  if(!p) return '';
  if(p.sparte === 'so') return (p.label || '').trim();
  if(p.sparte === 'kfz') return 'Kraftfahrzeugversicherung';
  const s = sparteOf(p);
  return s ? s.full : '';
}
function totals(state){
  let f = 0, r = 0, save = 0, hasF = false, hasR = false, hasSave = false;
  (state.policies || []).forEach(p => {
    const aF = annual(p,'f'), aR = annual(p,'rv');
    if(aF != null){ f += aF; hasF = true; }
    if(aR != null){ r += aR; hasR = true; }
    if(aF != null && aR != null){ save += aF - aR; hasSave = true; }
  });
  return { f: hasF ? f : null, r: hasR ? r : null, save: hasSave ? save : null };
}
BVK.parseEuro = parseEuro; BVK.fmtNum = fmtNum; BVK.fmtDate = fmtDate; BVK.todayStr = todayStr;
BVK.sparteOf = sparteOf; BVK.displayName = displayName; BVK.rvEffective = rvEffective;
BVK.annual = annual; BVK.beitragsAlt = beitragsAlt; BVK.fristDate = fristDate;
BVK.kuendBez = kuendBez; BVK.totals = totals;

/* ---------- Versichererverzeichnis ---------- */
BVK.STAND_LABEL = {
  r26: 'einzeln recherchiert, Stand 07/2026',
  v25: 'VOH-Mitgliederliste, Stand 07/2025',
  gdv: 'GdV-Mitgliederverzeichnis, abgerufen 07/2026',
  f08: 'Faxverzeichnis, Stand 06/2008',
  ab: 'Eigenes Adressbuch'
};
BVK.VERZEICHNIS = [{"n": "Achmea Schadeverzekeringen N.V.", "a": "P.O. Box 700\n7300 HC APELDOORN\nNiederlande", "f": "", "sa": "v25", "sf": ""}, {"n": "ADAC Autoversicherung AG", "a": "Hansastraße 19\n80686 München", "f": "089-7676-2500", "sa": "v25", "sf": "v25"}, {"n": "ADAC-RECHTSSCHUTZ VERSICHERUNGSAKTIENGESELLSCHAFT", "a": "Am Westpark 8\n81373 München", "f": "089/76762888", "sa": "f08", "sf": "f08"}, {"n": "ADLER Versicherung AG", "a": "Joseph-Scherer-Straße 3\n44139 Dortmund", "f": "0231-135-4638", "sa": "v25", "sf": "v25"}, {"n": "Advo Card Rechtsschutzversicherung AG", "a": "Heidenkampsweg 81\n20097 Hamburg", "f": "040/23731414", "sa": "f08", "sf": "f08"}, {"n": "AGILA HaustierKrankenversicherung AG", "a": "Breite Straße 6-8\n30159 Hannover", "f": "0511/3032200", "sa": "f08", "sf": "f08"}, {"n": "AIG Europe S.A. Direktion für Deutschland", "a": "Neue Mainzer Straße 46 - 50\n60311 Frankfurt am Main", "f": "069-97113-290", "sa": "v25", "sf": "v25"}, {"n": "Aioi Nissay Dowa Insurance Company of Europe SE Niederlassung Deutschland", "a": "Carl-Zeiss-Ring 25\n85737 Ismaning", "f": "089-244474-555", "sa": "v25", "sf": "v25"}, {"n": "Allianz Direct Versicherungs-AG", "a": "Postfach 20 02 10\n80002 München", "f": "0611/238107", "sa": "v25", "sf": "f08"}, {"n": "Allianz Global Corporate & Specialty SE", "a": "Königinstraße 28\n80802 München", "f": "089-3800-6631", "sa": "v25", "sf": "v25"}, {"n": "Allianz Versicherungs-AG", "a": "10900 Berlin", "f": "0800 4400101", "sa": "r26", "sf": "r26"}, {"n": "Allrecht Rechtsschutzversicherung AG", "a": "Liesegangstr. 15\n40211 Düsseldorf", "f": "0211/9089999", "sa": "f08", "sf": "f08"}, {"n": "Alte Leipziger Versicherung AG", "a": "61435 Oberursel", "f": "06171-24434", "sa": "v25", "sf": "v25"}, {"n": "Ambra Versicherung AG", "a": "Stemmerstraße 14\n78266 Büsingen am Hochrhein", "f": "0041522021342", "sa": "v25", "sf": "v25"}, {"n": "ARAG Allgemeine Rechtsschutz-Versicherungs-AG", "a": "ARAG Platz 1\n40472 Düsseldorf", "f": "0211/9632220", "sa": "f08", "sf": "f08"}, {"n": "ARAG Allgemeine Versicherungs-AG", "a": "40464 Düsseldorf", "f": "0211-963-2850", "sa": "v25", "sf": "v25"}, {"n": "ASSTEL Sachversicherung AG", "a": "Schanzenstr. 28\n51063 Köln", "f": "0221/9677100", "sa": "f08", "sf": "f08", "h": "heute Teil der Gothaer"}, {"n": "AUXILIA Rechtsschutz-Versicherungs-AG", "a": "Uhlandstr. 7\n80336 München", "f": "089/53981220", "sa": "f08", "sf": "f08"}, {"n": "AXA easy Versicherung AG", "a": "Postfach 92 01 22\n51151 Köln", "f": "0221-148-22740", "sa": "v25", "sf": "v25"}, {"n": "AXA Versicherung AG", "a": "51171 Köln", "f": "0800-355-7035", "sa": "v25", "sf": "v25"}, {"n": "BA die Bayerische Allgemeine Versicherung AG", "a": "Thomas-Dehler-Straße 25\n81737 München", "f": "089-6787-9150", "sa": "v25", "sf": "v25"}, {"n": "Baden-Badener Versicherung AG", "a": "Schlackenbergstr. 20\n66386 St. Ingbert", "f": "06894915434", "sa": "f08", "sf": "f08"}, {"n": "Badische Allgemeine Versicherung AG", "a": "Durlacher Allee 56\n76131 Karlsruhe", "f": "0721/6601688", "sa": "f08", "sf": "f08"}, {"n": "Badischer Gemeinde-Versicherungs-Verband Körperschaft des Öffentlichen Rechts", "a": "76116 Karlsruhe", "f": "0721-660-1688", "sa": "v25", "sf": "v25"}, {"n": "Baloise Assurances Luxembourg S.A.", "a": "8, rue du Château d’Eau\n3364 Leudelange\nLuxemburg", "f": "", "sa": "v25", "sf": ""}, {"n": "Baloise Sachversicherung AG Deutschland", "a": "61345 Bad Homburg", "f": "06172-125-456", "sa": "v25", "sf": "v25"}, {"n": "Barmenia Allgemeine Versicherungs-AG", "a": "42094 Wuppertal", "f": "0202-438-2846", "sa": "v25", "sf": "v25"}, {"n": "Basler Versicherungs-Gesellschaft, Basel Direktion für Deutschland", "a": "Basler Straße 4\n61352 Bad Homburg", "f": "06172/135496", "sa": "f08", "sf": "f08", "h": "heute Baloise"}, {"n": "BavariaDirekt Versicherung AG", "a": "Am Karlsbad 4 - 5\n10785 Berlin", "f": "030-521300-457", "sa": "v25", "sf": "v25"}, {"n": "Bayerische Hausbesitzer-Versicherungs-Gesellschaft a.G", "a": "Sonnenstr. 13/V\n80331 München", "f": "089/598955", "sa": "f08", "sf": "f08"}, {"n": "Bayerische Landesbrandversicherung AG", "a": "Maximilianstr. 53\n80530 München", "f": "089/21602992", "sa": "f08", "sf": "f08"}, {"n": "Bayerischer Versicherungsverband Versicherungsaktiengesellschaft", "a": "81537 München", "f": "089-2160-2714", "sa": "v25", "sf": "v25"}, {"n": "Bergische Brandversicherung Allgemeine Feuerversicherung V.a.G.", "a": "Hofkamp 86\n42103 Wuppertal", "f": "0202/444807", "sa": "f08", "sf": "f08"}, {"n": "BGV-Versicherung AG", "a": "76116 Karlsruhe", "f": "0721-660-1688", "sa": "v25", "sf": "v25"}, {"n": "Chubb European Group SE", "a": "Baseler Straße 10\n60329 Frankfurt am Main", "f": "069-746193", "sa": "v25", "sf": "v25"}, {"n": "Concordia Rechtsschutz-Versicherungs-AG", "a": "Karl-Wiechert-Allee 55\n30625 Hannover", "f": "0511/57011400", "sa": "f08", "sf": "f08"}, {"n": "Concordia Versicherungs-Gesellschaft a.G.", "a": "30621 Hannover", "f": "0511-5701-1400", "sa": "v25", "sf": "v25"}, {"n": "Condor Allgemeine Versicherungs-AG", "a": "Admiralitätstr. 67\n20459 Hamburg", "f": "040/36139100", "sa": "f08", "sf": "f08"}, {"n": "CONSTANTIA Versicherungen a.G.", "a": "Königsberger Str. 37\n26725 Emden", "f": "04921/33824", "sa": "f08", "sf": "f08"}, {"n": "Continentale Sachversicherung AG", "a": "44119 Dortmund", "f": "0231/9191795", "sa": "v25", "sf": "f08"}, {"n": "Cosmos Versicherung AG", "a": "66101 Saarbrücken", "f": "0681-966-6633", "sa": "v25", "sf": "v25"}, {"n": "D.A.S. Deutscher Automobil Schutz Versicherungs-AG", "a": "Thomas-Dehler-Straße 2\n81728 München", "f": "089/62751650", "sa": "f08", "sf": "f08", "h": "heute Teil der ERGO"}, {"n": "DA Deutsche Allgemeine Versicherung AG", "a": "Platz der Einheit 2\n60327 Frankfurt am Main", "f": "069-7115-7751", "sa": "v25", "sf": "v25"}, {"n": "DARAG Deutsche Versicherungs- und Rückversicherungs-AG", "a": "Gustav-Adolf-Str. 130\n13086 Berlin", "f": "030/47708100", "sa": "f08", "sf": "f08"}, {"n": "DBV-Winterthur Versicherung AG", "a": "Frankfurter Straße 50\n65178 Wiesbaden", "f": "0611/3634161", "sa": "f08", "sf": "f08", "h": "heute AXA Versicherung AG"}, {"n": "Debeka Allgemeine Versicherung AG", "a": "56058 Koblenz", "f": "0261-498-5555", "sa": "v25", "sf": "v25"}, {"n": "Delvag Luftfahrtversicherungs-AG", "a": "Von-Gablenz-Str. 2-6\n50679 Köln", "f": "0221/8292250", "sa": "f08", "sf": "f08"}, {"n": "DEURAG Deutsche RechtsschutzVersicherung AG", "a": "Abraham-Lincoln-Str. 3\n65189 Wiesbaden", "f": "0611/771300", "sa": "f08", "sf": "f08"}, {"n": "deutsche internet versicherung aktiengesellschaft", "a": "Ruhrallee 92\n44139 Dortmund", "f": "", "sa": "f08", "sf": ""}, {"n": "Deutsche Niederlassung der FRIDAY Insurance S. A.", "a": "Friedrichstraße 70\n10117 Berlin", "f": "", "sa": "v25", "sf": ""}, {"n": "Deutsche Rhederei Versicherungs-AG", "a": "Bergstr. 26\n20095 Hamburg", "f": "040/30399779", "sa": "f08", "sf": "f08"}, {"n": "Deutsche Ärzteversicherung Allgemeine Versicherungs-AG", "a": "Colonia-Allee 10-20\n51067 Köln", "f": "0221/14821442", "sa": "f08", "sf": "f08"}, {"n": "Deutscher ReisepreisSicherungsverein VVaG", "a": "Vogelweidestr. 5\n81677 München", "f": "089/41661555", "sa": "f08", "sf": "f08"}, {"n": "DEUTSCHER RING Sachversicherungs-AG", "a": "Ludwig-Erhard-Str. 22\n20459 Hamburg", "f": "04035992500", "sa": "f08", "sf": "f08", "h": "heute Baloise"}, {"n": "DEVK Allgemeine Versicherungs-AG", "a": "50729 Köln", "f": "0221-757-2200", "sa": "v25", "sf": "v25"}, {"n": "DEVK Deutsche Eisenbahn Versicherung Sach- u. HUK-Versicherungsverein a.G.", "a": "50729 Köln", "f": "0221-757-2200", "sa": "v25", "sf": "v25"}, {"n": "DFV Deutsche Familienversicherung AG", "a": "Beethovenstr 71\n60325 Frankfurt am Main", "f": "01805/768777", "sa": "f08", "sf": "f08"}, {"n": "Dialog Versicherung AG", "a": "Adenauerring 7\n81737 München", "f": "089-5121-1000", "sa": "v25", "sf": "v25"}, {"n": "Die Haftpflichtkasse VVaG", "a": "Darmstädter Straße 103\n64380 Roßdorf", "f": "06154 601-2288", "sa": "r26", "sf": "r26"}, {"n": "DKV Deutsche Krankenversicherung AG", "a": "50594 Köln", "f": "0221 578-6000", "sa": "r26", "sf": "r26"}, {"n": "DMB Rechtsschutz-Versicherung AG", "a": "Bonner Str. 323\n50968 Köln", "f": "0221/3763811", "sa": "f08", "sf": "f08"}, {"n": "DOCURA VVaG", "a": "Königsallee 57\n44789 Bochum", "f": "0234/9371599", "sa": "f08", "sf": "f08"}, {"n": "Dolleruper Freie Brandgilde", "a": "Nübelfeld 50\n24972 Quern", "f": "04632/848823", "sa": "f08", "sf": "f08"}, {"n": "Elvia Reiseversicherungs-Gesellschaft AG in Zürich Niederlassung für Deutschland", "a": "Ludmilastr. 26\n81543 München", "f": "", "sa": "f08", "sf": ""}, {"n": "ERGO Direkt Versicherung AG", "a": "Karl-Martell-Straße 60\n90344 Nürnberg", "f": "0911-148-1900", "sa": "v25", "sf": "v25"}, {"n": "ERGO Versicherung AG", "a": "ERGO-Platz 1\n40477 Düsseldorf", "f": "0211 477-1500", "sa": "r26", "sf": "r26"}, {"n": "Euler Hermes Kreditversicherungs-AG", "a": "Friedensallee 254\n22763 Hamburg", "f": "04088347744", "sa": "f08", "sf": "f08"}, {"n": "Euro Insurances dac Ground Floor, LeasePlan House", "a": "Central Park\nLeopardstown, Dublin 18\nIrland", "f": "060", "sa": "v25", "sf": "v25"}, {"n": "Euro-Aviation Versicherungs-AG", "a": "Hochallee 50\n20149 Hamburg", "f": "0404505994", "sa": "f08", "sf": "f08"}, {"n": "EUROHERC osiguranje d.d.", "a": "Ulica grada Vukovara 282\n10000 Zagreb\nKroatien", "f": "00385016004920", "sa": "v25", "sf": "v25"}, {"n": "EUROP ASSISTANCE Versicherungs-AG", "a": "Infanteriestr. 11\n80797 München", "f": "089/55987199", "sa": "f08", "sf": "f08"}, {"n": "EUROPA Versicherung AG", "a": "Piusstr. 137\n50931 Köln", "f": "0221-5737-233", "sa": "v25", "sf": "v25"}, {"n": "Europäische Reiseversicherung AG", "a": "Vogelweidestr. 5\n81677 München", "f": "089/41661855", "sa": "f08", "sf": "f08"}, {"n": "EXTREMUS Versicherungs-AG", "a": "Aachener Straße 75\n50931 Köln", "f": "02213480599260", "sa": "f08", "sf": "f08"}, {"n": "F. Laeisz Versicherung AG", "a": "Trostbrücke 1\n20457 Hamburg", "f": "040/364876", "sa": "f08", "sf": "f08"}, {"n": "Fahrlehrerversicherung Verein a.G.", "a": "Postfach 31 12 42\n70472 Stuttgart", "f": "0711-98889-860", "sa": "v25", "sf": "v25"}, {"n": "Familienschutz Versicherung AG", "a": "Rotebühlstr. 120\n70197 Stuttgart", "f": "0711/6651516", "sa": "f08", "sf": "f08"}, {"n": "Feuer- und Einbruchschadenkasse der BBBank in Karlsruhe, Versicherungsverein auf Gegenseitig", "a": "Herrenstr. 2-10\n76133 Karlsruhe", "f": "0721/141497", "sa": "f08", "sf": "f08"}, {"n": "Feuersozietät Berlin Brandenburg Versicherung AG", "a": "10912 Berlin", "f": "030-2633-400", "sa": "v25", "sf": "v25"}, {"n": "Freeyou Insurance AG", "a": "Zur Dinkel 33\n48739 Legden", "f": "02541-802-111", "sa": "v25", "sf": "v25"}, {"n": "Freudenberg Versicherung AG", "a": "Höhnerweg 2-4\n69469 Weinheim", "f": "06201882767", "sa": "f08", "sf": "f08"}, {"n": "GARANTA Versicherungs-AG", "a": "90334 Nürnberg", "f": "0911-531-3206", "sa": "v25", "sf": "v25"}, {"n": "Gartenbau-Versicherung VVaG", "a": "von-Friedrichs-Str. 8\n65191 Wiesbaden", "f": "0611/5694140", "sa": "f08", "sf": "f08"}, {"n": "Gebäudeversicherungsgilde für Föhr,Amrum und Halligen", "a": "Lung Jaat 11\n25938 Untersum/Föhr", "f": "04683/96101", "sa": "f08", "sf": "f08"}, {"n": "GEGENSEITIGKEIT Versicherung Oldenburg", "a": "Osterstr. 15\n26122 Oldenburg", "f": "0441/92365555", "sa": "f08", "sf": "f08"}, {"n": "Gemeinnützige Haftpflicht-Versicherungsanstalt", "a": "Bartningstraße 59\n64289 Darmstadt", "f": "06151-3603-130", "sa": "v25", "sf": "v25"}, {"n": "Gemeinnützige Haftpflichtversicherungsanstalt der Gartenbau-Berufsgenossenschaft", "a": "Frankfurter Straße 126\n34121 Kassel", "f": "0561/9282307", "sa": "f08", "sf": "f08"}, {"n": "GENERALI assurances Iard", "a": "7, Boulevard Haussmann\n75456 PARIS CEDEX 09\nFrankreich", "f": "00330033158383845", "sa": "v25", "sf": "v25"}, {"n": "Generali Deutschland Versicherung AG", "a": "Adenauerring 7\n81737 München", "f": "089 5121-1000", "sa": "r26", "sf": "r26", "al": ["aachenmünchener", "aachenmuenchener"]}, {"n": "GGG KraftfahrzeugReparaturkosten-Versicherungs-AG", "a": "Magdeburger Str. 7\n30880 Laatzen", "f": "05102/939910", "sa": "f08", "sf": "f08"}, {"n": "Glasschutzkasse a.G. von 1923 zu Hamburg", "a": "Bei dem Neuen Krahn 2\n20457 Hamburg", "f": "040/36981222", "sa": "f08", "sf": "f08"}, {"n": "Gothaer Allgemeine Versicherung AG", "a": "Gothaer Allee 1\n50969 Köln", "f": "0221 3090-7079", "sa": "r26", "sf": "r26"}, {"n": "Gothaer Versicherungsbank VVaG", "a": "Arnoldiplatz 1\n50969 Köln", "f": "0221/308103", "sa": "f08", "sf": "f08"}, {"n": "Great Lakes Insurance SE", "a": "Königinstraße 107\n80802 München", "f": "089-244455271", "sa": "v25", "sf": "v25"}, {"n": "Greenval Insurance DAC", "a": "The Anchorage, 17-19 Sir John Rogerson’s\nQuay\nDUBLIN 2\nIrland", "f": "", "sa": "v25", "sf": ""}, {"n": "GRUNDEIGENTÜMER-VERSICHERUNG VVaG", "a": "Große Bäckerstraße 7\n20095 Hamburg", "f": "040/37663300", "sa": "f08", "sf": "f08"}, {"n": "GVV-Direktversicherung AG", "a": "Postfach 40 06 51\n50836 Köln", "f": "", "sa": "v25", "sf": ""}, {"n": "GVV-Kommunalversicherung VVaG", "a": "Postfach 40 06 51\n50836 Köln", "f": "0221-4893-777", "sa": "v25", "sf": "v25"}, {"n": "Haftpflichtgemeinschaft Deutscher Nahverkehrs- und Versorgungs- unternehmen (HDN)", "a": "Postfach 10 10 26\n44710 Bochum", "f": "0234-3243-599", "sa": "v25", "sf": "v25"}, {"n": "Haftpflichtgemeinschaft Deutscher Nahverkehrs- und Versorgungsunternehmen Allgemein VVaG", "a": "Postfach 10 10 26\n44710 Bochum", "f": "0234-3243-599", "sa": "v25", "sf": "v25"}, {"n": "Haftpflichtschadenausgleich der deutschen Großstädte (HADG)", "a": "Postfach 10 13 06\n44713 Bochum", "f": "0234-6872-599", "sa": "v25", "sf": "v25"}, {"n": "Haftpflichtverband öffentlicher Verkehrsbetriebe (HÖV)", "a": "Postfach 10 19 34\n44019 Dortmund", "f": "0231-95200-89", "sa": "v25", "sf": "v25"}, {"n": "Hagelgilde Versicherungs-Verein a.G. gegr. 1811", "a": "Hof Altona\n23730 Sierksdirf", "f": "04563/8108", "sa": "f08", "sf": "f08"}, {"n": "Hamburg-Mannheimer Sachversicherungs-AG", "a": "Überseering 45\n22297 Hamburg", "f": "040/63763302", "sa": "f08", "sf": "f08", "h": "heute ERGO Versicherung AG"}, {"n": "Hamburger Beamten-Feuerund Einbruchskasse", "a": "Hermannstr. 46\n20095 Hamburg", "f": "040/336012", "sa": "f08", "sf": "f08"}, {"n": "Hamburger Feuerkasse Versicherungs-AG", "a": "Postfach 10 27 40\n20019 Hamburg", "f": "040-30904-9000", "sa": "v25", "sf": "v25"}, {"n": "Hamburger Lehrer-Feuerkasse", "a": "Depenkamp 2\n22549 Hamburg", "f": "040/41113557", "sa": "f08", "sf": "f08"}, {"n": "Hannoversche Direktversicherung AG", "a": "Karl-Wiechert-Allee 10\n30622 Hannover", "f": "0511/39093333", "sa": "f08", "sf": "f08"}, {"n": "Hanse-Marine-Versicherung AG", "a": "Am Kaiserkai 2\n20457 Hamburg", "f": "040/37091261", "sa": "f08", "sf": "f08"}, {"n": "HanseMerkur Allgemeine Versicherung AG", "a": "Postfach 13 06 93\n20106 Hamburg", "f": "040-4119-3257", "sa": "v25", "sf": "v25"}, {"n": "Harsewinkeler VVaG zu Harsewinkel", "a": "Tecklenburger Weg 1\n33428 Harsewinkel", "f": "05247/927078", "sa": "f08", "sf": "f08"}, {"n": "HDI Global SE", "a": "Postfach 51 03 69\n30633 Hannover", "f": "0511-645-4545", "sa": "v25", "sf": "v25"}, {"n": "HDI Global Specialty SE", "a": "HDI-Platz 1\n30659 Hannover", "f": "", "sa": "v25", "sf": ""}, {"n": "HDI Versicherung AG", "a": "Postfach 51 03 69\n30633 Hannover", "f": "0511-645-4545", "sa": "v25", "sf": "v25"}, {"n": "Helvetia Global Solutions Ltd", "a": "Äulestrasse 60\n9490 Vaduz\nLiechtenstein", "f": "", "sa": "v25", "sf": ""}, {"n": "HELVETIA INTERNATIONAL Versicherungs-AG", "a": "Berliner Str. 56-58\n60311 Frankfurt", "f": "069/1332474", "sa": "f08", "sf": "f08"}, {"n": "Helvetia Schweizerische Versicherungsgesellschaft AG Direktion für Deutschland", "a": "Postfach 10 10 41\n60010 Frankfurt am Main", "f": "069-1332-474", "sa": "v25", "sf": "v25"}, {"n": "Helvetia Versicherungs-AG", "a": "Berliner Straße 56 - 58\n60311 Frankfurt am Main", "f": "069256158", "sa": "v25", "sf": "f08"}, {"n": "HUK-COBURG Haftpflicht-Unterstützungs-Kasse kraftfahrender Beamter Deutschlands a.G. in Coburg", "a": "96444 Coburg", "f": "09561-96-3636", "sa": "v25", "sf": "v25"}, {"n": "HUK-COBURG Versicherungsgruppe", "a": "Bahnhofsplatz\n96444 Coburg", "f": "09561 96-3636", "sa": "r26", "sf": "r26"}, {"n": "HUK24 AG", "a": "Willi-Hussong-Straße 2\n96444 Coburg", "f": "09561/962424", "sa": "r26", "sf": "f08"}, {"n": "HVAG Hamburger Versicherungs-AG", "a": "Grimm 14\n20457 Hamburg", "f": "040/4030390630", "sa": "f08", "sf": "f08"}, {"n": "HÄGER VVaG", "a": "Engertstr. 119\n33824 Werther", "f": "05203/5758", "sa": "f08", "sf": "f08"}, {"n": "Hübener Versicherungs AG", "a": "Ballindamm 37\n20095 Hamburg", "f": "040/226317878", "sa": "f08", "sf": "f08"}, {"n": "IDEAL Versicherung AG", "a": "Kochstr. 66\n10969 Berlin", "f": "030/25878356", "sa": "f08", "sf": "f08"}, {"n": "IF Schadenversicherung AG Direktion für Deutschland", "a": "Postfach 17 51\n63237 Neu-Isenburg", "f": "06102-710771", "sa": "v25", "sf": "v25"}, {"n": "INTER Allgemeine Versicherung AG", "a": "Erzbergerstr. 9-15\n68165 Mannheim", "f": "0621/427944", "sa": "f08", "sf": "f08"}, {"n": "Interlloyd Versicherungs-AG", "a": "ARAG Platz 1\n40472 Düsseldorf", "f": "0211/9633033", "sa": "f08", "sf": "f08"}, {"n": "InterRisk Versicherungs-AG", "a": "Karl-Bosch-Str. 5\n65203 Wiesbaden", "f": "0611/2787222", "sa": "f08", "sf": "f08"}, {"n": "iptiQ EMEA P&C S.A. Niederlassung Deutschland", "a": "Arabellastraße 30\n81925 München", "f": "", "sa": "v25", "sf": ""}, {"n": "ISSELHORSTER Versicherung V.a.G.", "a": "Haller Str. 90\n33334 Gütersloh", "f": "05241/9650790", "sa": "f08", "sf": "f08"}, {"n": "Itzehoer Versicherung/Brandgilde von 1691 VVaG", "a": "25521 Itzehoe", "f": "04821-773-8888", "sa": "v25", "sf": "v25"}, {"n": "Janitos Versicherung AG", "a": "Postfach 10 41 69\n69031 Heidelberg", "f": "06221-709-1001", "sa": "v25", "sf": "v25"}, {"n": "Jurpartner RechtsschutzVersicherung AG", "a": "Eumeniusstr. 15-17\n50679 Köln", "f": "0221/8277460", "sa": "f08", "sf": "f08"}, {"n": "Kommunaler Schadenausgleich der Länder Brandenburg, Mecklenburg-Vorpommern, Sachsen, Sachsen-Anhalt und Thüringen (KSA)", "a": "Konrad-Wolf-Straße 91/92\n13055 Berlin", "f": "030-42152-111", "sa": "v25", "sf": "v25"}, {"n": "Kommunaler Schadenausgleich Hannover (KSA)", "a": "Postfach 34 20\n30034 Hannover", "f": "0511-30401-99", "sa": "v25", "sf": "v25"}, {"n": "Kommunaler Schadenausgleich Schleswig-Holstein", "a": "Reventlouallee 6\n24105 Kiel", "f": "0431-57925-30", "sa": "v25", "sf": "v25"}, {"n": "Kommunaler Schadenausgleich westdeutscher Städte (KSA)", "a": "Postfach 10 13 06\n44713 Bochum", "f": "0234-6872-599", "sa": "v25", "sf": "v25"}, {"n": "KRAVAG-ALLGEMEINE Versicherungs-AG", "a": "Postfach 10 39 05\n20027 Hamburg", "f": "040-23606-4366", "sa": "v25", "sf": "v25"}, {"n": "KRAVAG-LOGISTIC Versicherungs-AG", "a": "Postfach 10 39 05\n20027 Hamburg", "f": "040-23606-4366", "sa": "v25", "sf": "v25"}, {"n": "KS Versicherungs-AG", "a": "Uhlamdstr. 7\n80336 München", "f": "089/53981250", "sa": "f08", "sf": "f08"}, {"n": "Kölnische Hagel-Versicherungs-AG", "a": "Wilhelmstraße 25\n35392 Gießen", "f": "0641/7968222", "sa": "f08", "sf": "f08"}, {"n": "Landesschadenhilfe Versicherung VaG", "a": "Vogteistr. 3\n29683 Bad Fallingbostel", "f": "05162-404-26", "sa": "v25", "sf": "v25"}, {"n": "Lauenburg-Alslebener Schiffsversicherung Verein a.G.", "a": "Elbstr. 52\n21481 Lauenburg", "f": "04153/2270", "sa": "f08", "sf": "f08"}, {"n": "LBN VVaG-Gegründet 1845", "a": "Groß-Buchholzner Kirchweg 49\n30655 Hannover", "f": "0511/5415612", "sa": "f08", "sf": "f08"}, {"n": "Lippische Landesbrandversicherung AG", "a": "Postfach 21 64\n32711 Detmold", "f": "05231-990-990", "sa": "v25", "sf": "v25"}, {"n": "Lloyd's Insurance Company S.A. Bastion Tower – Floor 14", "a": "5 Place du Champ de Mars / 5\nMarsveldplein\n1050 Brüssel\nBelgien", "f": "", "sa": "v25", "sf": ""}, {"n": "Lloyd's Insurance Company S.A. Niederlassung für Deutschland", "a": "Taunusanlage 11\n60329 Frankfurt am Main", "f": "069-7144881-99", "sa": "v25", "sf": "v25"}, {"n": "LVM Landwirtschaftlicher Versicherungsverein Münster a.G.", "a": "48126 Münster", "f": "0251-702-1099", "sa": "v25", "sf": "v25"}, {"n": "Mannheimer Versicherung AG", "a": "68127 Mannheim", "f": "0621-457-8008", "sa": "v25", "sf": "v25"}, {"n": "Mecklenburgische Versicherungs-Gesellschaft a.G.", "a": "30619 Hannover", "f": "0511-5351-4444", "sa": "v25", "sf": "v25"}, {"n": "MEDIEN-VERSICHERUNG aG KARLSRUHE vorm. Buchgewerbe-Feuerversicherung", "a": "Borsigstr. 5\n76185 Karlsruhe", "f": "0721/5690016", "sa": "f08", "sf": "f08"}, {"n": "Mercur Assistance Versicherungs-AG", "a": "Vogelweidestr. 5\n81677 München", "f": "089/41864358", "sa": "f08", "sf": "f08"}, {"n": "Minerva Versicherungs-AG", "a": "Herrlichkeit 6\n28199 Bremen", "f": "0421/594075", "sa": "f08", "sf": "f08"}, {"n": "MMA IARD Assurances Mutuelles", "a": "160 rue Henri Champion\n72030 LE MANS CEDEX 09\nFrankreich", "f": "", "sa": "v25", "sf": ""}, {"n": "MMA IARD SA", "a": "160 rue Henri Champion\n72030 LE MANS CEDEX 09\nFrankreich", "f": "", "sa": "v25", "sf": ""}, {"n": "Münchener und Magdeburger Agrarversicherung AG", "a": "Albert-Schweizer-Str. 62\n81735 München", "f": "089/6792795", "sa": "f08", "sf": "f08"}, {"n": "Münchener Verein Allgemeine Versicherungs-AG", "a": "80283 München", "f": "089-5152-1501", "sa": "v25", "sf": "v25"}, {"n": "Neodigital Autoversicherung AG", "a": "Heinz-Kettler-Straße 1\n66386 St. Ingbert", "f": "", "sa": "v25", "sf": ""}, {"n": "neue leben Unfallversicherung AG", "a": "Sachsenkamp 5\n20097 Hamburg", "f": "040/23891133", "sa": "f08", "sf": "f08"}, {"n": "Neue RechtsschutzVersicherungsgesellschaft-AG", "a": "Augusta-Anlage 25\n68165 Mannheim", "f": "0621/4204650", "sa": "f08", "sf": "f08"}, {"n": "Neuendorfer Brand-Bau-Gilde", "a": "Kirchdorf 40\n25335 Neuendorf", "f": "04121/25387", "sa": "f08", "sf": "f08"}, {"n": "nexible Versicherung AG", "a": "90344 Nürnberg", "f": "0800-4023333", "sa": "v25", "sf": "v25"}, {"n": "Nordhemmer VVaG", "a": "Rahdener Postweg 9\n32479 Hille", "f": "", "sa": "f08", "sf": ""}, {"n": "NV-Versicherungen VVaG", "a": "Johann-Rammers-Mammen-Weg 2\n26427 Neuharlingersiel", "f": "04974/917099", "sa": "f08", "sf": "f08"}, {"n": "NÜRNBERGER Allgemeine Versicherungs-AG", "a": "90334 Nürnberg", "f": "0911-531-3206", "sa": "v25", "sf": "v25"}, {"n": "NÜRNBERGER Beamten Allgemeine Versicherung AG", "a": "90334 Nürnberg", "f": "0911-531-3206", "sa": "v25", "sf": "v25"}, {"n": "OKV - Ostdeutsche Kommunalversicherung a.G.", "a": "Plauener Straße 163 - 165 / Haus C\n13053 Berlin", "f": "030-914263-599", "sa": "v25", "sf": "v25"}, {"n": "Oldenburgische Landesbrandkasse", "a": "26113 Oldenburg", "f": "0441-2228-444", "sa": "v25", "sf": "v25"}, {"n": "ONTOS Versicherung AG", "a": "RheinLandplatz\n41460 Neuss", "f": "02131/12513649", "sa": "f08", "sf": "f08"}, {"n": "Optima Versicherungs-AG", "a": "Admiraliätstr. 67\n20459 Hamburg", "f": "040/37894100", "sa": "f08", "sf": "f08"}, {"n": "Ostangler Brandgilde", "a": "Flensburger Str. 5\n24376 Kappeln", "f": "04642/914777", "sa": "f08", "sf": "f08"}, {"n": "Ostbeverner VVaG", "a": "Hauptstr. 27\n48346 Ostbevern", "f": "02532/1676", "sa": "f08", "sf": "f08"}, {"n": "Pallas Versicherung AG", "a": "Gebäude Q 26\n51368 Leverkusen", "f": "0214/3071289", "sa": "f08", "sf": "f08"}, {"n": "PB Versicherung AG", "a": "Pro-Activ-Platz 1\n40721 Hilden", "f": "02103/345179", "sa": "f08", "sf": "f08"}, {"n": "PENSIONS-SICHERUNGS-VEREIN VVaG", "a": "Berlin-Kölnische-Allee 2-4\n50969 Köln", "f": "0211/93659299", "sa": "f08", "sf": "f08"}, {"n": "Probus Insurance Company Europe DAC Hertz Europe Service Centre", "a": "Swords Business Park\nCo Dublin\nIrland", "f": "0035318291294", "sa": "v25", "sf": "v25"}, {"n": "Provinzial Nord Brandkasse AG", "a": "24097 Kiel", "f": "0431-603-1115", "sa": "v25", "sf": "v25"}, {"n": "Provinzial Versicherung AG", "a": "Provinzialplatz 1\n40591 Düsseldorf", "f": "0211-978-1700", "sa": "v25", "sf": "v25"}, {"n": "PVAG Polizeiversicherungs-AG", "a": "Joseph-Scherer-Str. 3\n44139 Dortmund", "f": "0231/1354638", "sa": "f08", "sf": "f08"}, {"n": "QBE Europe SA/NV Direktion für Deutschland", "a": "Postfach 20 02 64\n40100 Düsseldorf", "f": "0211-99419-88", "sa": "v25", "sf": "v25"}, {"n": "R+V Allgemeine Versicherung AG", "a": "65181 Wiesbaden", "f": "0611/5334500", "sa": "v25", "sf": "f08"}, {"n": "R+V Direktversicherung AG", "a": "Raiffeisenplatz 1\n65189 Wiesbaden", "f": "0611-533-777240", "sa": "v25", "sf": "v25"}, {"n": "R+V RECHTSSCHUTZVERSICHERUNG AG", "a": "Taunusstr. 1\n65193 Wiesbaden", "f": "0611/5334500", "sa": "f08", "sf": "f08"}, {"n": "Real Garant Versicherung AG", "a": "Strohgäustr. 5\n73765 Neuhausen", "f": "07158/953118", "sa": "f08", "sf": "f08"}, {"n": "RheinLand Versicherungs AG", "a": "41456 Neuss", "f": "02131-290-13300", "sa": "v25", "sf": "v25"}, {"n": "Rhion Versicherung AG", "a": "Postfach 10 12 49\n41412 Neuss", "f": "02131-6099-13300", "sa": "v25", "sf": "v25"}, {"n": "ROLAND Rechtsschutz-Versicherungs-AG", "a": "Deutz-Kalker Straße 46\n50679 Köln", "f": "0221 8277-460", "sa": "r26", "sf": "r26"}, {"n": "ROLAND SchutzbriefVersicherung AG", "a": "Deutz-Kalker-Str. 46\n50679 Köln", "f": "0221/8277460", "sa": "f08", "sf": "f08"}, {"n": "RS Reise-Schutz Versicherung AG", "a": "Bahnhofstr. 10\n74189 Weinsberg", "f": "07134/9196145", "sa": "f08", "sf": "f08"}, {"n": "SAARLAND Feuerversicherung AG", "a": "Postfach 10 26 62\n66026 Saarbrücken", "f": "0681-601-450", "sa": "v25", "sf": "v25"}, {"n": "Sach- und Haftpflichtversicherung des Bäckerhandwerks VVaG", "a": "Johannes-Albers-Allee 2\n53639 Königswinter", "f": "02223/921750", "sa": "f08", "sf": "f08"}, {"n": "Schleswiger VVaG", "a": "Dorfstrasse 38\n25924 Emmelsbüll-Horsbüll", "f": "04665/940422", "sa": "f08", "sf": "f08"}, {"n": "Schneverdinger Versicherungsverein a.G.", "a": "Rotenburger Str. 1-3\n29640 Schneverdingen", "f": "05193/50101", "sa": "f08", "sf": "f08"}, {"n": "Schutzverein Deutscher Rheder V.a.G.", "a": "Am Kaiserkai 6\n20457 Hamburg", "f": "040/37517210", "sa": "f08", "sf": "f08"}, {"n": "SCHWARZMEER UND OSTSEE Versicherungs-AG SOVAG", "a": "Schwanenwik 37\n22087 Hamburg", "f": "040/225719", "sa": "f08", "sf": "f08"}, {"n": "SIGNAL IDUNA Allgemeine Versicherung AG", "a": "44121 Dortmund", "f": "0231-135-4638", "sa": "v25", "sf": "v25"}, {"n": "SIGNAL Unfallversicherung a.G.", "a": "Joseph-Scherer-Str. 3\n44139 Dortmund", "f": "0231/1354638", "sa": "f08", "sf": "f08"}, {"n": "SOFINSOD Insurance DAC Elm Park", "a": "Merrion Road\nDUBLIN D04 P231\nIrland", "f": "0035335314077997", "sa": "v25", "sf": "v25"}, {"n": "SOGESSUR S.A. Deutsche Niederlassung", "a": "Fuhlsbüttler Straße 437\n22309 Hamburg", "f": "040-600096295", "sa": "v25", "sf": "v25"}, {"n": "Sparkassen DirektVersicherung AG", "a": "Kölner Landstraße 33\n40591 Düsseldorf", "f": "0211-729-8810", "sa": "v25", "sf": "v25"}, {"n": "Sparkassen-Versicherung Sachsen Allgemeine Versicherung AG", "a": "Postfach 11 01 03\n01330 Dresden", "f": "0351-4235-555", "sa": "v25", "sf": "v25"}, {"n": "Stuttgarter Versicherung AG", "a": "Rotebühlstr. 120\n70197 Stuttgart", "f": "0711/6651515", "sa": "f08", "sf": "f08"}, {"n": "SV SparkassenVersicherung Gebäudeversicherung AG", "a": "70365 Stuttgart", "f": "0711-898-1870", "sa": "v25", "sf": "v25"}, {"n": "Süddeutsche Allgemeine Versicherung a.G.", "a": "Raiffeisenplatz 5\n70736 Feldbach", "f": "05492/98604", "sa": "f08", "sf": "f08"}, {"n": "Tesla Insurance Ltd (Germany Branch)", "a": "Tesla Str. 1\n15537 Grünheide (Mark)", "f": "", "sa": "v25", "sf": ""}, {"n": "Thüga Schadenausgleichskasse München VVaG", "a": "Hansjakobstraße 129\n81825 München", "f": "089/43699111", "sa": "f08", "sf": "f08"}, {"n": "TRIAS Versicherung AG", "a": "Maximiliansplatz 5\n80333 München", "f": "089/551671212", "sa": "f08", "sf": "f08"}, {"n": "TVM verzekeringen N.V.", "a": "P.O. Box 130\n7900 AC HOOGEVEEN\nNiederlande", "f": "0031528292281", "sa": "v25", "sf": "v25"}, {"n": "Uelzener Allgemeine Versicherungs-Gesellschaft a.G.", "a": "Veerßer Str. 67\n29525 Uelzen", "f": "0581/8070248", "sa": "f08", "sf": "f08"}, {"n": "Union Reiseversicherung AG", "a": "Maximilianstr. 53\n80530 München", "f": "089/21606745", "sa": "f08", "sf": "f08"}, {"n": "United Services Automobile Association, San Antonio Texas/USA Direktion für Deutschland", "a": "Königsberger Str. 1\n60487 Frankfurt", "f": "069/75616850", "sa": "f08", "sf": "f08"}, {"n": "uniVersa Allgemeine Versicherung AG", "a": "90333 Nürnberg", "f": "0911-5307-3700", "sa": "v25", "sf": "v25"}, {"n": "UPS International Insurance dac c/o Marsh Management Services (Dublin) Limited", "a": "Adelaide Road 25 - 28\nDUBLIN 2\nIrland", "f": "03000", "sa": "v25", "sf": "v25"}, {"n": "USAA S.A.", "a": "1, avenue du Bois\n1251 Luxemburg\nLuxemburg", "f": "", "sa": "v25", "sf": ""}, {"n": "Vereinigte Hagelversicherung VVaG", "a": "Wilhelmstr. 25\n35392 Gießen", "f": "0641/7968222", "sa": "f08", "sf": "f08"}, {"n": "Vereinigte SchiffsVersicherung V.a.G.", "a": "Seelhorststr. 7\n30175 Hannover", "f": "0511/2809050", "sa": "f08", "sf": "f08"}, {"n": "VEREINIGTE TIERVERSICHERUNG GESELLSCHAFT a.G.", "a": "Sonnenberger Str. 2\n65193 Wiesbaden", "f": "0611/5334500", "sa": "f08", "sf": "f08"}, {"n": "Vereinigte Vers.Ges.v. Deutschland Zweign.d. Combined Insurance Company of America Chicago", "a": "Friedrich-Bergius-Str. 9\n65203 Wiesbaden", "f": "0611/238107", "sa": "f08", "sf": "f08"}, {"n": "Versicherer im Raum der Kirchen Sachversicherung AG", "a": "34108 Kassel", "f": "0800-2-741258", "sa": "v25", "sf": "v25"}, {"n": "Versicherungskammer Bayern Versicherungsanstalt des öffentlichen Rechts", "a": "81537 München", "f": "089-2160-2714", "sa": "v25", "sf": "v25"}, {"n": "Versicherungsverband Deutscher Eisenbahnen VVaG", "a": "Breite Straße 147-151\n50667 Köln", "f": "0221/2038229", "sa": "f08", "sf": "f08"}, {"n": "Verti Versicherung AG", "a": "Postfach 14 01 65\n14301 Berlin", "f": "030-890004404", "sa": "v25", "sf": "v25"}, {"n": "VGH Landschaftliche Brandkasse Hannover", "a": "30140 Hannover", "f": "0511-362-2960", "sa": "v25", "sf": "v25"}, {"n": "VHV Allgemeine Versicherung AG", "a": "VHV-Platz 1\n30177 Hannover", "f": "0511 9078999", "sa": "r26", "sf": "r26"}, {"n": "VHV Vereinigte Hannoversche Versicherung a.G.", "a": "Constantinstr. 40\n30177 Hannover", "f": "0511/9078999", "sa": "f08", "sf": "f08"}, {"n": "Volksfürsorge Deutsche Sachversicherung AG", "a": "Besenbinderhof 43\n20097 Hamburg", "f": "040/28654477", "sa": "f08", "sf": "f08", "h": "heute Teil der Generali"}, {"n": "Volkswagen Autoversicherung AG", "a": "Gifhorner Straße 57\n38112 Braunschweig", "f": "", "sa": "v25", "sf": ""}, {"n": "VOLKSWOHL BUND Sachversicherung AG", "a": "44128 Dortmund", "f": "0231-5433-400", "sa": "v25", "sf": "v25"}, {"n": "VPV Allgemeine Versicherungs-AG", "a": "Pohlingstr. 3\n50969 Köln", "f": "0221/93667201", "sa": "f08", "sf": "f08"}, {"n": "VRK VVaG im Raum der Kirchen", "a": "Kölnische Strasse 108\n34119 Kassel", "f": "0180/2741258", "sa": "f08", "sf": "f08"}, {"n": "WAKAM", "a": "120 - 122 Rue Reaumur\n75083 Paris Cedex 2\nFrankreich", "f": "", "sa": "v25", "sf": ""}, {"n": "Waldenburger Versicherung AG", "a": "Max-Eyth-Straße 1\n74638 Waldenburg", "f": "07942-945-555066", "sa": "v25", "sf": "v25"}, {"n": "wefox Insurance AG Niederlassung Deutschland", "a": "Am Karlsbad 16\n10785 Berlin", "f": "0400", "sa": "v25", "sf": "v25"}, {"n": "WERTGARANTIE SE", "a": "Postfach 64 29\n30064 Hannover", "f": "0511-71280-149", "sa": "v25", "sf": "v25"}, {"n": "WERTGARANTIE Technische Versicherung AG", "a": "Breite Str. 6-8\n30159 Hannover", "f": "0511/3032149", "sa": "f08", "sf": "f08"}, {"n": "Westfälische Provinzial Versicherung AG", "a": "Provinzial-Allee 1\n48159 Münster", "f": "0251/2192300", "sa": "f08", "sf": "f08"}, {"n": "WGV-Versicherung AG", "a": "70164 Stuttgart", "f": "0711-1695-8360", "sa": "v25", "sf": "v25"}, {"n": "WWK Allgemeine Versicherung AG", "a": "80292 München", "f": "089-5114-2337", "sa": "v25", "sf": "v25"}, {"n": "Württembergische Gemeinde-Versicherung a. G.", "a": "70164 Stuttgart", "f": "0711-1695-8360", "sa": "v25", "sf": "v25"}, {"n": "Württembergische und Badische Versicherungs-AG", "a": "Karlstr. 68-72\n47076 Heilbronn", "f": "07131/186214", "sa": "f08", "sf": "f08"}, {"n": "Württembergische Versicherung AG", "a": "70163 Stuttgart", "f": "0711-662-829400", "sa": "v25", "sf": "v25"}, {"n": "Würzburger Versicherungs-AG", "a": "Bahnhofstr. 11\n97070 Würzburg", "f": "0931/2795290", "sa": "f08", "sf": "f08"}, {"n": "XL Insurance Company SE Direktion für Deutschland", "a": "Colonia-Allee 10 - 20\n51067 Köln", "f": "0221-16887-100", "sa": "v25", "sf": "v25"}, {"n": "ZK \"LEV INS\" AD", "a": "51 D \"Cherni Vrah\" Blvd\n1407 Sofia\nBulgarien", "f": "", "sa": "v25", "sf": ""}, {"n": "Zurich Insurance Europe AG", "a": "Platz der Einheit 2\n60327 Frankfurt am Main", "f": "069-7115-3358", "sa": "v25", "sf": "v25"}, {"n": "ZURICH Versicherung AG (Deutschland)", "a": "Solmstr. 27-37\n60486 Frankfurt", "f": "069/71153358", "sa": "f08", "sf": "f08"}, {"n": "Zürich Versicherungs-Gesellschaft Niederlassung für Deutschland", "a": "Poppelsdorfer Allee 25-33\n53115 Bonn", "f": "0228/2683952", "sa": "f08", "sf": "f08"}, {"n": "Öffentliche Feuerversicherung Sachsen-Anhalt", "a": "Postfach 39 11 43\n39135 Magdeburg", "f": "0391-7367-490", "sa": "v25", "sf": "v25"}, {"n": "Öffentliche Sachversicherung Braunschweig", "a": "38096 Braunschweig", "f": "0531-202-1500", "sa": "v25", "sf": "v25"}, {"n": "ÖRAG Rechtsschutzversicherungs-AG", "a": "Hansaallee 199\n40549 Düsseldorf", "f": "0211/5295199", "sa": "f08", "sf": "f08"}];
function normNameV(s){
  s = (s || '').toLowerCase();
  s = s.replace(/[-\u2013.,()"'\/&+]/g, ' ');
  s = s.replace(/\b(versicherungs?|versicherung|aktiengesellschaft|aktien|gesellschaft|allgemeine|ag|se|vvag|auf|gegenseitigkeit|niederlassung|direktion|f\u00fcr|deutschland|sitz|gruppe)\b/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
function rankV(v){
  const p = {ab: 5, r26: 3, v25: 2, gdv: 1, f08: 0}[v.sa] || 0;
  return (v.f ? 10 : 0) + p;
}
function lookupVersicherer(q){
  q = (q || '').trim();
  if(q.length < 2) return null;
  const ql = q.toLowerCase();
  const qn = normNameV(q);
  let best = null, bs = 0;
  const alle = Object.values(BVK.adressbuch()).concat(BVK.VERZEICHNIS);
  for(const v of alle){
    const nl = (v.n || '').toLowerCase();
    let s = 0;
    if(nl === ql) s = 100;
    else if(v.al && v.al.some(a => ql.includes(a))) s = 85;
    else if(nl.startsWith(ql) || ql.startsWith(nl)) s = 80;
    else if(nl.includes(ql) || ql.includes(nl)) s = 60;
    else if(qn){
      const vn = normNameV(v.n);
      if(vn === qn) s = 90;
      else if(vn && (vn.includes(qn) || qn.includes(vn))) s = 50;
    }
    if(s > bs || (s === bs && s > 0 && best && rankV(v) > rankV(best))){ bs = s; best = v; }
  }
  return bs >= 50 ? best : null;
}
BVK.normNameV = normNameV;
BVK.lookupVersicherer = lookupVersicherer;

/* ---------- Word-Engine (Vergleichsdokument) ---------- */
const XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function xEsc(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function wRun(text, o){
  o = o || {};
  const pr = [];
  if(o.b) pr.push('<w:b/>');
  if(o.i) pr.push('<w:i/>');
  if(o.color) pr.push('<w:color w:val="' + o.color + '"/>');
  if(o.sz) pr.push('<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>');
  return '<w:r>' + (pr.length ? '<w:rPr>' + pr.join('') + '</w:rPr>' : '') +
    '<w:t xml:space="preserve">' + xEsc(text) + '</w:t></w:r>';
}
function wP(runs, o){
  o = o || {};
  const pPr = [];
  pPr.push('<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after != null ? o.after : 40) + '" w:line="240" w:lineRule="auto"/>');
  if(o.align) pPr.push('<w:jc w:val="' + o.align + '"/>');
  return '<w:p><w:pPr>' + pPr.join('') + '</w:pPr>' + (Array.isArray(runs) ? runs.join('') : runs) + '</w:p>';
}
function wTc(paras, width, o){
  o = o || {};
  const pr = ['<w:tcW w:w="' + width + '" w:type="dxa"/>'];
  if(o.fill) pr.push('<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>');
  if(o.span) pr.push('<w:gridSpan w:val="' + o.span + '"/>');
  pr.push('<w:vAlign w:val="top"/>');
  const body = (paras && paras.length) ? paras.join('') : wP([wRun('')]);
  return '<w:tc><w:tcPr>' + pr.join('') + '</w:tcPr>' + body + '</w:tc>';
}
function metaLines(p){
  const lines = [];
  lines.push({t: displayName(p), sp: true});
  if(p.kennzeichen) lines.push({t: p.kennzeichen});
  if(p.gesellschaft) lines.push({t: p.gesellschaft});
  if(p.vsnr) lines.push({t: p.vsnr});
  if(p.ablauf) lines.push({t: fmtDate(p.ablauf)});
  if(p.personen) lines.push({t: p.personen});
  return lines;
}
function docContentParas(p, side){
  const leist = side === 'rv' ? p.leistRV : p.leistF;
  const b = side === 'rv' ? rvEffective(p) : p.beitragF;
  const z = side === 'rv' ? p.zwRV : p.zwF;
  const jahrAlt = side !== 'rv' ? beitragsAlt(p) : null;
  const paras = [];
  if(leist) leist.split(/\r?\n/).filter(x => x.trim()).forEach(l => paras.push(wP([wRun(l)])));
  if(b != null){
    const priceRuns = [wRun(fmtNum(b) + ' € ' + BVK.ZW[z].l, {b:true})];
    if(jahrAlt) priceRuns.push(wRun(' (Stand ' + jahrAlt + ')', {sz:17, color:'44546A'}));
    paras.push(wP(priceRuns, {before:60}));
    if(z !== 'jaehrlich') paras.push(wP([wRun('≙ ' + fmtNum(b * BVK.ZW[z].f) + ' € / Jahr', {sz:17, color:'44546A'})]));
  } else if(side === 'rv'){
    paras.push(wP([wRun('0,00 €', {b:true})]));
  }
  return paras;
}
function buildVergleichDocXml(state){
  const W1 = 2700, W2 = 3469, W3 = 3469;
  const arr = [...(state.policies || [])].sort((a, b) => (a.created || 0) - (b.created || 0));
  const fSum = arr.reduce((s, p) => s + (annual(p, 'f') || 0), 0);
  const rSum = arr.reduce((s, p) => s + (annual(p, 'rv') || 0), 0);
  const diff = fSum - rSum;

  let rows = '';
  rows += '<w:tr>' +
    wTc([wP([wRun('Vertrag', {b:true, color:'44546A'})])], W1, {fill:'EDF2F9'}) +
    wTc([wP([wRun(state.spalte || 'Anderer Versicherer', {b:true, color:'FFFFFF'})])], W2, {fill:'0E4DA4'}) +
    wTc([wP([wRun('R+V', {b:true, color:'FFFFFF'})])], W3, {fill:'0E4DA4'}) +
    '</w:tr>';
  arr.forEach(p => {
    const meta = metaLines(p).map(l => wP([wRun(l.t, {i:true, b:!!l.sp})]));
    rows += '<w:tr>' + wTc(meta, W1) + wTc(docContentParas(p, 'f'), W2) + wTc(docContentParas(p, 'rv'), W3) + '</w:tr>';
  });
  rows += '<w:tr>' +
    wTc([wP([wRun('Gesamtsumme / Jahr', {b:true})])], W1, {fill:'EDF2F9'}) +
    wTc([wP([wRun(fmtNum(fSum) + ' €', {b:true})])], W2, {fill:'EDF2F9'}) +
    wTc([wP([wRun(fmtNum(rSum) + ' €', {b:true})])], W3, {fill:'EDF2F9'}) +
    '</w:tr>';
  const diffTxt = (diff < 0 ? '− ' : '') + fmtNum(Math.abs(diff)) + ' €' + (diff < 0 ? ' Mehrbeitrag' : '');
  rows += '<w:tr>' +
    wTc([wP([wRun('Differenz / Jahr (bisher − R+V)', {b:true})])], W1 + W2, {span:2}) +
    wTc([wP([wRun(diffTxt, {b:true, color: diff >= 0 ? '177245' : 'A62B22'})])], W3) +
    '</w:tr>';

  const borders =
    '<w:tblBorders>' +
      '<w:top w:val="single" w:sz="6" w:space="0" w:color="7A8BA0"/>' +
      '<w:left w:val="single" w:sz="6" w:space="0" w:color="7A8BA0"/>' +
      '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="7A8BA0"/>' +
      '<w:right w:val="single" w:sz="6" w:space="0" w:color="7A8BA0"/>' +
      '<w:insideH w:val="single" w:sz="6" w:space="0" w:color="7A8BA0"/>' +
      '<w:insideV w:val="single" w:sz="6" w:space="0" w:color="7A8BA0"/>' +
    '</w:tblBorders>';

  return XMLH +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    wP([wRun('BEITRÄGE', {b:true, sz:34})], {after:60}) +
    (state.kunde ? wP([wRun(state.kunde, {b:true, sz:26})], {after:40}) : '') +
    wP([wRun('Stand ' + todayStr() + ' · ' + arr.length + ' Verträge', {sz:17, color:'44546A'})], {after:160}) +
    '<w:tbl><w:tblPr><w:tblW w:w="' + (W1+W2+W3) + '" w:type="dxa"/>' + borders +
    '<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar>' +
    '<w:tblLayout w:type="fixed"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="' + W1 + '"/><w:gridCol w:w="' + W2 + '"/><w:gridCol w:w="' + W3 + '"/></w:tblGrid>' +
    rows +
    '</w:tbl>' +
    '<w:p/>' +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
}
const CT_XML = XMLH +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '</Types>';
const RELS_XML = XMLH +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';
const DOCRELS_XML = XMLH +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';
const STYLES_XML = XMLH +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr>' +
  '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
  '<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="de-DE"/>' +
  '</w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '</w:styles>';
function downloadBlob(blob, name){
  const a = global.document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  global.document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
BVK.buildVergleichDocXml = buildVergleichDocXml;
BVK.exportVergleichDocx = async function(state){
  if(typeof global.JSZip === 'undefined') throw new Error('JSZip fehlt');
  const z = new global.JSZip();
  z.file('[Content_Types].xml', CT_XML);
  z.file('_rels/.rels', RELS_XML);
  z.file('word/_rels/document.xml.rels', DOCRELS_XML);
  z.file('word/styles.xml', STYLES_XML);
  z.file('word/document.xml', buildVergleichDocXml(state));
  const blob = await z.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const k = (state.kunde || 'Kunde').replace(/[^\wäöüÄÖÜß\- ]/g,'').trim().replace(/\s+/g,'_');
  downloadBlob(blob, 'Bestandsvergleich_' + k + '_' + new Date().toISOString().slice(0,10) + '.docx');
};

/* ---------- Ansichten-Menü (feste Reihenfolge, überall gleich) ---------- */
BVK.ANSICHTEN = [
  { id:'home',      name:'Home',            url:'home.html' },
  { id:'werkbank',  name:'Werkbank',        url:'werkbank.html' },
  { id:'pipeline',  name:'Pipeline',        url:'pipeline.html' },
  { id:'dokument',  name:'Dokument-Studio', url:'dokument.html' },
  { id:'assistent', name:'Assistent',       url:'assistent.html' },
  { id:'copilot',   name:'Copilot',         url:'copilot.html' },
  { id:'klassisch', name:'Klassisch',       url:'index.html' }
];
BVK.ansichtMenu = function(sel, aktuell, vorWechsel){
  if(!sel) return;
  sel.innerHTML = '';
  BVK.ANSICHTEN.forEach(a => {
    const o = global.document.createElement('option');
    o.value = a.id;
    o.textContent = a.id === aktuell ? 'Ansicht: ' + a.name : a.name;
    sel.appendChild(o);
  });
  sel.value = aktuell;
  sel.addEventListener('change', () => {
    const v = sel.value;
    sel.value = aktuell;
    if(v === aktuell) return;
    const ziel = BVK.ANSICHTEN.find(a => a.id === v);
    if(!ziel) return;
    if(typeof vorWechsel === 'function'){ try{ vorWechsel(); }catch(e){} }
    if(store){ try{ store.setItem('bv_ansicht', v); }catch(e){} }
    global.location.href = ziel.url;
  });
};

/* ---------- Schnellerfassung (aus jeder Ansicht aufrufbar) ---------- */
BVK.neuerVertragObjekt = function(){
  return {
    id: 'p' + Date.now() + Math.random().toString(36).slice(2,6),
    created: Date.now(), sparte: 'phv', label: '', gesellschaft: '', vsnr: '', ablauf: '',
    personen: '', kennzeichen: '', leistF: '', beitragF: null, zwF: 'jaehrlich',
    beitragsjahrF: new Date().getFullYear(),
    rv: false, leistRV: '', beitragRV: null, zwRV: 'jaehrlich', rabatt: null, rabattApply: false
  };
};
BVK.schnellVertrag = function(opts){
  opts = opts || {};
  const doc = global.document;
  let dl = doc.getElementById('bvkGesL');
  if(!dl){
    dl = doc.createElement('datalist');
    dl.id = 'bvkGesL';
    const namen = [...new Set(Object.values(BVK.adressbuch()).map(v => v.n).concat(BVK.VERZEICHNIS.map(v => v.n)))]
      .sort((a, b) => a.localeCompare(b, 'de'));
    namen.forEach(n => { const o = doc.createElement('option'); o.value = n; dl.appendChild(o); });
    doc.body.appendChild(dl);
  }
  const ov = doc.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,22,42,.52);z-index:999;display:flex;align-items:flex-start;justify-content:center;padding:8vh 14px;overflow:auto';
  const card = doc.createElement('div');
  card.style.cssText = 'background:#fff;color:#1a2333;border-radius:13px;box-shadow:0 24px 60px rgba(10,20,40,.35);width:min(410px,100%);padding:16px 18px;font:13.5px/1.5 -apple-system,\'Segoe UI\',Roboto,sans-serif';
  const F = 'width:100%;box-sizing:border-box;border:1px solid #D9DEE7;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;color:#1a2333';
  const L = 'display:block;font-size:10.5px;letter-spacing:.05em;color:#7a8294;margin:9px 0 3px';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:14px">Vertrag schnell erfassen</b><button data-x style="border:none;background:none;font-size:16px;color:#7a8294;cursor:pointer">✕</button></div>' +
    '<label style="' + L + '">KUNDE</label><select data-f="kunde" style="' + F + '"></select>' +
    '<label style="' + L + '">SPARTE</label><select data-f="sparte" style="' + F + '"></select>' +
    '<label style="' + L + '">GESELLSCHAFT (BISHER)</label><input data-f="ges" list="bvkGesL" style="' + F + '" placeholder="z. B. Allianz" autocomplete="off">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">VERSICHERUNGSNUMMER</label><input data-f="vsnr" style="' + F + ';font-family:ui-monospace,monospace" placeholder="—"></div>' +
      '<div><label style="' + L + '">ABLAUF</label><input data-f="ablauf" type="date" style="' + F + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">BEITRAG BISHER (€)</label><input data-f="beitrag" inputmode="decimal" style="' + F + ';text-align:right;font-family:ui-monospace,monospace" placeholder="89,90"></div>' +
      '<div><label style="' + L + '">ZAHLWEISE</label><select data-f="zw" style="' + F + '"></select></div>' +
    '</div>' +
    '<div data-warn style="display:none;color:#B3372B;font-size:12px;margin-top:8px"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
      '<button data-x style="border:1px solid #D9DEE7;background:#fff;border-radius:9px;padding:8px 16px;font-size:13px;cursor:pointer;font-family:inherit;color:#1a2333">Abbrechen</button>' +
      '<button data-ok style="border:none;background:#274690;color:#fff;border-radius:9px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Speichern</button>' +
    '</div>' +
    '<div style="font-size:10.5px;color:#9aa2b2;margin-top:8px">Leistungen, R+V-Angebot und Nachlass ergänzt du danach am schnellsten in der Werkbank.</div>';
  const q = s => card.querySelector(s);
  const kSel = q('[data-f="kunde"]');
  const kunden = BVK.liste();
  kunden.forEach(k => {
    const o = doc.createElement('option');
    o.value = k.id;
    o.textContent = k.name + ' (' + k.anzahl + ')';
    kSel.appendChild(o);
  });
  kSel.value = (opts.kundeId && kunden.some(k => k.id === opts.kundeId)) ? opts.kundeId : BVK.aktivId();
  const sSel = q('[data-f="sparte"]');
  BVK.SPARTEN.forEach(s => { const o = doc.createElement('option'); o.value = s.id; o.textContent = s.full; sSel.appendChild(o); });
  const zSel = q('[data-f="zw"]');
  Object.keys(BVK.ZW).forEach(z => { const o = doc.createElement('option'); o.value = z; o.textContent = BVK.ZW[z].l; zSel.appendChild(o); });
  zSel.value = 'jaehrlich';
  function zu(){ ov.remove(); doc.removeEventListener('keydown', escH); }
  function escH(e){ if(e.key === 'Escape') zu(); }
  doc.addEventListener('keydown', escH);
  ov.addEventListener('click', e => { if(e.target === ov) zu(); });
  card.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', zu));
  q('[data-ok]').addEventListener('click', () => {
    const ges = q('[data-f="ges"]').value.trim();
    const beitrag = BVK.parseEuro(q('[data-f="beitrag"]').value);
    const vsnr = q('[data-f="vsnr"]').value.trim();
    if(!ges && beitrag == null && !vsnr){
      const w = q('[data-warn]');
      w.textContent = 'Bitte mindestens Gesellschaft, Versicherungsnummer oder Beitrag angeben.';
      w.style.display = 'block';
      return;
    }
    const kid = kSel.value;
    const st = BVK.stateVon(kid);
    if(!st){ zu(); return; }
    const p = BVK.neuerVertragObjekt();
    p.sparte = sSel.value;
    p.gesellschaft = ges;
    p.vsnr = vsnr;
    p.ablauf = q('[data-f="ablauf"]').value;
    p.beitragF = beitrag;
    p.zwF = zSel.value;
    st.policies.push(p);
    BVK.speichern(kid, st);
    zu();
    if(typeof opts.onDone === 'function'){ try{ opts.onDone(kid, p.id); }catch(e){} }
  });
  doc.body.appendChild(ov);
  ov.appendChild(card);
  const g = q('[data-f="ges"]');
  if(g) g.focus();
};

global.BVK = BVK;
})(typeof window !== 'undefined' ? window : globalThis);
