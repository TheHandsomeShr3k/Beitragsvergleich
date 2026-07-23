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
  snapshotVielleicht();
  if(store){
    try{
      store.setItem(K_KUNDEN, JSON.stringify({ kunden: mem.kunden }));
      store.setItem(K_AKTIV, mem.aktivId);
    }catch(e){}
  }
}
function nameVon(k){ return (k.state.kunde || '').trim() || 'Unbenannter Kunde'; }

BVK.reload = () => { mem = null; abCache = null; };
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
let abCache = null;
BVK.adressbuch = () => {
  if(abCache) return abCache;
  if(store){ try{ const o = JSON.parse(store.getItem(K_AB) || '{}'); if(o && typeof o === 'object'){ abCache = o; return o; } }catch(e){} }
  abCache = {};
  return abCache;
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
  const tag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() - (p.sparte === 'kfz' ? 1 : 3));
  const maxTag = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tag, maxTag));
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
  { id:'klassisch',  name:'Klassisch',       url:'index.html',     desc:'Das bewährte Volltool — Erfassung, Rabatte, Word/PDF, Kündigungen, Adressbuch.' },
  { id:'dokument',   name:'Dokument-Studio', url:'dokument.html',  desc:'Links tippen, rechts entsteht das Kundendokument live als A4 — Drucken und Word direkt.' },
  { id:'home',       name:'Home',            url:'home.html',      beta:true, desc:'Cockpit mit Jahresbilanz, Fristen-Radar und klickbarem Bestand samt Editor.' },
  { id:'assistent',  name:'Assistent',       url:'assistent.html', beta:true, desc:'Geführte Beratung in vier Schritten — Präsentationsmodus fürs Kundengespräch.' },
  { id:'copilot',    name:'Copilot',         url:'copilot.html',   beta:true, desc:'Verträge als Satz eintippen — Karte prüfen, übernehmen, fertig.' },
  { id:'uebersicht', name:'Alle Ansichten und Verwaltung …', url:'ansichten.html', desc:'Vorschau aller Ansichten, Kundenverwaltung, Sicherungen.' }
];
BVK.ansichtMenu = function(sel, aktuell, vorWechsel){
  if(!sel) return;
  sel.innerHTML = '';
  BVK.ANSICHTEN.forEach(a => {
    const o = global.document.createElement('option');
    o.value = a.id;
    o.textContent = (a.id === aktuell ? 'Ansicht: ' : '') + a.name + (a.beta ? ' (Beta)' : '');
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
    '<div style="font-size:10.5px;color:#9aa2b2;margin-top:8px">Leistungen, R+V-Angebot und Nachlass ergänzt du danach per Klick auf den Vertrag (Editor).</div>';
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

/* ---------- Kündigungs-Engine (1:1 aus der Klassik-Ansicht übernommen) ---------- */
function kSubject(d){
  const bez = (d.bez || '').trim();
  const vs = (d.vsnr || '').trim();
  if(!bez) return vs ? 'Kündigung der Vertragsnummer ' + vs : 'Kündigung meines Vertrags';
  let s = /versicherung$/i.test(bez) ? 'Kündigung meiner ' + bez : 'Kündigung \u2013 ' + bez;
  if(vs) s += ', Vertragsnummer ' + vs;
  return s;
}
function kObjekt(d){
  const bez = (d.bez || '').trim();
  if(!bez) return 'o. g. Vertragsnummer';
  return /versicherung$/i.test(bez) ? 'meine o. g. ' + bez : 'den o. g. Vertrag';
}
function kBodyText(d){
  let satz1;
  if(d.termin){
    satz1 = 'hiermit kündige ich ' + kObjekt(d) + ' fristgerecht zum ' + fmtDate(d.termin) +
      (d.hilfsweise ? ', hilfsweise zum nächstmöglichen Termin.' : '.');
  } else {
    satz1 = 'hiermit kündige ich ' + kObjekt(d) + ' zum nächstmöglichen Termin.';
  }
  let satz2 = 'Bitte senden Sie mir eine schriftliche Kündigungsbestätigung unter Angabe des Beendigungszeitpunkts zu.';
  if(d.rueckwerbung) satz2 += ' Eine Kontaktaufnahme Ihrerseits zum Zweck der Rückwerbung ist nicht erwünscht. Ich bitte Sie höflich, davon abzusehen.';
  return { satz1, satz2 };
}
function buildKuendigungDocXml(d){
  const { satz1, satz2 } = kBodyText(d);
  const P = (text, o) => wP([wRun(text, Object.assign({sz:22}, o||{}))], Object.assign({after:60}, o||{}));
  const EMPTY = wP([wRun('', {sz:22})], {after:60});
  let body = '';
  body += P(d.name) + P(d.strasse) + P(d.plzort);
  body += EMPTY + EMPTY;
  body += P(d.ges);
  (d.adr ? d.adr.split(/\r?\n/).filter(x=>x.trim()) : []).forEach(l => { body += P(l); });
  body += EMPTY;
  if(d.fax){ body += P('Fax-Nr: ' + d.fax) + EMPTY; }
  body += wP([wRun(d.ort + ', den ' + fmtDate(d.datum), {sz:22})], {align:'right', after:360});
  body += wP([wRun(kSubject(d), {b:true, sz:22})], {after:280});
  body += P('Sehr geehrte Damen und Herren,', {after:200});
  body += P(satz1, {after:200});
  body += P(satz2, {after:200});
  body += P('Mit freundlichen Grüßen', {after:800});
  body += wP([wRun('_________________________', {sz:22})], {after:40});
  body += P(d.name);
  return XMLH +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    body +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
}
BVK.kuendigung = {
  subject: kSubject,
  objekt: kObjekt,
  body: kBodyText,
  docXml: buildKuendigungDocXml,
  docxBlob: function(d){
    if(typeof global.JSZip === 'undefined') return Promise.reject(new Error('JSZip fehlt'));
    const z = new global.JSZip();
    z.file('[Content_Types].xml', CT_XML);
    z.file('_rels/.rels', RELS_XML);
    z.file('word/_rels/document.xml.rels', DOCRELS_XML);
    z.file('word/styles.xml', STYLES_XML);
    z.file('word/document.xml', buildKuendigungDocXml(d));
    return z.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  },
  exportDocx: async function(d){
    const blob = await BVK.kuendigung.docxBlob(d);
    const g = (d.ges || 'Versicherer').replace(/[^\wäöüÄÖÜß\- ]/g,'').trim().replace(/\s+/g,'_');
    downloadBlob(blob, 'Kuendigung_' + g + '_' + new Date().toISOString().slice(0,10) + '.docx');
  }
};

/* ---------- Adressbuch schreiben (Format identisch zur Klassik) ---------- */
BVK.abSpeichern = function(name, adr, fax){
  const k = normNameV(name) || (name || '').toLowerCase().trim();
  if(!k) return false;
  const ab = Object.assign({}, BVK.adressbuch());
  ab[k] = { n: (name || '').trim(), a: (adr || '').trim(), f: (fax || '').trim(), ts: Date.now(), sa: 'ab', sf: 'ab' };
  if(store){ try{ store.setItem(K_AB, JSON.stringify(ab)); }catch(e){} }
  abCache = null;
  return true;
};
function standTxt(v){
  if(!v) return '';
  if(v.sa === 'ab') return 'Eigenes Adressbuch' + (v.ts ? ' (' + new Date(v.ts).toLocaleDateString('de-DE') + ')' : '');
  return BVK.STAND_LABEL[v.sa] || '';
}

/* ---------- Kündigungs-Dialog (aus jeder Ansicht aufrufbar) ---------- */
BVK.kuendDialog = function(opts){
  opts = opts || {};
  const p = opts.policy || {};
  const abs = opts.absender || {};
  const doc = global.document;
  let dl = doc.getElementById('bvkGesL');
  if(!dl){
    dl = doc.createElement('datalist');
    dl.id = 'bvkGesL';
    [...new Set(Object.values(BVK.adressbuch()).map(v => v.n).concat(BVK.VERZEICHNIS.map(v => v.n)))]
      .sort((a, b) => a.localeCompare(b, 'de'))
      .forEach(n => { const o = doc.createElement('option'); o.value = n; dl.appendChild(o); });
    doc.body.appendChild(dl);
  }
  const ov = doc.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,22,42,.52);z-index:999;display:flex;align-items:flex-start;justify-content:center;padding:5vh 14px;overflow:auto';
  const card = doc.createElement('div');
  card.style.cssText = 'background:#fff;color:#1a2333;border-radius:13px;box-shadow:0 24px 60px rgba(10,20,40,.35);width:min(480px,100%);padding:16px 18px;font:13.5px/1.5 -apple-system,\'Segoe UI\',Roboto,sans-serif;margin-bottom:5vh';
  const F = 'width:100%;box-sizing:border-box;border:1px solid #D9DEE7;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;color:#1a2333';
  const L = 'display:block;font-size:10.5px;letter-spacing:.05em;color:#7a8294;margin:9px 0 3px';
  const C = 'display:flex;align-items:center;gap:7px;font-size:12.5px;margin-top:8px;color:#3a4356';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:14px">Kündigung erstellen' + (opts.kunde ? ' · ' + String(opts.kunde).replace(/</g,'&lt;') : '') + '</b><button data-x style="border:none;background:none;font-size:16px;color:#7a8294;cursor:pointer">✕</button></div>' +
    '<label style="' + L + '">ABSENDER (VERSICHERUNGSNEHMER)</label><input data-f="name" style="' + F + '" placeholder="Vorname Nachname">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">STRASSE</label><input data-f="strasse" style="' + F + '"></div>' +
      '<div><label style="' + L + '">PLZ UND ORT</label><input data-f="plzort" style="' + F + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">ORT (DATUMSZEILE)</label><select data-f="ortwahl" style="' + F + '"><option value="Röthenbach">Röthenbach a. d. Pegnitz</option><option value="Schnaittach">Schnaittach</option><option value="__custom">Anderer Ort …</option></select></div>' +
      '<div><label style="' + L + '">DATUM</label><input data-f="datum" type="date" style="' + F + '"></div>' +
    '</div>' +
    '<div data-ortrow style="display:none"><label style="' + L + '">ORT (MANUELL)</label><input data-f="ortcustom" style="' + F + '"></div>' +
    '<label style="' + L + '">EMPFÄNGER — GESELLSCHAFT</label><input data-f="ges" list="bvkGesL" style="' + F + '" autocomplete="off">' +
    '<label style="' + L + '">ANSCHRIFT (EINE ANGABE PRO ZEILE)</label><textarea data-f="adr" style="' + F + ';min-height:56px;resize:vertical"></textarea>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">FAX (OPTIONAL)</label><input data-f="fax" style="' + F + ';font-family:ui-monospace,monospace"></div>' +
      '<div><label style="' + L + '">VERTRAGSNUMMER</label><input data-f="vsnr" style="' + F + ';font-family:ui-monospace,monospace"></div>' +
    '</div>' +
    '<div data-note style="font-size:11px;color:#1c7a4d;margin-top:5px"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">VERSICHERUNGSART (BETREFF)</label><input data-f="bez" style="' + F + '"></div>' +
      '<div><label style="' + L + '">KÜNDIGUNG ZUM</label><input data-f="termin" type="date" style="' + F + '"></div>' +
    '</div>' +
    '<label style="' + C + '"><input data-f="hilfsweise" type="checkbox" checked> „hilfsweise zum nächstmöglichen Termin" ergänzen</label>' +
    '<label style="' + C + '"><input data-f="rueckwerbung" type="checkbox" checked> Rückwerbung untersagen</label>' +
    '<label style="' + C + '"><input data-f="status" type="checkbox" checked> Status auf „Kündigung raus" setzen</label>' +
    '<label style="' + C + '"><input data-f="abmerken" type="checkbox"> Empfängerdaten im Adressbuch merken</label>' +
    '<div data-warn style="display:none;color:#B3372B;font-size:12px;margin-top:8px"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
      '<button data-x style="border:1px solid #D9DEE7;background:#fff;border-radius:9px;padding:8px 16px;font-size:13px;cursor:pointer;font-family:inherit;color:#1a2333">Abbrechen</button>' +
      '<button data-ok style="border:none;background:#274690;color:#fff;border-radius:9px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Als Word erstellen</button>' +
    '</div>' +
    '<div style="font-size:10.5px;color:#9aa2b2;margin-top:8px">Für Papier: Sammel-Kündigung nutzen (druckt alle) oder die Word-Datei drucken.</div>';
  const q = s => card.querySelector('[data-f="' + s + '"]');
  q('name').value = abs.name || '';
  q('strasse').value = abs.strasse || '';
  q('plzort').value = abs.ort || '';
  const ow = opts.kOrtWahl || 'Röthenbach';
  if(ow === 'Röthenbach' || ow === 'Schnaittach'){ q('ortwahl').value = ow; }
  else { q('ortwahl').value = '__custom'; card.querySelector('[data-ortrow]').style.display = ''; q('ortcustom').value = ow; }
  q('ortwahl').addEventListener('change', () => {
    card.querySelector('[data-ortrow]').style.display = q('ortwahl').value === '__custom' ? '' : 'none';
  });
  q('datum').value = new Date().toISOString().slice(0,10);
  q('vsnr').value = p.vsnr || '';
  q('bez').value = kuendBez(p);
  q('termin').value = p.ablauf || '';
  function fuelleEmpfaenger(name){
    const v = lookupVersicherer(name);
    if(v){
      q('ges').value = v.n;
      q('adr').value = v.a || '';
      q('fax').value = v.f || '';
      card.querySelector('[data-note]').textContent = 'Anschrift: ' + standTxt(v) + ' — vor Versand kurz gegenprüfen.';
    } else {
      card.querySelector('[data-note]').textContent = name ? 'Keine Anschrift im Verzeichnis gefunden — bitte eintragen.' : '';
    }
  }
  fuelleEmpfaenger(p.gesellschaft || '');
  if(!q('ges').value) q('ges').value = p.gesellschaft || '';
  q('ges').addEventListener('change', () => fuelleEmpfaenger(q('ges').value));
  function zu(){ ov.remove(); doc.removeEventListener('keydown', escH); }
  function escH(e){ if(e.key === 'Escape') zu(); }
  doc.addEventListener('keydown', escH);
  ov.addEventListener('click', e => { if(e.target === ov) zu(); });
  card.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', zu));
  card.querySelector('[data-ok]').addEventListener('click', async () => {
    const warn = card.querySelector('[data-warn]');
    const name = q('name').value.trim();
    const ges = q('ges').value.trim();
    const adr = q('adr').value.trim();
    if(!name || !ges || !adr){
      warn.textContent = 'Bitte Absendername, Gesellschaft und Anschrift ausfüllen.';
      warn.style.display = 'block';
      return;
    }
    const ortWahl = q('ortwahl').value === '__custom' ? q('ortcustom').value.trim() : q('ortwahl').value;
    const d = {
      name: name, strasse: q('strasse').value.trim(), plzort: q('plzort').value.trim(),
      ort: ortWahl || 'Röthenbach', ortWahl: ortWahl || 'Röthenbach',
      datum: q('datum').value, hilfsweise: q('hilfsweise').checked, rueckwerbung: q('rueckwerbung').checked,
      bez: q('bez').value.trim(), vsnr: q('vsnr').value.trim(), termin: q('termin').value,
      ges: ges, adr: adr, fax: q('fax').value.trim()
    };
    if(q('abmerken').checked) BVK.abSpeichern(ges, adr, d.fax);
    try{
      await BVK.kuendigung.exportDocx(d);
    }catch(e){
      warn.textContent = 'Export fehlgeschlagen — Internetverbindung für JSZip nötig.';
      warn.style.display = 'block';
      return;
    }
    const statusSetzen = q('status').checked;
    zu();
    if(typeof opts.onExported === 'function'){ try{ opts.onExported(d, statusSetzen); }catch(e){} }
  });
  doc.body.appendChild(ov);
  ov.appendChild(card);
};

/* ---------- Kunden-Verwaltung als Dialog (aus jeder Ansicht) ---------- */
BVK.kundenDialog = function(opts){
  opts = opts || {};
  const doc = global.document;
  const ov = doc.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,22,42,.52);z-index:999;display:flex;align-items:flex-start;justify-content:center;padding:8vh 14px;overflow:auto';
  const card = doc.createElement('div');
  card.style.cssText = 'background:#fff;color:#1a2333;border-radius:13px;box-shadow:0 24px 60px rgba(10,20,40,.35);width:min(440px,100%);padding:16px 18px;font:13.5px/1.5 -apple-system,\'Segoe UI\',Roboto,sans-serif;margin-bottom:8vh';
  function melde(){ if(typeof opts.onChange === 'function'){ try{ opts.onChange(); }catch(e){} } }
  function zu(){ ov.remove(); doc.removeEventListener('keydown', escH); }
  function escH(e){ if(e.key === 'Escape') zu(); }
  function bauen(){
    card.innerHTML = '';
    const kopf = doc.createElement('div');
    kopf.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
    const t = doc.createElement('b');
    t.textContent = 'Kunden verwalten';
    t.style.fontSize = '14px';
    const x = doc.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'border:none;background:none;font-size:16px;color:#7a8294;cursor:pointer';
    x.addEventListener('click', zu);
    kopf.append(t, x);
    card.appendChild(kopf);
    const aktiv = BVK.aktivId();
    BVK.liste().forEach(k => {
      const row = doc.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:9px;padding:7px 2px;border-bottom:1px solid #F0F2F5;font-size:13px';
      const n = doc.createElement('span');
      n.textContent = k.name;
      n.title = 'Als aktiven Kunden setzen';
      n.style.cssText = 'font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;flex:1' + (k.id === aktiv ? ';color:#274690' : '');
      n.addEventListener('click', () => { BVK.setAktiv(k.id); bauen(); melde(); });
      const m = doc.createElement('span');
      m.textContent = k.anzahl + ' Verträge';
      m.style.cssText = 'color:#8a93a5;font-size:11.5px;flex:none';
      row.append(n, m);
      if(k.id === aktiv){
        const b = doc.createElement('span');
        b.textContent = 'AKTIV';
        b.style.cssText = 'font-size:9.5px;font-weight:700;color:#274690;background:#E4EDFB;border-radius:99px;padding:2px 8px;flex:none';
        row.appendChild(b);
      }
      const del = doc.createElement('button');
      del.textContent = 'Löschen';
      del.style.cssText = 'border:1px solid #EFD7D4;background:#fff;color:#B3372B;border-radius:7px;padding:3px 10px;font-size:11.5px;font-weight:600;cursor:pointer;flex:none;font-family:inherit';
      del.addEventListener('click', () => {
        if(!global.confirm('Kunde \u201E' + k.name + '\u201C mit ' + k.anzahl + ' Verträgen endgültig löschen?')) return;
        if(!BVK.loeschen(k.id)) global.alert('Der letzte Kunde kann nicht gelöscht werden.');
        bauen();
        melde();
      });
      row.appendChild(del);
      card.appendChild(row);
    });
    const neuRow = doc.createElement('div');
    neuRow.style.cssText = 'display:flex;gap:8px;margin-top:12px';
    const inp = doc.createElement('input');
    inp.placeholder = 'Neuer Kunde \u2014 Name';
    inp.style.cssText = 'flex:1;min-width:0;border:1px solid #D9DEE7;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit';
    const add = doc.createElement('button');
    add.textContent = '+ Anlegen';
    add.style.cssText = 'border:none;background:#274690;color:#fff;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;flex:none';
    function anlegen(){
      BVK.neu(inp.value.trim());
      inp.value = '';
      bauen();
      melde();
    }
    add.addEventListener('click', anlegen);
    inp.addEventListener('keydown', e => { if(e.key === 'Enter') anlegen(); });
    neuRow.append(inp, add);
    card.appendChild(neuRow);
    const hint = doc.createElement('div');
    hint.textContent = 'Klick auf einen Namen macht ihn zum aktiven Kunden. Löschen entfernt den Kunden samt Verträgen endgültig.';
    hint.style.cssText = 'font-size:10.5px;color:#9aa2b2;margin-top:9px';
    card.appendChild(hint);
  }
  doc.addEventListener('keydown', escH);
  ov.addEventListener('click', e => { if(e.target === ov) zu(); });
  bauen();
  doc.body.appendChild(ov);
  ov.appendChild(card);
};

/* ---------- Vertrags-Editor als Overlay (aus jeder Ansicht) ---------- */
BVK.vertragDialog = function(opts){
  opts = opts || {};
  const doc = global.document;
  const kid = opts.kundeId || BVK.aktivId();
  const st = BVK.stateVon(kid);
  if(!st) return;
  let p = opts.policyId ? st.policies.find(x => x.id === opts.policyId) : null;
  const neu = !p;
  if(neu) p = BVK.neuerVertragObjekt();
  let dl = doc.getElementById('bvkGesL');
  if(!dl){
    dl = doc.createElement('datalist');
    dl.id = 'bvkGesL';
    [...new Set(Object.values(BVK.adressbuch()).map(v => v.n).concat(BVK.VERZEICHNIS.map(v => v.n)))]
      .sort((a, b) => a.localeCompare(b, 'de'))
      .forEach(n => { const o = doc.createElement('option'); o.value = n; dl.appendChild(o); });
    doc.body.appendChild(dl);
  }
  const ov = doc.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,22,42,.52);z-index:999;display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow:auto';
  const card = doc.createElement('div');
  card.style.cssText = 'background:#fff;color:#1a2333;border-radius:13px;box-shadow:0 24px 60px rgba(10,20,40,.35);width:min(520px,100%);padding:16px 18px;font:13.5px/1.5 -apple-system,\'Segoe UI\',Roboto,sans-serif;margin-bottom:4vh';
  const F = 'width:100%;box-sizing:border-box;border:1px solid #D9DEE7;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;color:#1a2333';
  const L = 'display:block;font-size:10.5px;letter-spacing:.05em;color:#7a8294;margin:9px 0 3px';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:14px">' + (neu ? 'Vertrag erfassen' : 'Vertrag bearbeiten') + ' \u00b7 ' + String((st.kunde || 'Unbenannter Kunde')).replace(/</g,'&lt;') + '</b><button data-x style="border:none;background:none;font-size:16px;color:#7a8294;cursor:pointer">\u2715</button></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">SPARTE</label><select data-f="sparte" style="' + F + '"></select></div>' +
      '<div><label style="' + L + '">GESELLSCHAFT (BISHER)</label><input data-f="ges" list="bvkGesL" style="' + F + '" autocomplete="off"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">VERSICHERUNGSNUMMER</label><input data-f="vsnr" style="' + F + ';font-family:ui-monospace,monospace"></div>' +
      '<div><label style="' + L + '">ABLAUF</label><input data-f="ablauf" type="date" style="' + F + '"><div data-frist style="font-size:10.5px;color:#8a6410;margin-top:3px"></div></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">PERSONEN / OBJEKT</label><input data-f="personen" style="' + F + '"></div>' +
      '<div data-extra></div>' +
    '</div>' +
    '<label style="' + L + '">LEISTUNGEN \u2014 BISHERIGER VERTRAG (EINE ANGABE PRO ZEILE)</label>' +
    '<textarea data-f="leistF" style="' + F + ';min-height:56px;resize:vertical" placeholder="z. B. Versicherungssumme 85.000 \u20ac"></textarea>' +
    '<div style="display:grid;grid-template-columns:1.1fr 1fr .9fr;gap:10px">' +
      '<div><label style="' + L + '">BEITRAG BISHER (\u20ac)</label><input data-f="beitragF" inputmode="decimal" style="' + F + ';text-align:right;font-family:ui-monospace,monospace"></div>' +
      '<div><label style="' + L + '">ZAHLWEISE</label><select data-f="zwF" style="' + F + '"></select></div>' +
      '<div><label style="' + L + '">BEITRAGSSTAND</label><select data-f="jahr" style="' + F + '"></select></div>' +
    '</div>' +
    '<label style="' + L + '">LEISTUNGEN \u2014 R+V</label>' +
    '<textarea data-f="leistRV" style="' + F + ';min-height:56px;resize:vertical"></textarea>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">BEITRAG R+V (\u20ac)</label><input data-f="beitragRV" inputmode="decimal" style="' + F + ';text-align:right;font-family:ui-monospace,monospace" placeholder="leer = 0,00 \u20ac im Dokument"></div>' +
      '<div><label style="' + L + '">ZAHLWEISE</label><select data-f="zwRV" style="' + F + '"></select></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#3a4356;margin-top:9px;flex-wrap:wrap">' +
      '<span>R+V-Nachlass intern:</span>' +
      '<input data-f="rabatt" inputmode="decimal" style="width:58px;border:1px solid #D9DEE7;border-radius:7px;padding:5px 7px;font-size:12px;text-align:right;font-family:ui-monospace,monospace">%' +
      '<label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input data-f="rabattApply" type="checkbox"> einrechnen</label>' +
      '<span data-eff style="color:#1c7a4d;font-size:11px"></span>' +
    '</div>' +
    '<div data-warn style="display:none;color:#B3372B;font-size:12px;margin-top:8px"></div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:14px">' +
      (neu ? '' : '<button data-del style="border:1px solid #EFD7D4;background:#fff;color:#B3372B;border-radius:9px;padding:8px 13px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit">L\u00f6schen</button>') +
      '<span style="flex:1"></span>' +
      '<button data-ku style="border:1px solid #D9DEE7;background:#fff;border-radius:9px;padding:8px 13px;font-size:12.5px;cursor:pointer;font-family:inherit;color:#1a2333">\u2709 K\u00fcndigung</button>' +
      '<button data-x style="border:1px solid #D9DEE7;background:#fff;border-radius:9px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit;color:#1a2333">Abbrechen</button>' +
      '<button data-ok style="border:none;background:#274690;color:#fff;border-radius:9px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Speichern</button>' +
    '</div>';
  const q = s => card.querySelector('[data-f="' + s + '"]');
  const sSel = q('sparte');
  BVK.SPARTEN.forEach(s => { const o = doc.createElement('option'); o.value = s.id; o.textContent = s.full; if(s.id === p.sparte) o.selected = true; sSel.appendChild(o); });
  [q('zwF'), q('zwRV')].forEach((sel, i) => {
    Object.keys(BVK.ZW).forEach(z => {
      const o = doc.createElement('option');
      o.value = z; o.textContent = BVK.ZW[z].l;
      if(z === (i ? p.zwRV : p.zwF)) o.selected = true;
      sel.appendChild(o);
    });
  });
  const jSel = q('jahr');
  const jetzt = new Date().getFullYear();
  for(let i = 0; i <= 8; i++){
    const o = doc.createElement('option');
    o.value = String(jetzt - i);
    o.textContent = i === 0 ? jetzt + ' (aktuell)' : String(jetzt - i);
    jSel.appendChild(o);
  }
  const jv = String(p.beitragsjahrF || jetzt);
  if(![...jSel.options].some(o => o.value === jv)){ const o = doc.createElement('option'); o.value = jv; o.textContent = jv; jSel.appendChild(o); }
  jSel.value = jv;
  q('ges').value = p.gesellschaft || '';
  q('vsnr').value = p.vsnr || '';
  q('ablauf').value = p.ablauf || '';
  q('personen').value = p.personen || '';
  q('leistF').value = p.leistF || '';
  q('beitragF').value = p.beitragF != null ? fmtNum(p.beitragF) : '';
  q('leistRV').value = p.leistRV || '';
  q('beitragRV').value = p.beitragRV != null ? fmtNum(p.beitragRV) : '';
  q('rabatt').value = p.rabatt != null ? String(p.rabatt).replace('.', ',') : '';
  q('rabattApply').checked = !!p.rabattApply;
  function extraBauen(){
    const slot = card.querySelector('[data-extra]');
    const sp = sSel.value;
    if(sp === 'kfz'){
      slot.innerHTML = '<label style="' + L + '">KENNZEICHEN</label><input data-f="kennzeichen" style="' + F + '" placeholder="AB-CD 123">';
      q('kennzeichen').value = p.kennzeichen || '';
    } else if(sp === 'so'){
      slot.innerHTML = '<label style="' + L + '">BEZEICHNUNG</label><input data-f="label" style="' + F + '" placeholder="z. B. Schutzbrief">';
      q('label').value = p.label || '';
    } else {
      slot.innerHTML = '';
    }
  }
  function fristHinweis(){
    const el = card.querySelector('[data-frist]');
    const f = fristDate({ sparte: sSel.value, ablauf: q('ablauf').value });
    if(!f){ el.textContent = ''; return; }
    const tage = Math.round((f - new Date()) / 864e5);
    el.textContent = 'K\u00fcndigungsfrist: ' + f.toLocaleDateString('de-DE') + (tage >= 0 ? ' (in ' + tage + ' Tagen)' : ' (vorbei)');
  }
  function effHinweis(){
    const el = card.querySelector('[data-eff]');
    const b = parseEuro(q('beitragRV').value);
    const r = parseEuro(q('rabatt').value);
    if(q('rabattApply').checked && b != null && r > 0){
      const eff = Math.round(b * (1 - Math.min(r, 100) / 100) * 100) / 100;
      el.textContent = '\u2192 effektiv ' + fmtNum(eff) + ' \u20ac (Kundendokumente ohne Rabatt-Spuren)';
    } else el.textContent = '';
  }
  extraBauen();
  fristHinweis();
  effHinweis();
  sSel.addEventListener('change', () => { extraBauen(); fristHinweis(); });
  q('ablauf').addEventListener('change', fristHinweis);
  q('beitragRV').addEventListener('change', effHinweis);
  q('rabatt').addEventListener('change', effHinweis);
  q('rabattApply').addEventListener('change', effHinweis);
  function sammle(){
    p.sparte = sSel.value;
    p.gesellschaft = q('ges').value.trim();
    p.vsnr = q('vsnr').value.trim();
    p.ablauf = q('ablauf').value;
    p.personen = q('personen').value.trim();
    p.kennzeichen = q('kennzeichen') ? q('kennzeichen').value.trim() : (p.sparte === 'kfz' ? p.kennzeichen : '');
    p.label = q('label') ? q('label').value.trim() : (p.sparte === 'so' ? p.label : '');
    p.leistF = q('leistF').value;
    p.beitragF = parseEuro(q('beitragF').value);
    p.zwF = q('zwF').value;
    p.beitragsjahrF = parseInt(jSel.value, 10) || null;
    p.leistRV = q('leistRV').value;
    p.beitragRV = parseEuro(q('beitragRV').value);
    p.rv = p.beitragRV != null;
    p.zwRV = q('zwRV').value;
    const r = parseEuro(q('rabatt').value);
    p.rabatt = (r != null && r > 0) ? Math.min(r, 100) : null;
    p.rabattApply = q('rabattApply').checked;
  }
  function schreibe(){
    if(neu && !st.policies.some(x => x.id === p.id)) st.policies.push(p);
    return BVK.speichern(kid, st);
  }
  function fertig(art){
    zu();
    if(typeof opts.onDone === 'function'){ try{ opts.onDone(kid, art === 'geloescht' ? null : p.id, art); }catch(e){} }
  }
  function zu(){ ov.remove(); doc.removeEventListener('keydown', escH); }
  function escH(e){ if(e.key === 'Escape') zu(); }
  doc.addEventListener('keydown', escH);
  ov.addEventListener('click', e => { if(e.target === ov) zu(); });
  card.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', zu));
  card.querySelector('[data-ok]').addEventListener('click', () => {
    sammle();
    if(!p.gesellschaft && !p.vsnr && p.beitragF == null){
      const w = card.querySelector('[data-warn]');
      w.textContent = 'Bitte mindestens Gesellschaft, Versicherungsnummer oder Beitrag angeben.';
      w.style.display = 'block';
      return;
    }
    schreibe();
    fertig('gespeichert');
  });
  const delBtn = card.querySelector('[data-del]');
  if(delBtn) delBtn.addEventListener('click', () => {
    if(!global.confirm('Diesen Vertrag endg\u00fcltig l\u00f6schen?')) return;
    st.policies = st.policies.filter(x => x.id !== p.id);
    BVK.speichern(kid, st);
    fertig('geloescht');
  });
  card.querySelector('[data-ku]').addEventListener('click', () => {
    sammle();
    schreibe();
    fertig('gespeichert');
    BVK.kuendDialog({
      policy: p,
      kunde: st.kunde,
      absender: st.absender,
      kOrtWahl: st.kOrtWahl,
      onExported: (d, statusSetzen) => {
        const st2 = BVK.stateVon(kid);
        if(!st2) return;
        st2.absender = { name: d.name, strasse: d.strasse, ort: d.plzort };
        st2.kOrtWahl = d.ortWahl;
        const pp = st2.policies.find(x => x.id === p.id);
        if(pp && statusSetzen) pp.status = 'kuendigung';
        BVK.speichern(kid, st2);
        if(typeof opts.onDone === 'function'){ try{ opts.onDone(kid, p.id, 'gespeichert'); }catch(e){} }
      }
    });
  });
  doc.body.appendChild(ov);
  ov.appendChild(card);
};

