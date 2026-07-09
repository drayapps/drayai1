/* ============ יומן מקומי + תזכורות ============ */
let events = (() => { try { return JSON.parse(store.get('dray_events', '[]')); } catch(e){ return []; } })();
function saveEvents(){
  events = events.filter(e => !e.done || e.ts > Date.now() - 86400000).slice(-100);
  store.set('dray_events', JSON.stringify(events));
}
function fmtEv(e){
  const base = new Date(e.ts).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' — ' + e.title;
  return base + (e.repeat === 'daily' ? ' 🔁 כל יום' : e.repeat === 'weekly' ? ' 🔁 כל שבוע' : '');
}
function listEvents(from, to){
  return events.filter(e => !e.done && e.ts >= from && e.ts < to).sort((a, b) => a.ts - b.ts);
}
/* מילות שעה בעברית — "בשעה שמונה", "בשמונה וחצי". ארוך לפני קצר בהמשך */
const HE_HOUR = {
  'אחת עשרה':11,'אחד עשרה':11,'שתים עשרה':12,'שתיים עשרה':12,
  'אחת':1,'אחד':1,'שתיים':2,'שתים':2,'שניים':2,'שלוש':3,'ארבע':4,'חמש':5,
  'שש':6,'שבע':7,'שמונה':8,'תשע':9,'עשר':10
};
const HE_HOUR_ALT = Object.keys(HE_HOUR).sort((a, b) => b.length - a.length).join('|');

