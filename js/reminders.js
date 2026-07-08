/* ============ יומן מקומי + תזכורות ============ */
let events = (() => { try { return JSON.parse(store.get('dray_events', '[]')); } catch(e){ return []; } })();
function saveEvents(){
  events = events.filter(e => !e.done || e.ts > Date.now() - 86400000).slice(-100);
  store.set('dray_events', JSON.stringify(events));
}
function fmtEv(e){
  return new Date(e.ts).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' — ' + e.title;
}
function listEvents(from, to){
  return events.filter(e => !e.done && e.ts >= from && e.ts < to).sort((a, b) => a.ts - b.ts);
}
/* הבנת "מתי" בעברית: היום/מחר/מחרתיים/ביום שלישי + שעה */
function parseWhen(t){
  const now = new Date();
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  let d = null, hadDay = false;
  if (/מחרתיים/.test(t)) { d = new Date(now); d.setDate(d.getDate() + 2); hadDay = true; }
  else if (/מחר/.test(t)) { d = new Date(now); d.setDate(d.getDate() + 1); hadDay = true; }
  else if (/היום|הערב/.test(t)) { d = new Date(now); hadDay = true; }
  else for (let i = 0; i < 7; i++) {
    if (new RegExp('ב?יום ' + days[i]).test(t)) {
      d = new Date(now);
      d.setDate(d.getDate() + ((i - now.getDay() + 7) % 7 || 7));
      hadDay = true; break;
    }
  }
  /* גם 14:43 וגם 14.43 — מהדיבור מגיעות לפעמים נקודות */
  const tm = t.match(/(?:בשעה |ב-|ב)(\d{1,2})(?:[:.,](\d{2}))?/);
  if (!d && tm) d = new Date(now);
  if (!d) return null;
  if (tm) {
    const h = +tm[1];
    d.setHours(h, tm[2] ? +tm[2] : 0, 0, 0);
    if (d.getTime() <= Date.now() && h <= 11) d.setHours(h + 12); /* "ב-8" אחרי הצהריים = בערב */
    if (d.getTime() <= Date.now() && !hadDay) d.setDate(d.getDate() + 1);
  }
  else if (/הערב/.test(t)) d.setHours(20, 0, 0, 0);
  else d.setHours(9, 0, 0, 0);
  return d.getTime() > Date.now() ? d.getTime() : null;
}
/* התראת מערכת — קופצת גם כשהחלון ממוזער או בטאב אחר */
function notifyOS(title, body){
  try {
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification(title, { body });
  } catch(e){}
}
function askNotifyPermission(){
  try {
    if ('Notification' in window && Notification.permission === 'default')
      Notification.requestPermission();
  } catch(e){}
}

/* לולאת תזכורות — בודקת כל 20 שניות, מדברת כשמגיע הזמן */
setInterval(() => {
  const now = Date.now();
  let fired = false;
  events.forEach(ev => {
    if (!ev.done && ev.ts <= now + 30000 && ev.ts > now - 120000) {
      ev.done = true; fired = true;
      const m = 'תזכורת: ' + ev.title;
      addMsg('ai', m);
      lastAnswer.textContent = m;
      addAlert(2, m, '');
      announce(m);
      notifyOS('DRAY·AI — תזכורת', ev.title);
      speak(m);
    }
  });
  if (fired) saveEvents();
}, 20000);

/* תזכורות שהזמן שלהן עבר כשהאתר היה סגור — מדווחים ברגע שחוזרים */
function missedReminders(){
  const now = Date.now();
  const missed = events.filter(e => !e.done && e.ts <= now - 120000);
  if (!missed.length) return;
  missed.forEach(e => { e.done = true; });
  saveEvents();
  addMsg('sys', 'תזכורות שעברו בזמן שלא היית כאן:\n' + missed.map(fmtEv).join('\n'));
  notifyOS('DRAY·AI — תזכורות שפוספסו', missed.map(e => e.title).join(' · '));
}


/* ============ זיכרון ארוך טווח: ארכיון, עובדות ויומן-קובץ ============ */
let archive = (() => { try { return JSON.parse(store.get('dray_archive', '[]')); } catch(e){ return []; } })();
let facts = (() => { try { return JSON.parse(store.get('dray_facts', '[]')); } catch(e){ return []; } })();
function saveFacts(){ store.set('dray_facts', JSON.stringify(facts.slice(-50))); }
function appendArchive(role, content){
  archive.push({ r: role, c: content, t: Date.now() });
  if (archive.length > 1000) archive = archive.slice(-1000);
  store.set('dray_archive', JSON.stringify(archive));
  logToFile(role, content);
}
/* כתיבה שקטה ל-DRAY-LOG.md בתיקייה המחוברת — אם יש הרשאה */
let fileLogOk = null;
async function logToFile(role, content){
  try {
    if (!dirHandle || !('showDirectoryPicker' in window)) return;
    if (await dirHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') return;
    const fh = await dirHandle.getFileHandle('DRAY-LOG.md', { create: true });
    const file = await fh.getFile();
    const w = await fh.createWritable({ keepExistingData: true });
    const stamp = new Date().toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    const head = file.size === 0 ? '# יומן שיחות DRAY·AI\n\n' : '';
    await w.write({ type: 'write', position: file.size,
      data: head + '**' + (role === 'user' ? 'יקיר' : 'DRAY') + '** (' + stamp + '): ' + content + '\n\n' });
    await w.close();
    fileLogOk = true;
  } catch(e){
    if (fileLogOk !== false) { fileLogOk = false; addAlert(3, 'כתיבה ליומן הקובץ נכשלה', 'כתוב /תיקייה ואשר הרשאת כתיבה'); }
  }
}
/* תקציר נושאים משיחות קודמות — נכנס להקשר של המודל בכל בקשה */
function memoryRecap(){
  const qs = [];
  for (let i = archive.length - 1; i >= 0 && qs.length < 10; i--) {
    if (archive[i].r === 'user') {
      const s = archive[i].c.slice(0, 60);
      if (!qs.includes(s)) qs.push(s);
    }
  }
  return qs.reverse().join(' · ').slice(0, 600);
}
function exportLog(){
  const md = '# יומן שיחות DRAY·AI\n\n' + archive.map(m =>
    '**' + (m.r === 'user' ? 'יקיר' : 'DRAY') + '** (' + new Date(m.t).toLocaleString('he-IL') + '): ' + m.c).join('\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  a.download = 'DRAY-LOG.md';
  a.click();
  URL.revokeObjectURL(a.href);
}