/* ---------- Gemeinsame Druckzone (Vergleich und Briefe) ---------- */
function druckZone(){
  const doc = global.document;
  let z = doc.getElementById('bvkPrintZone');
  if(z) return z;
  const st = doc.createElement('style');
  st.id = 'bvkPrintCss';
  st.textContent =
    '#bvkPrintZone{display:none}' +
    '@media print{' +
      'body.bvkDruck > :not(#bvkPrintZone){display:none !important}' +
      'body.bvkDruck #bvkPrintZone{display:block !important}' +
      '#bvkPrintZone{color:#111;font-family:-apple-system,\'Segoe UI\',Roboto,sans-serif}' +
      '#bvkPrintZone .bvkblatt{font-size:11px;line-height:1.45}' +
      '#bvkPrintZone h1{margin:0;font-size:17px;letter-spacing:.12em}' +
      '#bvkPrintZone .kd{font-size:12.5px;font-weight:700;margin-top:2px}' +
      '#bvkPrintZone .meta{font-size:9.5px;color:#5B6B80;margin-bottom:9px}' +
      '#bvkPrintZone table{width:100%;border-collapse:collapse;font-size:9.5px}' +
      '#bvkPrintZone td,#bvkPrintZone th{border:.75pt solid #7A8BA0;padding:4px 6px;vertical-align:top;text-align:left}' +
      '#bvkPrintZone th.v{background:#EDF2F9;color:#42536B;width:28%}' +
      '#bvkPrintZone th.b{background:#0E4DA4;color:#fff}' +
      '#bvkPrintZone .m{font-style:italic}' +
      '#bvkPrintZone .pr{font-weight:700}' +
      '#bvkPrintZone .an{color:#42536B;font-size:8.5px}' +
      '#bvkPrintZone .tot td{background:#EDF2F9;font-weight:700}' +
      '#bvkPrintZone .df td{font-weight:700}' +
      '#bvkPrintZone .df .gr{color:#177245}' +
      '#bvkPrintZone .df .rd{color:#A62B22}' +
      '#bvkPrintZone .bvkpage{page-break-after:always;font-size:12pt;line-height:1.55}' +
      '#bvkPrintZone .bvkpage:last-child{page-break-after:auto}' +
      '#bvkPrintZone .bvkpage p{margin:0 0 5pt}' +
      '#bvkPrintZone .bvkpage .leer{height:12pt}' +
      '#bvkPrintZone .bvkpage .re{text-align:right;margin:16pt 0}' +
      '#bvkPrintZone .bvkpage .bet{font-weight:700;margin:12pt 0 10pt}' +
      '#bvkPrintZone .bvkpage .sig{margin-top:42pt}' +
    '}';
  doc.head.appendChild(st);
  z = doc.createElement('div');
  z.id = 'bvkPrintZone';
  doc.body.appendChild(z);
  return z;
}
function drucke(html){
  const doc = global.document;
  const z = druckZone();
  z.innerHTML = html;
  doc.body.classList.add('bvkDruck');
  const fertig = () => {
    doc.body.classList.remove('bvkDruck');
    global.removeEventListener('afterprint', fertig);
  };
  global.addEventListener('afterprint', fertig);
  setTimeout(() => global.print(), 40);
}
function vglZelleHtml(p, side){
  const leist = side === 'rv' ? p.leistRV : p.leistF;
  const b = side === 'rv' ? rvEffective(p) : p.beitragF;
  const z = side === 'rv' ? p.zwRV : p.zwF;
  const alt = side !== 'rv' ? beitragsAlt(p) : null;
  let h = '';
  if(leist) h += leist.split(/\r?\n/).filter(x => x.trim()).map(l => '<div>' + xEsc(l) + '</div>').join('');
  if(b != null){
    h += '<div class="pr">' + fmtNum(b) + ' € ' + BVK.ZW[z].l + (alt ? ' <span class="an">(Stand ' + alt + ')</span>' : '') + '</div>';
    if(z !== 'jaehrlich') h += '<div class="an">≙ ' + fmtNum(b * BVK.ZW[z].f) + ' € / Jahr</div>';
  } else if(side === 'rv'){
    h += '<div class="pr">0,00 €</div>';
  }
  return h;
}
BVK.druckeVergleich = function(state){
  state = ensureStateShape(state);
  const arr = [...state.policies].sort((a, b) => (a.created || 0) - (b.created || 0));
  const fS = arr.reduce((s, p) => s + (annual(p, 'f') || 0), 0);
  const rS = arr.reduce((s, p) => s + (annual(p, 'rv') || 0), 0);
  const d = fS - rS;
  let rows = '';
  arr.forEach(p => {
    let meta = '<div class="m" style="font-weight:700">' + xEsc(displayName(p)) + '</div>';
    if(p.kennzeichen) meta += '<div class="m">' + xEsc(p.kennzeichen) + '</div>';
    if(p.gesellschaft) meta += '<div class="m">' + xEsc(p.gesellschaft) + '</div>';
    if(p.vsnr) meta += '<div class="m">' + xEsc(p.vsnr) + '</div>';
    if(p.ablauf) meta += '<div class="m">' + xEsc(fmtDate(p.ablauf)) + '</div>';
    if(p.personen) meta += '<div class="m">' + xEsc(p.personen) + '</div>';
    rows += '<tr><td>' + meta + '</td><td>' + vglZelleHtml(p, 'f') + '</td><td>' + vglZelleHtml(p, 'rv') + '</td></tr>';
  });
  drucke(
    '<div class="bvkblatt">' +
    '<h1>BEITRÄGE</h1>' +
    (state.kunde ? '<div class="kd">' + xEsc(state.kunde) + '</div>' : '') +
    '<div class="meta">Stand ' + todayStr() + ' · ' + arr.length + ' Verträge</div>' +
    '<table><tr><th class="v">Vertrag</th><th class="b">' + xEsc(state.spalte || 'Anderer Versicherer') + '</th><th class="b">R+V</th></tr>' +
    rows +
    '<tr class="tot"><td>Gesamtsumme / Jahr</td><td>' + fmtNum(fS) + ' €</td><td>' + fmtNum(rS) + ' €</td></tr>' +
    '<tr class="df"><td colspan="2">Differenz / Jahr (bisher − R+V)</td><td class="' + (d >= 0 ? 'gr' : 'rd') + '">' + (d < 0 ? '− ' : '') + fmtNum(Math.abs(d)) + ' €' + (d < 0 ? ' Mehrbeitrag' : '') + '</td></tr>' +
    '</table></div>'
  );
};