/* הסרת כל אזכורי הזמן/היום ממשפט — כדי לחלץ את כותרת האירוע הנקייה */
function stripWhen(s){
  return s
    .replace(/(?:בעוד|אחרי)\s+\d+\s*(?:דקות|דקה|שעות|שעה|ימים|יום|שבועות|שבוע)/g, ' ')
    .replace(/(?:בעוד|אחרי)\s+(?:חצי שעה|שעתיים וחצי|שעתיים|שעה וחצי|שעה|דקה|יומיים|שבוע|יום)/g, ' ')
    .replace(/(?:בכל|כל|מדי)\s+(?:יום|בוקר|ערב|לילה|צהריים|שבוע)(?:\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת))?/g, ' ')
    .replace(/(?:^|\s)(?:יומי|שבועי)(?=\s|$)/g, ' ')
    .replace(/(?:מחרתיים|מחר|היום|הערב|הבוקר|הצהריים)/g, ' ')
    .replace(/ב?יום (?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/g, ' ')
    .replace(/(?:אחר[יי]? ?ה?צהריים|אחה"צ|בבוקר|בצהריים|בערב|בלילה)/g, ' ')
    .replace(new RegExp('(?:רבע|עשרים וחמש(?:ה)?|עשרים|חמש עשרה|עשרה|חמישה|חמש) ל(?:' + HE_HOUR_ALT + ')', 'g'), ' ')
    .replace(/(?:בשעה |ב-|ב ?)\d{1,2}(?:[:.,]\d{2})?/g, ' ')
    .replace(new RegExp('(?:בשעה |ב)(?:' + HE_HOUR_ALT + ')(?:[\\u0590-\\u05FF]| ורבע| וחצי)?', 'g'), ' ')
    .replace(/(?:^|\s)(?:וחצי|ורבע)(?=\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* הבנת "מתי" בעברית: יחסי (בעוד…), יום (היום/מחר/מחרתיים/ביום שלישי) ושעה (מספרית או מילולית) */
function parseWhen(t){
  const now = new Date();
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

  /* --- זמן יחסי: "בעוד 10 דקות" / "אחרי שעה" / "בעוד חצי שעה" / "בעוד יומיים" --- */
  const relN = t.match(/(?:בעוד|אחרי)\s+(\d+)\s*(דקות|דקה|שעות|שעה|ימים|יום|שבועות|שבוע)/);
  if (relN) {
    const n = +relN[1], u = relN[2];
    const ms = u.startsWith('דק') ? n * 60000 : u.startsWith('שע') ? n * 3600000
      : (u === 'יום' || u === 'ימים') ? n * 86400000 : n * 7 * 86400000;
    return Date.now() + ms;
  }
  if (/(?:בעוד|אחרי)\s+שעתיים\s+וחצי/.test(t)) return Date.now() + 9000000;
  if (/(?:בעוד|אחרי)\s+שעתיים/.test(t))      return Date.now() + 2 * 3600000;
  if (/(?:בעוד|אחרי)\s+שעה\s+וחצי/.test(t)) return Date.now() + 5400000;
  if (/(?:בעוד|אחרי)\s+חצי\s+שעה/.test(t))  return Date.now() + 1800000;
  if (/(?:בעוד|אחרי)\s+שעה/.test(t))         return Date.now() + 3600000;
  if (/(?:בעוד|אחרי)\s+דקה/.test(t))         return Date.now() + 60000;
  if (/בעוד\s+יומיים/.test(t))               return Date.now() + 2 * 86400000;
  if (/בעוד\s+שבוע/.test(t))                 return Date.now() + 7 * 86400000;

  /* --- יום --- */
  let d = null, hadDay = false;
  if (/מחרתיים/.test(t)) { d = new Date(now); d.setDate(d.getDate() + 2); hadDay = true; }
  else if (/מחר/.test(t)) { d = new Date(now); d.setDate(d.getDate() + 1); hadDay = true; }
  else if (/היום|הערב|הבוקר|הצהריים|הלילה/.test(t)) { d = new Date(now); hadDay = true; }
  else for (let i = 0; i < 7; i++) {
    if (new RegExp('ב?יום ' + days[i]).test(t)) {
      d = new Date(now);
      d.setDate(d.getDate() + ((i - now.getDay() + 7) % 7 || 7));
      hadDay = true; break;
    }
  }

  /* --- שעה: "רבע לשלוש" (דקות לפני) → מספרית (14:30 / ב-8 / ב 8) → מילולית (בשמונה וחצי) --- */
  let h = null, min = 0;
  const MIN_TO = { 'רבע':15,'חמש עשרה':15,'עשרה':10,'חמישה':5,'חמש':5,'עשרים':20,'עשרים וחמש':25,'עשרים וחמישה':25 };
  const toM = t.match(new RegExp('(רבע|עשרים וחמש(?:ה)?|עשרים|חמש עשרה|עשרה|חמישה|חמש) ל(' + HE_HOUR_ALT + ')(?![\\u0590-\\u05FF])'));
  if (toM) {
    min = 60 - (MIN_TO[toM[1]] || 15);
    h = (HE_HOUR[toM[2]] + 11) % 12 || 12;   /* השעה שלפני; שומר על מתכונת 12-שעות */
  }
  if (h === null) {
    const tm = t.match(/(?:בשעה |ב-|ב ?)(\d{1,2})(?:[:.,](\d{2}))?/);   /* "ב 8" עם רווח מהדיבור */
    if (tm) {
      h = +tm[1]; min = tm[2] ? +tm[2] : 0;
      if (!tm[2]) { if (/וחצי/.test(t)) min = 30; else if (/ורבע/.test(t)) min = 15; }   /* "ב-3 וחצי" */
    } else {
      const wm = t.match(new RegExp('(?:בשעה |ב)(' + HE_HOUR_ALT + ')(?![\\u0590-\\u05FF])'));
      if (wm) { h = HE_HOUR[wm[1]]; if (/וחצי/.test(t)) min = 30; else if (/ורבע/.test(t)) min = 15; }
    }
  }

  if (h === null && !d) return null;
  if (!d) d = new Date(now);

  if (h !== null) {
    /* חלק היום מכריע AM/PM. שעה נמוכה בלי חלק-יום מפורש = אחר הצהריים ("ב-4" = 16:00) */
    const morning = /בבוקר|הבוקר/.test(t);
    const evening = /בערב|הערב|בלילה|הלילה|אחר[יי]? ?ה?צהריים|אחה"צ/.test(t);
    if (evening && h < 12) h += 12;
    else if (morning && h === 12) h = 0;
    else if (!morning && !evening && h >= 1 && h <= 7) h += 12;
    d.setHours(h, min, 0, 0);
    if (d.getTime() <= Date.now()) {
      if (!hadDay) d.setDate(d.getDate() + 1);      /* בלי יום — מחר */
      else if (h < 12) d.setHours(h + 12, min, 0, 0); /* היום אבל הבוקר עבר — נסה ערב */
    }
  }
  else if (/הערב|בערב/.test(t)) d.setHours(20, 0, 0, 0);
  else if (/בלילה|הלילה/.test(t)) d.setHours(22, 0, 0, 0);
  else if (/בצהריים|הצהריים/.test(t)) d.setHours(12, 0, 0, 0);
  else d.setHours(9, 0, 0, 0);

  return d.getTime() > Date.now() ? d.getTime() : null;
}

/* זיהוי חזרתיות: "כל יום / כל בוקר" → יומי · "כל שבוע / כל יום שני / שבועי" → שבועי */
function detectRepeat(t){
  if (/כל\s+(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|כל\s+שבוע|מדי\s+שבוע|שבועי/.test(t)) return 'weekly';
  if (/כל\s+(?:יום|בוקר|ערב|לילה|צהריים)|בכל\s+יום|מדי\s+יום|יומי/.test(t)) return 'daily';
  return null;
}
/* המופע הבא של אירוע חוזר — מדלג קדימה עד שמעבר לעכשיו (שומר שעה מקומית גם ב-DST) */
function nextOccurrence(ev){
  const d = new Date(ev.ts);
  const step = ev.repeat === 'weekly' ? 7 : 1;
  do { d.setDate(d.getDate() + step); } while (d.getTime() <= Date.now());
  return d.getTime();
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
      fired = true;
      const m = 'תזכורת: ' + ev.title;
      addMsg('ai', m);
      lastAnswer.textContent = m;
      addAlert(2, m, '');
      announce(m);
      notifyOS('DRAY·AI — תזכורת', ev.title);
      speak(m);
      if (ev.repeat) ev.ts = nextOccurrence(ev); /* חוזר — נקבע למופע הבא */
      else ev.done = true;
    }
  });
  if (fired) saveEvents();
}, 60000);

/* תזכורות שהזמן שלהן עבר כשהאתר היה סגור — מדווחים ברגע שחוזרים */
function missedReminders(){
  const now = Date.now();
  const missed = events.filter(e => !e.done && e.ts <= now - 120000);
  if (!missed.length) return;
  const lines = missed.map(fmtEv);          /* לוכדים לפני גלגול הזמן של אירועים חוזרים */
  const titles = missed.map(e => e.title);
  missed.forEach(e => { if (e.repeat) e.ts = nextOccurrence(e); else e.done = true; });
  saveEvents();
  addMsg('sys', 'תזכורות שעברו בזמן שלא היית כאן:\n' + lines.join('\n'));
  notifyOS('DRAY·AI — תזכורות שפוספסו', titles.join(' · '));
}

/* בריפינג בוקר — פעם ביום, בכניסה הראשונה: ברכה + מה מחכה היום. ההוק שמחזיר כל יום. */
function morningBriefing(){
  const todayKey = new Date().toLocaleDateString('en-CA'); /* YYYY-MM-DD מקומי */
  if (store.get('dray_last_briefing') === todayKey) return; /* כבר בירכתי היום */
  store.set('dray_last_briefing', todayKey);
  const now = new Date();
  const h = now.getHours();
  const hi = h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב';
  const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const end = new Date(); end.setHours(23, 59, 59, 0);
  const today = listEvents(Date.now(), end.getTime());
  let text;
  if (today.length) {
    const items = today.map(e => new Date(e.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' ' + e.title).join(', ');
    text = hi + ' יקיר, השעה ' + timeStr + '. יש לך ' + today.length + (today.length === 1 ? ' דבר היום: ' : ' דברים היום: ') + items + '.';
  } else {
    text = hi + ' יקיר, השעה ' + timeStr + '. היומן שלך פנוי היום — יום נקי להתחיל בו כל מה שתרצה.';
  }
  addMsg('ai', text);
  lastAnswer.textContent = text;
  announce(text);
  speak(text); /* דיבור בכניסה עשוי להיחסם עד אינטראקציה ראשונה (מדיניות autoplay) — אז יושמע ברגע שתלחץ */
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