/* ---------- Sammel-Kündigung (aus jeder Ansicht) ---------- */
function briefHtml(d){
  const t = BVK.kuendigung.body(d);
  let h = '<div class="bvkpage">';
  h += '<p>' + xEsc(d.name) + '</p><p>' + xEsc(d.strasse) + '</p><p>' + xEsc(d.plzort) + '</p>';
  h += '<div class="leer"></div><div class="leer"></div>';
  h += '<p>' + xEsc(d.ges) + '</p>';
  (d.adr ? d.adr.split(/\r?\n/).filter(x => x.trim()) : []).forEach(l => { h += '<p>' + xEsc(l) + '</p>'; });
  if(d.fax){ h += '<div class="leer"></div><p>Fax-Nr: ' + xEsc(d.fax) + '</p>'; }
  h += '<p class="re">' + xEsc(d.ort) + ', den ' + fmtDate(d.datum) + '</p>';
  h += '<p class="bet">' + xEsc(BVK.kuendigung.subject(d)) + '</p>';
  h += '<p>Sehr geehrte Damen und Herren,</p>';
  h += '<p>' + xEsc(t.satz1) + '</p>';
  h += '<p>' + xEsc(t.satz2) + '</p>';
  h += '<p style="margin-top:14pt">Mit freundlichen Grüßen</p>';
  h += '<p class="sig">_________________________</p>';
  h += '<p>' + xEsc(d.name) + '</p>';
  h += '</div>';
  return h;
}
BVK.sammelDialog = function(opts){
  opts = opts || {};
  const doc = global.document;
  const kid = opts.kundeId || BVK.aktivId();
  const st = BVK.stateVon(kid);
  if(!st) return;
  if(!st.policies.length){ global.alert('Dieser Kunde hat noch keine Verträge.'); return; }
  const ov = doc.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,22,42,.52);z-index:999;display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow:auto';
  const card = doc.createElement('div');
  card.style.cssText = 'background:#fff;color:#1a2333;border-radius:13px;box-shadow:0 24px 60px rgba(10,20,40,.35);width:min(560px,100%);padding:16px 18px;font:13.5px/1.5 -apple-system,\'Segoe UI\',Roboto,sans-serif;margin-bottom:4vh';
  const F = 'width:100%;box-sizing:border-box;border:1px solid #D9DEE7;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;color:#1a2333';
  const L = 'display:block;font-size:10.5px;letter-spacing:.05em;color:#7a8294;margin:9px 0 3px';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:14px">Sammel-Kündigung · ' + String(st.kunde || 'Unbenannter Kunde').replace(/</g,'&lt;') + '</b><button data-x style="border:none;background:none;font-size:16px;color:#7a8294;cursor:pointer">✕</button></div>' +
    '<div style="display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">ABSENDER</label><input data-f="name" style="' + F + '" placeholder="Vorname Nachname"></div>' +
      '<div><label style="' + L + '">STRASSE</label><input data-f="strasse" style="' + F + '"></div>' +
      '<div><label style="' + L + '">PLZ UND ORT</label><input data-f="plzort" style="' + F + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
      '<div><label style="' + L + '">ORT</label><select data-f="ortwahl" style="' + F + '"><option value="Röthenbach">Röthenbach a. d. Pegnitz</option><option value="Schnaittach">Schnaittach</option><option value="__custom">Anderer …</option></select></div>' +
      '<div data-ortrow style="display:none"><label style="' + L + '">ORT (MANUELL)</label><input data-f="ortcustom" style="' + F + '"></div>' +
      '<div><label style="' + L + '">DATUM</label><input data-f="datum" type="date" style="' + F + '"></div>' +
    '</div>' +
    '<label style="' + L + '">VERTRÄGE</label>' +
    '<div data-liste style="border:1px solid #ECEFF4;border-radius:9px;max-height:240px;overflow:auto"></div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#3a4356;margin-top:9px">' +
      '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input data-f="hilfsweise" type="checkbox" checked> hilfsweise-Klausel</label>' +
      '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input data-f="rueckwerbung" type="checkbox" checked> Rückwerbung untersagen</label>' +
      '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input data-f="status" type="checkbox" checked> Status „Kündigung raus" setzen</label>' +
    '</div>' +
    '<div data-warn style="display:none;color:#B3372B;font-size:12px;margin-top:8px"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">' +
      '<button data-x style="border:1px solid #D9DEE7;background:#fff;border-radius:9px;padding:8px 16px;font-size:13px;cursor:pointer;font-family:inherit;color:#1a2333">Abbrechen</button>' +
      '<button data-druck style="border:1px solid #D9DEE7;background:#fff;border-radius:9px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit;color:#1a2333">Alle drucken</button>' +
      '<button data-zip style="border:none;background:#274690;color:#fff;border-radius:9px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">ZIP mit Word-Dateien</button>' +
    '</div>' +
    '<div style="font-size:10.5px;color:#9aa2b2;margin-top:8px">Verträge ohne gefundene Anschrift sind abgewählt — Anschrift über ✉ am einzelnen Vertrag ergänzen und im Adressbuch merken.</div>';
  const q = s => card.querySelector('[data-f="' + s + '"]');
  q('name').value = (st.absender && st.absender.name) || '';
  q('strasse').value = (st.absender && st.absender.strasse) || '';
  q('plzort').value = (st.absender && st.absender.ort) || '';
  const ow = st.kOrtWahl || 'Röthenbach';
  if(ow === 'Röthenbach' || ow === 'Schnaittach') q('ortwahl').value = ow;
  else { q('ortwahl').value = '__custom'; card.querySelector('[data-ortrow]').style.display = ''; q('ortcustom').value = ow; }
  q('ortwahl').addEventListener('change', () => {
    card.querySelector('[data-ortrow]').style.display = q('ortwahl').value === '__custom' ? '' : 'none';
  });
  q('datum').value = new Date().toISOString().slice(0, 10);
  const zeilen = [];
  const liste = card.querySelector('[data-liste]');
  [...st.policies].sort((a, b) => (a.created || 0) - (b.created || 0)).forEach(p => {
    const v = lookupVersicherer(p.gesellschaft || '');
    const row = doc.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:9px;padding:7px 11px;border-bottom:1px solid #F0F2F5;font-size:12.5px;cursor:pointer';
    const cb = doc.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!(v && p.gesellschaft);
    const info = doc.createElement('span');
    info.style.cssText = 'flex:1;min-width:0';
    info.innerHTML = '<b>' + String(kuendBez(p) || sparteOf(p).full).replace(/</g,'&lt;') + '</b> · ' + String(p.gesellschaft || '—').replace(/</g,'&lt;') +
      (p.vsnr ? ' <span style="font-family:ui-monospace,monospace;font-size:11px;color:#7a8294">' + String(p.vsnr).replace(/</g,'&lt;') + '</span>' : '') +
      '<br><span style="font-size:11px;color:' + (v ? '#1c7a4d' : '#8a6410') + '">' + (v ? '✓ ' + standTxt(v) : '⚠ Anschrift nicht gefunden') + '</span>' +
      (p.ablauf ? '<span style="font-size:11px;color:#7a8294"> · Termin ' + fmtDate(p.ablauf) + '</span>' : '');
    row.append(cb, info);
    liste.appendChild(row);
    zeilen.push({ p: p, v: v, cb: cb });
  });
  function basisD(){
    const ortWahl = q('ortwahl').value === '__custom' ? q('ortcustom').value.trim() : q('ortwahl').value;
    return {
      name: q('name').value.trim(), strasse: q('strasse').value.trim(), plzort: q('plzort').value.trim(),
      ort: ortWahl || 'Röthenbach', ortWahl: ortWahl || 'Röthenbach',
      datum: q('datum').value, hilfsweise: q('hilfsweise').checked, rueckwerbung: q('rueckwerbung').checked
    };
  }
  function gewaehlt(){ return zeilen.filter(z => z.cb.checked); }
  function warnung(txt){
    const w = card.querySelector('[data-warn]');
    w.textContent = txt;
    w.style.display = 'block';
  }
  function pruefe(){
    const b = basisD();
    if(!b.name){ warnung('Bitte den Absendernamen ausfüllen.'); return null; }
    const g = gewaehlt();
    if(!g.length){ warnung('Bitte mindestens einen Vertrag anhaken.'); return null; }
    return { b: b, g: g };
  }
  function dVon(z, b){
    return Object.assign({}, b, {
      bez: kuendBez(z.p), vsnr: z.p.vsnr || '', termin: z.p.ablauf || '',
      ges: z.v ? z.v.n : (z.p.gesellschaft || ''), adr: z.v ? (z.v.a || '') : '', fax: z.v ? (z.v.f || '') : ''
    });
  }
  function statusSetzen(g){
    if(!q('status').checked) return;
    const st2 = BVK.stateVon(kid);
    if(!st2) return;
    const b = basisD();
    st2.absender = { name: b.name, strasse: b.strasse, ort: b.plzort };
    st2.kOrtWahl = b.ortWahl;
    g.forEach(z => {
      const pp = st2.policies.find(x => x.id === z.p.id);
      if(pp) pp.status = 'kuendigung';
    });
    BVK.speichern(kid, st2);
  }
  function zu(){ ov.remove(); doc.removeEventListener('keydown', escH); }
  function escH(e){ if(e.key === 'Escape') zu(); }
  doc.addEventListener('keydown', escH);
  ov.addEventListener('click', e => { if(e.target === ov) zu(); });
  card.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', zu));
  card.querySelector('[data-druck]').addEventListener('click', () => {
    const ok = pruefe();
    if(!ok) return;
    statusSetzen(ok.g);
    const html = ok.g.map(z => briefHtml(dVon(z, ok.b))).join('');
    zu();
    if(typeof opts.onDone === 'function'){ try{ opts.onDone(ok.g.length); }catch(e){} }
    drucke(html);
  });
  card.querySelector('[data-zip]').addEventListener('click', async () => {
    const ok = pruefe();
    if(!ok) return;
    if(typeof global.JSZip === 'undefined'){ warnung('Export fehlgeschlagen — Internetverbindung für JSZip nötig.'); return; }
    const btn = card.querySelector('[data-zip]');
    btn.textContent = 'Erstelle …';
    btn.disabled = true;
    try{
      const z = new global.JSZip();
      let i = 1;
      for(const zeile of ok.g){
        const d = dVon(zeile, ok.b);
        const blob = await BVK.kuendigung.docxBlob(d);
        const g = (d.ges || 'Versicherer').replace(/[^\wäöüÄÖÜß\- ]/g,'').trim().replace(/\s+/g,'_');
        z.file('Kuendigung_' + (i++) + '_' + g + '.docx', blob);
      }
      const blob = await z.generateAsync({ type: 'blob' });
      const k = (st.kunde || 'Kunde').replace(/[^\wäöüÄÖÜß\- ]/g,'').trim().replace(/\s+/g,'_');
      downloadBlob(blob, 'Kuendigungen_' + k + '_' + new Date().toISOString().slice(0,10) + '.zip');
      statusSetzen(ok.g);
      zu();
      if(typeof opts.onDone === 'function'){ try{ opts.onDone(ok.g.length); }catch(e){} }
    }catch(e){
      btn.textContent = 'ZIP mit Word-Dateien';
      btn.disabled = false;
      warnung('Export fehlgeschlagen — Internetverbindung für JSZip nötig.');
    }
  });
  doc.body.appendChild(ov);
  ov.appendChild(card);
};

/* ---------- Willkommens-Popup (erster Besuch oder nach 14 Tagen Pause) ---------- */
function willkommenVielleicht(){
  if(!store) return;
  let ansicht = null, letzte = 0, gezeigt = 0;
  try{
    ansicht = store.getItem('bv_ansicht');
    letzte = parseInt(store.getItem('bv_letzte_nutzung') || '0', 10) || 0;
    gezeigt = parseInt(store.getItem('bv_willkommen_ts') || '0', 10) || 0;
  }catch(e){}
  const jetzt = Date.now();
  try{ store.setItem('bv_letzte_nutzung', String(jetzt)); }catch(e){}
  if(ansicht === 'uebersicht') return;
  if(gezeigt && (!letzte || jetzt - letzte <= 14 * 864e5)) return;
  const doc = global.document;
  const ov = doc.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,22,42,.55);z-index:998;display:flex;align-items:flex-start;justify-content:center;padding:7vh 14px;overflow:auto';
  const card = doc.createElement('div');
  card.style.cssText = 'background:#fff;color:#1a2333;border-radius:15px;box-shadow:0 24px 60px rgba(10,20,40,.4);width:min(560px,100%);padding:20px 22px;font:13.5px/1.5 -apple-system,\'Segoe UI\',Roboto,sans-serif;margin-bottom:6vh';
  function merken(){ try{ store.setItem('bv_willkommen_ts', String(Date.now())); }catch(e){} }
  function zu(){ merken(); ov.remove(); }
  const titel = gezeigt ? 'Willkommen zurück!' : 'Willkommen im Bestandsvergleich!';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:17px">' + titel + '</b><button data-x style="border:none;background:none;font-size:16px;color:#7a8294;cursor:pointer">✕</button></div>' +
    '<div style="font-size:13px;color:#5a6478;margin:4px 0 14px">Womit möchtest du arbeiten? Kunden und Verträge sind in jeder Ansicht dieselben — du kannst jederzeit wechseln.</div>' +
    '<div data-karten style="display:grid;grid-template-columns:1fr 1fr;gap:9px"></div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">' +
      '<a data-alle href="ansichten.html" style="font-size:12.5px;color:#274690;text-decoration:none;font-weight:600">Alle Ansichten mit Vorschau →</a>' +
      '<button data-x style="border:1px solid #D9DEE7;background:#fff;border-radius:9px;padding:7px 15px;font-size:12.5px;cursor:pointer;font-family:inherit;color:#5a6478">Später</button>' +
    '</div>';
  const wrap = card.querySelector('[data-karten]');
  BVK.ANSICHTEN.filter(a => a.id !== 'uebersicht').forEach(a => {
    const k = doc.createElement('button');
    k.style.cssText = 'text-align:left;border:1.5px solid ' + (a.beta ? '#E3E6EB' : '#274690') + ';background:#fff;border-radius:11px;padding:10px 12px;cursor:pointer;font-family:inherit;color:#1a2333';
    k.innerHTML =
      '<span style="display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600">' + a.name +
      (a.beta ? '<span style="font-size:9px;font-weight:700;background:#EEF0F4;color:#8a93a5;border-radius:99px;padding:1px 7px">BETA</span>'
              : '<span style="font-size:9px;font-weight:700;background:#E4EDFB;color:#274690;border-radius:99px;padding:1px 7px">EMPFOHLEN</span>') +
      '</span>' +
      '<span style="display:block;font-size:11px;color:#7a8294;margin-top:3px">' + (a.desc || '') + '</span>';
    k.addEventListener('click', () => {
      merken();
      try{ store.setItem('bv_ansicht', a.id); }catch(e){}
      if(a.id === ansicht){ ov.remove(); return; }
      global.location.href = a.url;
    });
    wrap.appendChild(k);
  });
  card.querySelector('[data-alle]').addEventListener('click', merken);
  card.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', zu));
  ov.addEventListener('click', e => { if(e.target === ov) zu(); });
  doc.body.appendChild(ov);
  ov.appendChild(card);
}

/* ---------- Version, Badge und Speicher-Warnung ---------- */
BVK.VERSION = '2.1';
function uiEinhaengen(){
  const doc = global.document;
  if(!doc || !doc.body) return;
  if(!doc.getElementById('bvkVer')){
    const a = doc.createElement('a');
    a.id = 'bvkVer';
    a.href = 'ansichten.html';
    a.textContent = 'BV v' + BVK.VERSION;
    a.title = 'Ansichten und Verwaltung öffnen';
    a.style.cssText = 'position:fixed;right:8px;bottom:6px;z-index:40;font:10px -apple-system,sans-serif;color:rgba(120,130,150,.75);text-decoration:none;background:rgba(255,255,255,.5);border-radius:5px;padding:1px 6px';
    const st = doc.createElement('style');
    st.textContent = '@media print{#bvkVer,#bvkWarn{display:none !important}}';
    doc.body.appendChild(st);
    doc.body.appendChild(a);
  }
  try{ willkommenVielleicht(); }catch(e){}
  if(!store && !doc.getElementById('bvkWarn')){
    const w = doc.createElement('div');
    w.id = 'bvkWarn';
    w.textContent = 'Achtung: Der Browser-Speicher ist nicht verfügbar (privater Modus?). Eingaben gehen beim Schließen verloren.';
    w.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:998;background:#B3372B;color:#fff;font:12.5px -apple-system,sans-serif;text-align:center;padding:7px 12px';
    doc.body.appendChild(w);
  }
}
if(global.document){
  if(global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', uiEinhaengen);
  else uiEinhaengen();
}

/* ---------- Automatische Ringpuffer-Sicherung (letzte 7 Tage) ---------- */
const K_SNAP = 'bv_snapshots_v1';
let snapTag = null;
function snapshotVielleicht(){
  if(!store) return;
  const heute = new Date().toISOString().slice(0, 10);
  if(snapTag === heute) return;
  snapTag = heute;
  try{
    const rohK = store.getItem(K_KUNDEN);
    if(!rohK || rohK.length > 900000) return;
    let ring = [];
    try{ ring = JSON.parse(store.getItem(K_SNAP) || '[]') || []; }catch(e){}
    if(ring.some(s => s.tag === heute)) return;
    const kunden = (JSON.parse(rohK) || {}).kunden || [];
    let ab = {};
    try{ ab = JSON.parse(store.getItem(K_AB) || '{}') || {}; }catch(e){}
    ring.push({ tag: heute, ts: Date.now(), n: kunden.length, kunden: kunden, adressbuch: ab });
    while(ring.length > 7) ring.shift();
    store.setItem(K_SNAP, JSON.stringify(ring));
  }catch(e){}
}
BVK.snapshots = function(){
  if(!store) return [];
  try{
    return (JSON.parse(store.getItem(K_SNAP) || '[]') || []).map((s, i) => ({ i: i, tag: s.tag, ts: s.ts, n: s.n }));
  }catch(e){ return []; }
};
BVK.snapshotWiederherstellen = function(i){
  if(!store) return false;
  try{
    const ring = JSON.parse(store.getItem(K_SNAP) || '[]') || [];
    const s = ring[i];
    if(!s || !Array.isArray(s.kunden) || !s.kunden.length) return false;
    const heute = new Date().toISOString().slice(0, 10);
    let aktuellK = [];
    try{ aktuellK = (JSON.parse(store.getItem(K_KUNDEN) || 'null') || {}).kunden || []; }catch(e){}
    let aktuellA = {};
    try{ aktuellA = JSON.parse(store.getItem(K_AB) || '{}') || {}; }catch(e){}
    ring.push({ tag: heute + ' · vor Wiederherstellung', ts: Date.now(), n: aktuellK.length, kunden: aktuellK, adressbuch: aktuellA });
    while(ring.length > 9) ring.shift();
    store.setItem(K_SNAP, JSON.stringify(ring));
    store.setItem(K_KUNDEN, JSON.stringify({ kunden: s.kunden }));
    store.setItem(K_AB, JSON.stringify(s.adressbuch || {}));
    mem = null;
    abCache = null;
    ladeAlles();
    sichere();
    return true;
  }catch(e){ return false; }
};

/* ---------- Gesamtsicherung einspielen ---------- */
function sigVonState(st){
  return (st.kunde || '').trim().toLowerCase() + '#' +
    st.policies.length + '#' +
    st.policies.map(p => (p.vsnr || '') + '|' + (p.gesellschaft || '') + '|' + (p.beitragF ?? '')).sort().join(';');
}
BVK.importGesamt = function(daten){
  let liste = null;
  if(daten && Array.isArray(daten.kunden)){
    liste = daten.kunden.map(k => ensureStateShape(k.state || k));
  } else if(daten && Array.isArray(daten.policies)){
    liste = [ ensureStateShape(daten) ];
  }
  if(!liste || !liste.length) return null;
  const d = ladeAlles();
  const vorhanden = new Set(d.kunden.map(k => sigVonState(k.state)));
  let neu = 0, uebersprungen = 0;
  liste.forEach(st => {
    const s = sigVonState(st);
    if(vorhanden.has(s)){ uebersprungen++; return; }
    vorhanden.add(s);
    d.kunden.push({ id: 'k' + Date.now() + Math.random().toString(36).slice(2,6), angelegt: Date.now(), geaendert: Date.now(), state: st });
    neu++;
  });
  if(daten && daten.adressbuch && typeof daten.adressbuch === 'object'){
    const ab = Object.assign({}, BVK.adressbuch());
    for(const k in daten.adressbuch){
      const e = daten.adressbuch[k];
      if(e && e.n && (!ab[k] || (e.ts || 0) >= (ab[k].ts || 0))) ab[k] = e;
    }
    if(store){ try{ store.setItem(K_AB, JSON.stringify(ab)); }catch(e){} }
    abCache = null;
  }
  sichere();
  return { neu: neu, uebersprungen: uebersprungen };
};

/* ---------- Verwaltung: Kunden-Dubletten bereinigen ---------- */
BVK.bereinigeDubletten = function(){
  const d = ladeAlles();
  const sig = k => sigVonState(k.state);
  const beste = {};
  d.kunden.forEach(k => {
    const s = sig(k);
    if(!beste[s] || (k.geaendert || 0) > (beste[s].geaendert || 0)) beste[s] = k;
  });
  const behalten = new Set(Object.values(beste).map(k => k.id));
  const vorher = d.kunden.length;
  d.kunden = d.kunden.filter(k => behalten.has(k.id));
  if(!d.kunden.length){
    d.kunden = [ { id: 'k' + Date.now(), angelegt: Date.now(), geaendert: Date.now(), state: leererState() } ];
  }
  if(!d.kunden.some(k => k.id === d.aktivId)) d.aktivId = d.kunden[0].id;
  sichere();
  return vorher - d.kunden.length;
};

global.BVK = BVK;
})(typeof window !== 'undefined' ? window : globalThis);
