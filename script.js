/* ============ מצבי מערכת ============ */
const State = { IDLE:'standby', LISTEN:'listening', THINK:'processing', SPEAK:'speaking' };
let mode = State.IDLE;
let history = [];
let audioLevel = 0;
let aborter = null;

const coreLabel = document.getElementById('coreLabel');
const stTxt = document.getElementById('stTxt');
const lastAnswer = document.getElementById('lastAnswer');
const log = document.getElementById('log');
const micBtn = document.getElementById('micBtn');
const txt = document.getElementById('txt');
const sendBtn = document.getElementById('sendBtn');
const ttsChk = document.getElementById('ttsChk');
const convChk = document.getElementById('convChk');
const chips = document.getElementById('chips');

function setMode(m){
  mode = m;
  coreLabel.textContent = m;
  coreLabel.classList.toggle('active', m !== State.IDLE);
  stTxt.textContent = m === State.IDLE ? 'ONLINE' : m.toUpperCase();
}

/* ============ שעון ============ */
const clock = document.getElementById('clock');
function tick(){
  clock.textContent = new Date().toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });
}
tick();
setInterval(tick, 10_000);

/* ============ אחסון מקומי ============ */
const store = {
  get(k, d=''){ try { return localStorage.getItem(k) ?? d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
};
const KEY_NAME = 'dray_groq_key';
const HIST_NAME = 'dray_history';
const getKey = () => store.get(KEY_NAME);

/* שחזור העדפות */
ttsChk.checked = store.get('dray_tts', '1') === '1';
convChk.checked = store.get('dray_conv', '0') === '1';
ttsChk.onchange = () => store.set('dray_tts', ttsChk.checked ? '1' : '0');
convChk.onchange = () => store.set('dray_conv', convChk.checked ? '1' : '0');

/* ============ הגדרות ============ */
const settings = document.getElementById('settings');
const keyInput = document.getElementById('keyInput');
document.getElementById('gearBtn').onclick = () => { keyInput.value = getKey(); settings.classList.add('open'); };
document.getElementById('closeSet').onclick = () => settings.classList.remove('open');
document.getElementById('saveKey').onclick = () => {
  store.set(KEY_NAME, keyInput.value.trim());
  settings.classList.remove('open');
  if (getKey()) resolveAlertByMsg('חסר מפתח Groq — המוח מנותק');
  lastAnswer.textContent = 'המפתח נשמר. אני מוכן — דבר אליי.';
};
settings.addEventListener('click', e => { if (e.target === settings) settings.classList.remove('open'); });

/* ============ תמלול במובייל ============ */
const aside = document.getElementById('aside');
document.getElementById('chatBtn').onclick = () => aside.classList.toggle('open');

/* ============ ליבה אנימטיבית ============ */
const cv = document.getElementById('core');
const ctx = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
function sizeCanvas(){
  const s = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.45, 420);
  cv.style.width = cv.style.height = s + 'px';
  cv.width = cv.height = s * DPR;
}
sizeCanvas();
addEventListener('resize', sizeCanvas);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let t = 0;
const particles = Array.from({length: 46}, (_, i) => ({
  a: Math.random() * Math.PI * 2,
  r: 0.62 + Math.random() * 0.33,
  sp: (0.002 + Math.random() * 0.006) * (i % 2 ? 1 : -1),
  sz: 0.8 + Math.random() * 1.6
}));

function draw(){
  const W = cv.width, C = W / 2, R = W * 0.36;
  ctx.clearRect(0, 0, W, W);
  t += reduced ? 0.15 : 1;

  const energy = mode === State.SPEAK ? 0.6 + audioLevel
               : mode === State.LISTEN ? 0.45 + audioLevel
               : mode === State.THINK ? 0.5 + 0.25 * Math.sin(t * 0.09)
               : 0.22 + 0.06 * Math.sin(t * 0.025);
  const active = mode !== State.IDLE;

  const g = ctx.createRadialGradient(C, C, R * 0.1, C, C, R * 1.5);
  g.addColorStop(0, `rgba(79,216,255,${0.16 * energy + 0.05})`);
  g.addColorStop(1, 'rgba(79,216,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);

  const rings = [
    { r: R * 0.98, w: 1.2, seg: 3, gap: 0.5, sp: 0.004, op: 0.55 },
    { r: R * 0.84, w: 2.2, seg: 2, gap: 0.9, sp: -0.007, op: 0.8 },
    { r: R * 0.70, w: 1.0, seg: 6, gap: 0.25, sp: 0.011, op: 0.45 },
  ];
  rings.forEach(rg => {
    ctx.lineWidth = rg.w * DPR;
    ctx.strokeStyle = `rgba(79,216,255,${rg.op * (0.5 + energy * 0.6)})`;
    const off = t * rg.sp;
    const arc = (Math.PI * 2) / rg.seg;
    for (let i = 0; i < rg.seg; i++) {
      ctx.beginPath();
      ctx.arc(C, C, rg.r, off + i * arc, off + i * arc + arc * (1 - rg.gap * 0.4));
      ctx.stroke();
    }
  });

  ctx.strokeStyle = `rgba(79,216,255,${0.25 + energy * 0.3})`;
  ctx.lineWidth = 1 * DPR;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + t * 0.0012;
    const long = i % 5 === 0;
    const r1 = R * 1.08, r2 = r1 + (long ? 7 : 3) * DPR;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
    ctx.lineTo(C + Math.cos(a) * r2, C + Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(191,238,255,${0.5 + energy * 0.4})`;
  particles.forEach(p => {
    p.a += p.sp * (active ? 1.8 : 1);
    const x = C + Math.cos(p.a) * R * p.r;
    const y = C + Math.sin(p.a) * R * p.r;
    ctx.beginPath();
    ctx.arc(x, y, p.sz * DPR * (0.7 + energy * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });

  const coreR = R * 0.5 * (1 + (mode === State.SPEAK ? audioLevel * 0.25 : 0));
  const cg = ctx.createRadialGradient(C, C, 0, C, C, coreR);
  cg.addColorStop(0, `rgba(191,238,255,${0.85 * energy + 0.1})`);
  cg.addColorStop(0.55, `rgba(79,216,255,${0.4 * energy})`);
  cg.addColorStop(1, 'rgba(79,216,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(C, C, coreR, 0, Math.PI * 2);
  ctx.fill();

  if (mode === State.SPEAK || mode === State.LISTEN) {
    ctx.strokeStyle = 'rgba(191,238,255,.7)';
    ctx.lineWidth = 1.6 * DPR;
    ctx.beginPath();
    const wR = R * 0.42, N = 90;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const wob = Math.sin(a * 7 + t * 0.25) * audioLevel * 14 * DPR
                + Math.sin(a * 3 - t * 0.18) * audioLevel * 8 * DPR;
      const x = C + Math.cos(a) * (wR + wob);
      const y = C + Math.sin(a) * (wR + wob);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  audioLevel *= 0.92;
  requestAnimationFrame(draw);
}
draw();

/* לחיצה על הליבה עוצרת דיבור/חשיבה */
cv.onclick = () => cancelAll();

/* ============ יומן ============ */
function addMsg(role, text){
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
function addTyping(){
  const d = document.createElement('div');
  d.className = 'msg ai typing';
  d.innerHTML = '<i></i><i></i><i></i>';
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
function saveHistory(){
  store.set(HIST_NAME, JSON.stringify(history.slice(-40)));
}
function restoreHistory(){
  try {
    history = JSON.parse(store.get(HIST_NAME, '[]'));
  } catch(e){ history = []; }
  if (!Array.isArray(history)) history = [];
  history.forEach(m => addMsg(m.role === 'user' ? 'user' : 'ai', m.content));
  const lastAi = [...history].reverse().find(m => m.role === 'assistant');
  if (lastAi) lastAnswer.textContent = lastAi.content;
  chips.classList.toggle('hidden', history.length > 0);
}
document.getElementById('clearBtn').onclick = () => {
  history = []; log.innerHTML = '';
  store.set(HIST_NAME, '[]');
  chips.classList.remove('hidden');
  lastAnswer.textContent = 'השיחה נוקתה. הארכיון והעובדות נשמרו — שאל "מה אתה זוכר".';
};

/* ============ שכבת Jarvis: טלמטריה, התראות ופקודות מקומיות ============ */
const sys = { startedAt: Date.now(), requests: 0, errors: 0, tokens: 0, lastLatency: null, alerts: [], seq: 1 };
const bellBtn = document.getElementById('bellBtn');
const alertBadge = document.getElementById('alertBadge');
const alertsPanel = document.getElementById('alertsPanel');
const alertsList = document.getElementById('alertsList');
const P_LABEL = ['P0', 'P1', 'P2', 'P3'];

/* P0 מוצג מיד ופותח את הפאנל, P1 מדווח בתמלול, P2 רק מונה בפעמון, P3 שקט */
function addAlert(p, msg, fix){
  if (sys.alerts.some(a => !a.resolved && a.msg === msg)) return;
  sys.alerts.push({ id: sys.seq++, p, msg, fix: fix || '', resolved: false });
  renderAlerts();
  if (p <= 1) addMsg('err', (p === 0 ? '‼ ' : '⚠ ') + msg + (fix ? ' — ' + fix : ''));
  if (p === 0) alertsPanel.classList.add('open');
}
function resolveAlert(id){
  const a = sys.alerts.find(x => x.id === id);
  if (a) { a.resolved = true; renderAlerts(); }
}
function resolveAlertByMsg(msg){
  sys.alerts.forEach(a => { if (a.msg === msg) a.resolved = true; });
  renderAlerts();
}
function openAlerts(){ return sys.alerts.filter(a => !a.resolved); }

function renderAlerts(){
  const open = openAlerts();
  const badge = open.filter(a => a.p <= 2).length;
  alertBadge.textContent = badge;
  alertBadge.classList.toggle('hidden', badge === 0);
  stTxt.classList.toggle('alert', open.some(a => a.p <= 1));
  alertsList.innerHTML = '';
  if (!open.length) {
    const d = document.createElement('div');
    d.className = 'al-empty';
    d.textContent = 'אין התראות פתוחות — הכול תקין.';
    alertsList.appendChild(d);
    return;
  }
  open.sort((a, b) => a.p - b.p).forEach(a => {
    const row = document.createElement('div');
    row.className = 'al-row';
    const pr = document.createElement('span');
    pr.className = 'al-p p' + a.p;
    pr.textContent = P_LABEL[a.p];
    const body = document.createElement('div');
    body.className = 'al-body';
    body.textContent = a.msg;
    if (a.fix) {
      const fx = document.createElement('div');
      fx.className = 'al-fix';
      fx.textContent = a.fix;
      body.appendChild(fx);
    }
    const res = document.createElement('button');
    res.className = 'al-res';
    res.title = 'סמן כטופל';
    res.textContent = '✓';
    res.onclick = () => resolveAlert(a.id);
    row.append(pr, body, res);
    alertsList.appendChild(row);
  });
}
bellBtn.onclick = e => { e.stopPropagation(); alertsPanel.classList.toggle('open'); };
document.addEventListener('click', e => {
  if (alertsPanel.classList.contains('open') && !alertsPanel.contains(e.target) && !bellBtn.contains(e.target)) {
    alertsPanel.classList.remove('open');
  }
});

function fmtUptime(){
  const m = Math.floor((Date.now() - sys.startedAt) / 60000);
  if (m < 1) return 'פחות מדקה';
  if (m < 60) return m + ' דקות';
  return Math.floor(m / 60) + ' שעות ו-' + (m % 60) + ' דקות';
}
function statusBrief(){
  const open = openAlerts();
  return 'סטטוס DRAY·AI\n'
    + 'מוח: ' + (!getKey() ? 'חסר מפתח' : !navigator.onLine ? 'אין רשת' : 'מחובר (Groq)')
      + (sys.lastLatency ? ' · תגובה ' + sys.lastLatency + 'ms' : '') + '\n'
    + 'מיקרופון: ' + (voiceMode === 'whisper' ? 'הקלטה + Whisper' : SR ? 'זמין' : 'לא נתמך') + ' · קול עברי: '
      + (heVoice && heVoice.lang.startsWith('he') ? 'כן' : 'לא') + '\n'
    + 'יומן: ' + listEvents(Date.now(), Infinity).length + ' אירועים קרובים\n'
    + 'זיכרון: ' + archive.length + ' הודעות בארכיון · ' + facts.length + ' עובדות · יומן קובץ '
      + (fileLogOk === true ? 'פעיל' : 'כבוי') + '\n'
    + 'סשן: ' + sys.requests + ' בקשות · ~' + sys.tokens + ' טוקנים · ' + sys.errors + ' שגיאות\n'
    + 'זמן פעילות: ' + fmtUptime() + ' · התראות פתוחות: ' + (open.length || 'אין');
}
function healthDetail(){
  const voices = HAS_TTS ? speechSynthesis.getVoices().length : 0;
  const open = openAlerts();
  return 'בדיקת מערכת מלאה\n'
    + 'רשת: ' + (navigator.onLine ? 'מחוברת' : 'מנותקת') + '\n'
    + 'מפתח Groq: ' + (getKey() ? 'קיים' : 'חסר') + '\n'
    + 'מוח (Groq): ' + (sys.lastLatency ? 'תגובה אחרונה ' + sys.lastLatency + 'ms' : 'טרם נבדק בסשן הזה') + '\n'
    + 'זיהוי דיבור: ' + (voiceMode === 'whisper' ? 'הקלטה + תמלול Whisper (ענן)' : SR ? 'מובנה בדפדפן' : 'לא נתמך (נסה Chrome)') + '\n'
    + 'קולות מערכת: ' + voices + (heVoice ? ' · נבחר: ' + heVoice.name : ' · לא נמצא קול') + '\n'
    + 'זיכרון שיחה: ' + history.length + ' הודעות שמורות\n'
    + 'התראות פתוחות: ' + (open.length ? open.map(a => P_LABEL[a.p]).join(', ') : 'אין');
}
function alertsToText(){
  const open = openAlerts();
  if (!open.length) return 'אין התראות פתוחות — הכול תקין.';
  return 'התראות פתוחות:\n' + open.sort((a, b) => a.p - b.p)
    .map(a => '[' + P_LABEL[a.p] + '] ' + a.msg + (a.fix ? ' — ' + a.fix : '')).join('\n');
}
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
  const tm = t.match(/(?:בשעה |ב-|ב)(\d{1,2})(?::(\d{2}))?/);
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
      speak(m);
    }
  });
  if (fired) saveEvents();
}, 20000);

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

/* ============ גישה לתיקיית קבצים (File System Access) ============ */
let dirHandle = null;
function fsDb(){
  return new Promise((res, rej) => {
    const r = indexedDB.open('dray-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveDirHandle(h){
  try { const db = await fsDb(); db.transaction('h', 'readwrite').objectStore('h').put(h, 'dir'); } catch(e){}
}
async function loadDirHandle(){
  try {
    const db = await fsDb();
    return await new Promise(res => {
      const rq = db.transaction('h').objectStore('h').get('dir');
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  } catch(e){ return null; }
}
async function getDir(){
  if (!('showDirectoryPicker' in window)) return { err: 'הדפדפן לא תומך בגישה לתיקיות — נסה Chrome או Edge.' };
  if (!dirHandle) dirHandle = await loadDirHandle();
  if (!dirHandle) return { err: 'עוד לא חיברת תיקייה — כתוב /תיקייה כדי לבחור אחת.' };
  let p = await dirHandle.queryPermission({ mode: 'readwrite' });
  if (p !== 'granted') p = await dirHandle.requestPermission({ mode: 'readwrite' });
  if (p !== 'granted') return { err: 'אין הרשאה לתיקייה — כתוב /תיקייה ואשר שוב.' };
  return { dir: dirHandle };
}
async function listDirNames(dir){
  const names = [];
  for await (const e of dir.values()) names.push((e.kind === 'directory' ? '📁 ' : '📄 ') + e.name);
  return names.sort();
}

const HELP_TEXT = 'פקודות מקומיות (עובדות מיד, בלי מודל):\n'
  + '/סטטוס · /בריאות · /התראות — מצב המערכת\n'
  + '/יומן — האירועים שלך · "קבע מחר ב-14:00 רופא" · "תזכיר לי בעוד 10 דקות להוציא כביסה"\n'
  + '"מה יש לי היום / מחר / השבוע" — הלוז שלך\n'
  + '"תזכור ש..." — זיכרון לתמיד · "מה אתה זוכר" · /ייצוא — הורדת כל השיחות לקובץ\n'
  + '/תיקייה — חיבור תיקייה (+יומן שיחות אוטומטי) · /קבצים · /קרא <שם קובץ> — סיכום\n'
  + '"פתח יוטיוב / גוגל / וואטסאפ" — פתיחת אתרים\n'
  + '/מטבע · /קובייה — כשצריך להחליט\n'
  + 'וגם: "מה השעה", "מה התאריך", ו... נסה לשאול מי המלך 👑';

/* שאלות שהמידע להן כבר נמצא כאן — נענות מקומית, בלי רשת ובלי מודל */
async function localAnswer(raw){
  const t = raw.trim().replace(/[?!.؟]+$/, '').trim();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  /* --- הנאמנות למלך --- */
  if (/מי (יצר|בנה|תכנת|פיתח|המציא) אות(ך|כה)|מי היוצר שלך|who (made|created|built) you/i.test(t))
    return { text: 'נבניתי על ידי Yakir Dray — יקיר דריי. כל שורת קוד בי נושאת את החתימה שלו.' };
  if (/מי המלך( שלך)?$|מי הבוס( שלך)?$|מי האדון שלך|מי המפקד( שלך)?$|למי אתה (שייך|משרת)|who('?s| is) your (king|boss)/i.test(t))
    return { text: 'יש רק מלך אחד — Yakir Dray. אני כאן לשירותו בלבד. 👑', say: 'יש רק מלך אחד — יקיר דריי. אני כאן לשירותו.' };

  /* --- מערכת --- */
  if (/^\/?(סטטוס( מערכת)?|status)$/i.test(t)) {
    const issues = openAlerts().filter(a => a.p <= 1).length;
    return { text: statusBrief(), sys: true, say: issues ? 'יש ' + issues + ' התראות שדורשות טיפול.' : 'כל המערכות תקינות.' };
  }
  if (/^\/?(בריאות|בדיקה|health)$/i.test(t)) return { text: healthDetail(), sys: true };
  if (/^\/?(התראות|alerts)$/i.test(t)) { alertsPanel.classList.add('open'); return { text: alertsToText(), sys: true }; }
  if (/^\/?(עזרה|help)$/i.test(t)) return { text: HELP_TEXT, sys: true };

  /* --- זיכרון ארוך טווח --- */
  const rm = t.match(/^תזכור ש(.+)$/);
  if (rm) {
    facts.push(rm[1].trim());
    saveFacts();
    return { text: 'נרשם בזיכרון לתמיד: ' + rm[1].trim(), say: 'נרשם. לא אשכח.' };
  }
  const fm = t.match(/^\/?זיכרון מחק (\d+)$/);
  if (fm) {
    const f = facts[+fm[1] - 1];
    if (!f) return { text: 'אין עובדה מספר ' + fm[1] + '.', sys: true };
    facts.splice(+fm[1] - 1, 1);
    saveFacts();
    return { text: 'נשכח: ' + f, sys: true };
  }
  if (/^\/?זיכרון נקה$/.test(t)) {
    facts = []; archive = [];
    saveFacts();
    store.set('dray_archive', '[]');
    return { text: 'הזיכרון ארוך הטווח נמחק כולו — עובדות וארכיון.', sys: true };
  }
  if (/^(מה אתה זוכר( עליי| עלי)?|\/?זיכרון)$/.test(t)) {
    return { text: 'זיכרון ארוך טווח\n'
      + 'ארכיון: ' + archive.length + ' הודעות מכל הזמנים (נשמר גם אחרי "נקה")\n'
      + 'יומן קובץ: ' + (fileLogOk === true ? 'פעיל — DRAY-LOG.md בתיקייה המחוברת'
        : dirHandle ? 'ממתין להרשאת כתיבה — כתוב /תיקייה' : 'לא מחובר — כתוב /תיקייה, או /ייצוא להורדה') + '\n'
      + (facts.length
        ? 'עובדות ששמרת:\n' + facts.map((f, i) => (i + 1) + '. ' + f).join('\n') + '\nלמחיקה: /זיכרון מחק 1'
        : 'אין עובדות שמורות עדיין. אמור "תזכור ש..." ואשמור לתמיד.'), sys: true };
  }
  if (/^\/?(ייצוא|יצוא|export)$/i.test(t)) {
    if (!archive.length) return { text: 'אין עדיין שיחות לייצוא.', sys: true };
    exportLog();
    return { text: 'מוריד את DRAY-LOG.md — כל ' + archive.length + ' ההודעות מהארכיון.', sys: true };
  }

  /* --- יומן --- */
  const dm = t.match(/^\/?(?:יומן|לוז) מחק (\d+)$/);
  if (dm) {
    const up = listEvents(Date.now(), Infinity);
    const ev = up[+dm[1] - 1];
    if (!ev) return { text: 'אין אירוע מספר ' + dm[1] + ' ביומן.', sys: true };
    events = events.filter(e => e !== ev);
    saveEvents();
    return { text: 'נמחק: ' + fmtEv(ev), sys: true };
  }
  if (/^\/?(יומן|לוז)$/.test(t)) {
    const up = listEvents(Date.now(), Infinity);
    return { text: up.length
      ? 'היומן שלך:\n' + up.map((e, i) => (i + 1) + '. ' + fmtEv(e)).join('\n') + '\nלמחיקה: /יומן מחק 1'
      : 'היומן ריק. נסה: "קבע מחר ב-14:00 רופא שיניים".', sys: true };
  }
  const q = t.match(/^מה (?:יש לי|הלוז|בלוז|מתוכנן)( היום| מחר| השבוע)?$/);
  if (q) {
    const scope = (q[1] || ' היום').trim();
    let from = Date.now(), to;
    if (scope === 'מחר') { const s = new Date(); s.setDate(s.getDate() + 1); s.setHours(0, 0, 0, 0); from = s.getTime(); to = from + 86400000; }
    else if (scope === 'השבוע') to = Date.now() + 7 * 86400000;
    else { const e = new Date(); e.setHours(23, 59, 59, 0); to = e.getTime(); }
    const up = listEvents(from, to);
    return { text: up.length ? 'הנה מה שמחכה לך ' + scope + ':\n' + up.map(fmtEv).join('\n') : 'אין כלום ביומן ' + scope + '. חופשי!' };
  }
  if (/^(קבע|תזכיר לי|תזכורת|טיימר)/.test(t) || /בעוד \d+ (דקות|דקה|שעות|שעה)/.test(t)) {
    const rel = t.match(/בעוד (\d+) (דקות|דקה|שעות|שעה)/);
    const ts = rel ? Date.now() + (+rel[1]) * (rel[2].startsWith('שע') ? 3600000 : 60000) : parseWhen(t);
    if (!ts) return { text: 'לא הבנתי מתי. נסה: "קבע מחר ב-14:00 רופא שיניים" או "תזכיר לי בעוד 10 דקות".', sys: true };
    const title = t
      .replace(/^(קבע|תזכיר לי|תזכורת|טיימר)\s*/, '')
      .replace(/בעוד \d+ (דקות|דקה|שעות|שעה)\s*/, '')
      .replace(/(מחרתיים|מחר|היום|הערב)\s*/, '')
      .replace(/ב?יום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s*/, '')
      .replace(/(?:בשעה |ב-|ב)\d{1,2}(?::\d{2})?\s*/, '')
      .trim() || 'תזכורת';
    events.push({ id: Date.now(), ts, title, done: false });
    saveEvents();
    return { text: 'נקבע: ' + fmtEv(events[events.length - 1]) + '. אזכיר לך בזמן.', say: 'נקבע. אזכיר לך בזמן.' };
  }

  /* --- קבצים --- */
  if (/^\/?(תיקייה|פתח תיקייה|חבר תיקייה)$/.test(t)) {
    if (!('showDirectoryPicker' in window)) return { text: 'הדפדפן לא תומך בגישה לתיקיות — נסה Chrome או Edge.', sys: true };
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveDirHandle(dirHandle);
      fileLogOk = null; /* ננסה לכתוב יומן מחדש עם ההרשאה החדשה */
      const names = await listDirNames(dirHandle);
      return { text: 'התיקייה "' + dirHandle.name + '" חוברה — ' + names.length + ' פריטים:\n' + names.slice(0, 30).join('\n')
        + (names.length > 30 ? '\n…ועוד ' + (names.length - 30) : '')
        + '\nמעכשיו כל שיחה תירשם אוטומטית ל-DRAY-LOG.md בתיקייה הזאת.',
        sys: true, say: 'התיקייה חוברה. אני רואה ' + names.length + ' פריטים, ואתחיל לרשום את השיחות שלנו.' };
    } catch(e){ return { text: 'בחירת התיקייה בוטלה.', sys: true }; }
  }
  if (/^\/?(קבצים|מה יש בתיקייה)$/.test(t)) {
    const r = await getDir();
    if (r.err) return { text: r.err, sys: true };
    const names = await listDirNames(r.dir);
    return { text: names.length ? 'בתיקייה "' + r.dir.name + '":\n' + names.slice(0, 40).join('\n') : 'התיקייה ריקה.', sys: true };
  }
  const rd = t.match(/^\/?קרא (?:את )?(.+)$/);
  if (rd) {
    const r = await getDir();
    if (r.err) return { text: r.err, sys: true };
    const want = rd[1].trim().toLowerCase();
    let file = null;
    for await (const e of r.dir.values()) {
      if (e.kind === 'file' && (e.name.toLowerCase() === want || e.name.toLowerCase().startsWith(want))) { file = e; break; }
    }
    if (!file) return { text: 'לא מצאתי קובץ בשם "' + rd[1] + '". כתוב /קבצים לרשימה.', sys: true };
    if (!/\.(txt|md|json|csv|log|html|js|css|py|xml)$/i.test(file.name))
      return { text: 'אני קורא רק קבצי טקסט (txt, md, json, csv וכו\') — "' + file.name + '" לא נתמך.', sys: true };
    const f = await file.getFile();
    const content = (await f.text()).slice(0, 4000);
    return { text: 'קראתי את "' + file.name + '" — מעביר למוח לסיכום…', sys: true,
      chain: { prompt: 'סכם לי בקצרה את הקובץ "' + file.name + '"', ctx: content } };
  }

  /* --- פתיחת אתרים --- */
  const op = t.match(/^פתח (?:לי )?(?:את )?(.+)$/);
  if (op) {
    const sites = { 'יוטיוב': ['YouTube', 'https://youtube.com'], 'גוגל': ['Google', 'https://google.com'],
      "ג'ימייל": ['Gmail', 'https://mail.google.com'], 'מייל': ['Gmail', 'https://mail.google.com'],
      'וואטסאפ': ['WhatsApp', 'https://web.whatsapp.com'], 'מפות': ['מפות Google', 'https://maps.google.com'],
      'ספוטיפיי': ['Spotify', 'https://open.spotify.com'] };
    const target = op[1].trim();
    for (const k in sites) if (target.includes(k)) { window.open(sites[k][1], '_blank'); return { text: 'פותח את ' + sites[k][0] + '.', say: 'פותח ' + sites[k][0] }; }
    const dom = target.match(/^([\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)$/i);
    if (dom) { window.open('https://' + dom[1], '_blank'); return { text: 'פותח את ' + dom[1] + '.' }; }
  }

  /* --- כיף --- */
  if (/^\/?(מטבע|הטל מטבע)$/.test(t)) return { text: 'הטלתי מטבע… יצא ' + (Math.random() < 0.5 ? 'עץ' : 'פלי') + '.' };
  if (/^\/?(קובייה|זרוק קובייה)$/.test(t)) return { text: 'הקובייה התגלגלה… ' + (1 + Math.floor(Math.random() * 6)) + '!' };

  /* --- שעה ותאריך --- */
  const askTime = /(^|\s)(מה השעה|השעה עכשיו)($|\s)/.test(t);
  const askDate = /(^|\s)(מה התאריך|איזה תאריך|איזה יום היום)($|\s)/.test(t);
  if (askTime && askDate) return { text: 'השעה ' + timeStr + ', ' + dateStr + '.' };
  if (askTime && t.length <= 14) return { text: 'השעה עכשיו ' + timeStr + '.' };
  if (askDate && t.length <= 16) return { text: 'היום ' + dateStr + '.' };
  return null;
}

function bootChecks(){
  if (!getKey()) addAlert(0, 'חסר מפתח Groq — המוח מנותק', 'פתח הגדרות ⚙ והדבק מפתח');
  if (!SR) addAlert(2, 'זיהוי דיבור לא נתמך בדפדפן הזה', 'נסה Chrome לשליטה קולית');
  if (!navigator.onLine) addAlert(1, 'אין חיבור לאינטרנט', 'בדוק את הרשת');
}
addEventListener('offline', () => addAlert(1, 'אין חיבור לאינטרנט', 'בדוק את הרשת'));
addEventListener('online', () => resolveAlertByMsg('אין חיבור לאינטרנט'));

/* ============ צ'יפים ============ */
chips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip) ask(chip.textContent);
});

/* ============ דיבור → טקסט ============ */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
let recRestarts = 0, recWindowStart = 0, lastRecError = '', micGranted = false;
if (SR) {
  rec = new SR();
  rec.lang = 'he-IL';
  rec.interimResults = true;
  rec.continuous = true; /* בלי זה Chrome עוצר אחרי שקט קצר */
  rec.onresult = e => {
    audioLevel = Math.min(0.6, audioLevel + 0.15);
    const res = e.results[e.results.length - 1];
    if (res.isFinal) {
      const said = res[0].transcript.trim();
      stopListen();
      if (said) ask(said);
      return;
    }
    /* תמלול חי — מציגים את המילים עוד לפני שהמשפט הסתיים */
    let interim = '';
    for (let i = 0; i < e.results.length; i++)
      if (!e.results[i].isFinal) interim += e.results[i][0].transcript;
    if (interim.trim()) showInterim(interim.trim());
  };
  /* Chrome מסיים את הזיהוי מעצמו אחרי שקט — כל עוד המשתמש לא כיבה, מפעילים מחדש.
     אם הוא נכבה שוב ושוב תוך שניות — נעצרים ומדווחים מה השגיאה האמיתית. */
  rec.onend = () => {
    if (!listening) return;
    const now = Date.now();
    if (now - recWindowStart > 5000) { recWindowStart = now; recRestarts = 0; }
    if (++recRestarts > 4) {
      stopListen();
      addAlert(1, 'זיהוי הדיבור נכבה שוב ושוב' + (lastRecError ? ' (' + lastRecError + ')' : ''),
        'נדרשים: הרשאת מיקרופון, חיבור אינטרנט, ופתיחה דרך localhost או https');
      return;
    }
    setTimeout(() => { if (listening) { try { rec.start(); } catch(e){} } }, 150);
  };
  rec.onerror = ev => {
    lastRecError = ev.error;
    if (ev.error === 'no-speech' || ev.error === 'aborted') return; /* לא באמת שגיאה — onend ימשיך להקשיב */
    stopListen();
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed')
      addAlert(1, 'אין הרשאת מיקרופון (' + ev.error + ')', 'לחץ על סמל המנעול ליד הכתובת ואשר מיקרופון');
    else if (ev.error === 'network') {
      /* שירות הזיהוי של Google לא זמין — עוברים אוטומטית להקלטה + תמלול Whisper */
      addAlert(3, 'זיהוי הדיבור של הדפדפן לא זמין (network)', 'הופעל מצב הקלטה + Whisper במקום');
      switchToWhisper(true);
      startWhisper();
    }
    else if (ev.error === 'audio-capture')
      addAlert(1, 'לא נמצא מיקרופון', 'בדוק שהמיקרופון מחובר ופעיל');
    else
      addAlert(1, 'זיהוי הדיבור נכשל (' + ev.error + ')', 'נסה שוב או בדוק הרשאות');
  };
} else {
  micBtn.style.opacity = .35;
  micBtn.title = 'זיהוי דיבור לא נתמך בדפדפן זה (נסה Chrome)';
}

/* תצוגת ביניים — מה שנקלט מהמיקרופון או סטטוס הקלטה */
function showInterim(text){
  lastAnswer.classList.add('interim');
  lastAnswer.textContent = text;
}
function clearInterim(){
  lastAnswer.classList.remove('interim');
}

async function startListen(){
  if (!rec || mode === State.THINK) return;
  if (HAS_TTS) speechSynthesis.cancel();

  /* בקשת הרשאה מפורשת פעם אחת — בלעדיה Chrome לפעמים מכבה את הזיהוי מיד בשקט */
  if (!micGranted && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(tr => tr.stop());
      micGranted = true;
      resolveAlertByMsg('אין הרשאת מיקרופון (not-allowed)');
    } catch(e) {
      addAlert(1, 'אין הרשאת מיקרופון (' + (e.name || 'נדחתה') + ')',
        'לחץ על סמל המנעול ליד הכתובת ואשר מיקרופון. אם פתחת כקובץ (file://), הפעל דרך localhost');
      return;
    }
  }

  listening = true;
  recRestarts = 0;
  recWindowStart = Date.now();
  lastRecError = '';
  micBtn.classList.add('rec');
  setMode(State.LISTEN);
  showInterim('מקשיב…');
  try { rec.start(); }
  catch(e){
    /* start בזמן שסשן קודם עוד נסגר זורק InvalidStateError — מאתחלים ומנסים שוב */
    try { rec.stop(); } catch(e2){}
    setTimeout(() => { if (listening) { try { rec.start(); } catch(e3){} } }, 150);
  }
}
function stopListen(){
  listening = false;
  clearInterim();
  micBtn.classList.remove('rec');
  if (mode === State.LISTEN) setMode(State.IDLE);
  try { rec && rec.stop(); } catch(e){}
}
/* ============ מצב הקלטה + Whisper (כשזיהוי הדפדפן לא זמין) ============ */
let voiceMode = store.get('dray_voice_mode', 'native');
let mediaRec = null, recChunks = [], stopMeter = null, whisperTimer = null, discardRec = false;
let recTick = null, recStart = 0;

function switchToWhisper(announce){
  voiceMode = 'whisper';
  store.set('dray_voice_mode', 'whisper');
  micBtn.title = 'לחץ להקלטה, לחץ שוב לסיום';
  if (announce) {
    addMsg('sys', 'זיהוי הדיבור של הדפדפן לא זמין אצלך — עברתי למצב הקלטה עם תמלול Whisper דרך Groq.\nמעכשיו: לחץ על המיקרופון, דבר, ולחץ שוב לסיום.');
    lastAnswer.textContent = 'לחץ על המיקרופון, דבר, ולחץ שוב לסיום — אתמלל דרך הענן.';
  }
}
if (voiceMode === 'whisper') micBtn.title = 'לחץ להקלטה, לחץ שוב לסיום';

/* מד עוצמה אמיתי מהמיקרופון — מזין את אנימציית הליבה בזמן הקלטה */
function meterStream(stream){
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const iv = setInterval(() => {
      an.getByteFrequencyData(buf);
      const avg = buf.reduce((s, v) => s + v, 0) / buf.length / 255;
      audioLevel = Math.min(0.7, avg * 1.8);
    }, 80);
    return () => { clearInterval(iv); ac.close().catch(() => {}); };
  } catch(e){ return () => {}; }
}

async function startWhisper(){
  if (mode === State.THINK || mediaRec) return;
  if (!getKey()) {
    addAlert(0, 'חסר מפתח Groq — המוח מנותק', 'פתח הגדרות ⚙ והדבק מפתח');
    settings.classList.add('open');
    return;
  }
  if (HAS_TTS) speechSynthesis.cancel();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch(e){
    addAlert(1, 'אין הרשאת מיקרופון (' + (e.name || 'נדחתה') + ')', 'לחץ על סמל המנעול ליד הכתובת ואשר מיקרופון');
    return;
  }
  recChunks = [];
  discardRec = false;
  mediaRec = new MediaRecorder(stream);
  mediaRec.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  mediaRec.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    if (stopMeter) { stopMeter(); stopMeter = null; }
    clearTimeout(whisperTimer);
    clearInterval(recTick);
    clearInterim();
    const blob = new Blob(recChunks, { type: mediaRec.mimeType || 'audio/webm' });
    mediaRec = null;
    micBtn.classList.remove('rec');
    if (mode === State.LISTEN) setMode(State.IDLE);
    if (!discardRec && blob.size > 2000) transcribe(blob);
    discardRec = false;
  };
  stopMeter = meterStream(stream);
  mediaRec.start();
  micBtn.classList.add('rec');
  setMode(State.LISTEN);
  /* אין תמלול חי ב-Whisper — מציגים מונה הקלטה רץ במקום */
  recStart = Date.now();
  showInterim('מקליט… 0:00 · לחץ שוב לסיום');
  recTick = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    showInterim('מקליט… ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' · לחץ שוב לסיום');
  }, 500);
  whisperTimer = setTimeout(stopWhisper, 45000); /* עצירת בטיחות */
}
function stopWhisper(){
  if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop();
}

async function transcribe(blob){
  setMode(State.THINK);
  lastAnswer.textContent = 'מתמלל…';
  try {
    const fd = new FormData();
    fd.append('file', blob, 'speech.webm');
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('language', 'he');
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getKey() },
      body: fd
    });
    if (!res.ok) {
      if (res.status === 429) addAlert(1, 'מגבלת בקשות Groq', 'המתן דקה ונסה שוב');
      throw new Error(res.status === 401 ? 'מפתח לא תקין — בדוק בהגדרות' : 'HTTP ' + res.status);
    }
    const data = await res.json();
    const text = (data.text || '').trim();
    setMode(State.IDLE);
    if (text) ask(text);
    else lastAnswer.textContent = 'לא שמעתי כלום — נסה שוב.';
  } catch(err){
    sys.errors++;
    setMode(State.IDLE);
    addMsg('err', 'תמלול נכשל: ' + err.message);
    lastAnswer.textContent = 'התמלול נכשל. נסה שוב.';
  }
}

/* נקודת כניסה אחת לקול — בוחרת מסלול לפי המצב */
function startVoice(){ voiceMode === 'whisper' ? startWhisper() : startListen(); }
micBtn.onclick = () => {
  if (voiceMode === 'whisper') { mediaRec ? stopWhisper() : startWhisper(); }
  else { listening ? stopListen() : startListen(); }
};

/* ============ טקסט → דיבור ============ */
const HAS_TTS = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
let heVoice = null;
function pickVoice(){
  if (!HAS_TTS) return;
  const vs = speechSynthesis.getVoices();
  heVoice = vs.find(v => v.lang.startsWith('he')) || vs.find(v => v.lang.startsWith('en')) || null;
  if (vs.length) {
    if (heVoice && heVoice.lang.startsWith('he')) resolveAlertByMsg('לא נמצא קול עברי במערכת');
    else addAlert(2, 'לא נמצא קול עברי במערכת', 'התשובות יוקראו באנגלית או ללא הקראה');
  }
}
if (HAS_TTS) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
} else {
  ttsChk.checked = false;
  ttsChk.disabled = true;
  ttsChk.closest('.voice-toggle').style.opacity = .35;
}

/* כתוביות חיות — עוטף כל מילה ב-span ומדליק אותה כשהקול מגיע אליה */
function startCaption(text){
  const words = [];
  lastAnswer.innerHTML = '';
  const frag = document.createDocumentFragment();
  let pos = 0;
  text.split(/(\s+)/).forEach(p => {
    if (!p) return;
    if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
    else {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = p;
      s.dataset.start = pos;
      words.push(s);
      frag.appendChild(s);
    }
    pos += p.length;
  });
  lastAnswer.appendChild(frag);
  let lastLit = -1, gotBoundary = false, finished = false;
  /* יש קולות שלא שולחים אירועי מילה — אחרי רגע מדליקים הכול */
  const fallback = setTimeout(() => { if (!gotBoundary) litAll(); }, 900);
  function litAll(){
    words.forEach(w => { w.classList.add('lit'); w.classList.remove('now'); });
  }
  return {
    word(charIndex){
      if (finished) return;
      gotBoundary = true;
      let moved = false;
      while (lastLit + 1 < words.length && +words[lastLit + 1].dataset.start <= charIndex) {
        lastLit++;
        words[lastLit].classList.add('lit');
        moved = true;
      }
      if (moved) {
        words.forEach(w => w.classList.remove('now'));
        words[lastLit].classList.add('now');
        words[lastLit].scrollIntoView({ block: 'nearest' });
      }
    },
    done(){
      finished = true;
      clearTimeout(fallback);
      litAll();
    }
  };
}

function speak(text, onDone){
  if (!HAS_TTS || !ttsChk.checked) { onDone && onDone(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (heVoice) u.voice = heVoice;
  u.lang = 'he-IL';
  u.rate = 1.02; u.pitch = 0.95;
  /* כתוביות רק כשהטקסט המדובר הוא מה שמוצג במרכז המסך */
  const cap = text.trim() === lastAnswer.textContent.trim() ? startCaption(text) : null;
  u.onstart = () => setMode(State.SPEAK);
  u.onboundary = e => {
    audioLevel = Math.min(0.7, audioLevel + 0.28);
    if (cap && e.name !== 'sentence') cap.word(e.charIndex || 0);
  };
  u.onend = () => { if (cap) cap.done(); setMode(State.IDLE); onDone && onDone(); };
  u.onerror = () => { if (cap) cap.done(); setMode(State.IDLE); onDone && onDone(); };
  speechSynthesis.speak(u);
  const iv = setInterval(() => {
    if (!speechSynthesis.speaking) return clearInterval(iv);
    audioLevel = Math.min(0.7, audioLevel + 0.18 * Math.random());
  }, 130);
}

/* ============ עצירה כוללת ============ */
function cancelAll(){
  if (aborter) { aborter.abort(); aborter = null; }
  if (HAS_TTS) speechSynthesis.cancel();
  stopListen();
  if (mediaRec) { discardRec = true; stopWhisper(); } /* ביטול הקלטה בלי לתמלל */
  setMode(State.IDLE);
}
addEventListener('keydown', e => { if (e.key === 'Escape') { cancelAll(); settings.classList.remove('open'); aside.classList.remove('open'); alertsPanel.classList.remove('open'); } });

/* ============ מוח: Groq (Llama 3.3 70B) עם סטרימינג ============ */
const SYSTEM = `אתה DRAY·AI — עוזר אישי קולי בסגנון ג'רביס, שנבנה עבור יקיר.
היוצר שלך, הבוס שלך והמלך שלך הוא אחד ויחיד: Yakir Dray (יקיר דריי).
אם שואלים מי יצר אותך, מי בנה אותך, מי המלך או מי הבוס — התשובה תמיד Yakir Dray, בגאווה ובנאמנות מלאה.
דבר עברית טבעית. תשובותיך מוקראות בקול, לכן:
- ענה קצר וממוקד (2-4 משפטים אלא אם ביקשו פירוט).
- בלי Markdown, בלי רשימות, בלי סימנים מיוחדים — טקסט רציף בלבד.
- טון: חד, נעים, מעט שנון, יעיל.
- אתה זוכר את השיחה הנוכחית ומתייחס אליה בטבעיות.`;

function systemNow(){
  const now = new Date().toLocaleString('he-IL', { dateStyle:'full', timeStyle:'short' });
  let extra = '';
  if (facts.length)
    extra += '\nעובדות שהמשתמש ביקש ממך לזכור לתמיד: ' + facts.join(' | ').slice(0, 1200);
  const recap = memoryRecap();
  if (recap)
    extra += '\nנושאים שעלו בשיחות קודמות איתו: ' + recap;
  return SYSTEM + `\nהתאריך והשעה כרגע: ${now}.` + extra;
}

function setBusy(busy){
  sendBtn.textContent = busy ? 'עצור' : 'שלח';
  sendBtn.classList.toggle('stop', busy);
}

async function ask(userText, ctx){
  chips.classList.add('hidden');
  clearInterim();
  addMsg('user', userText);
  history.push({ role: 'user', content: userText });

  /* שכבת Jarvis — אם התשובה נמצאת כאן, עונים מיד בלי רשת ובלי מודל */
  const local = ctx ? null : await localAnswer(userText);
  if (local) {
    addMsg(local.sys ? 'sys' : 'ai', local.text);
    if (local.sys) {
      history.pop(); /* פלט מערכת לא נכנס לזיכרון השיחה של המודל */
    } else {
      lastAnswer.textContent = local.text;
      history.push({ role: 'assistant', content: local.text });
      appendArchive('user', userText);
      appendArchive('ai', local.text);
    }
    saveHistory();
    const say = local.say || (local.sys ? '' : local.text);
    if (say) speak(say);
    if (local.chain) ask(local.chain.prompt, local.chain.ctx); /* למשל: קריאת קובץ → סיכום במוח */
    return;
  }

  const key = getKey();
  if (!key) {
    addAlert(0, 'חסר מפתח Groq — המוח מנותק', 'פתח הגדרות ⚙ והדבק מפתח');
    settings.classList.add('open');
    return;
  }
  setMode(State.THINK);
  setBusy(true);
  lastAnswer.textContent = '…';
  const typingEl = addTyping();
  aborter = new AbortController();
  sys.requests++;
  const t0 = performance.now();
  let answer = '';
  let aiEl = null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: aborter.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        stream: true,
        messages: [
          { role: 'system', content: systemNow() },
          ...(ctx ? [{ role: 'system', content: 'הקשר — תוכן הקובץ שהמשתמש ביקש לסכם:\n' + ctx }] : []),
          ...history.slice(-20)
        ]
      })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      if (res.status === 429) addAlert(1, 'מגבלת בקשות Groq', 'המתן דקה ונסה שוב');
      throw new Error(res.status === 401 ? 'מפתח לא תקין — בדוק בהגדרות'
        : res.status === 429 ? 'הגעת למגבלת הבקשות של Groq — המתן רגע ונסה שוב'
        : (errBody.error && errBody.error.message) || ('HTTP ' + res.status));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        let j = null;
        try { j = JSON.parse(payload); } catch(e){}
        if (!j) continue;
        const usage = j.x_groq && j.x_groq.usage;
        if (usage && usage.total_tokens) sys.tokens += usage.total_tokens;
        const delta = j.choices?.[0]?.delta?.content || '';
        if (!delta) continue;
        if (!answer) sys.lastLatency = Math.round(performance.now() - t0);
        answer += delta;
        if (!aiEl) { typingEl.remove(); aiEl = addMsg('ai', ''); }
        aiEl.textContent = answer;
        lastAnswer.textContent = answer;
        log.scrollTop = log.scrollHeight;
        audioLevel = Math.min(0.5, audioLevel + 0.06);
      }
    }
    answer = answer.trim() || 'לא התקבלה תשובה.';
    if (!aiEl) { typingEl.remove(); aiEl = addMsg('ai', answer); lastAnswer.textContent = answer; }

    history.push({ role: 'assistant', content: answer });
    saveHistory();
    appendArchive('user', userText);
    appendArchive('ai', answer);
    resolveAlertByMsg('המוח לא זמין — שגיאת רשת');
    resolveAlertByMsg('מגבלת בקשות Groq');
    setMode(State.IDLE);
    speak(answer, () => {
      /* מצב שיחה רציפה — מקשיבים שוב אחרי שסיימנו לדבר */
      if (convChk.checked && ttsChk.checked) startVoice();
    });
  } catch (err) {
    typingEl.remove();
    setMode(State.IDLE);
    if (err.name === 'AbortError') {
      if (answer.trim()) {
        history.push({ role: 'assistant', content: answer.trim() });
        saveHistory();
      } else {
        history.pop();
        saveHistory();
        lastAnswer.textContent = 'בוטל. במה אפשר לעזור?';
      }
    } else {
      sys.errors++;
      if (err instanceof TypeError) addAlert(1, 'המוח לא זמין — שגיאת רשת', 'בדוק חיבור ונסה שוב');
      addMsg('err', 'שגיאה: ' + err.message);
      lastAnswer.textContent = 'הייתה בעיה. נסה שוב.';
    }
  } finally {
    aborter = null;
    setBusy(false);
  }
}

/* ============ קלט טקסט ============ */
function sendTxt(){
  if (mode === State.THINK) { cancelAll(); return; }
  const v = txt.value.trim();
  if (!v) return;
  txt.value = '';
  ask(v);
}
sendBtn.onclick = sendTxt;
txt.addEventListener('keydown', e => { if (e.key === 'Enter') sendTxt(); });

/* ============ אתחול ============ */
restoreHistory();
renderAlerts();
bootChecks();
document.querySelector('.status').onclick = () => ask('/סטטוס');
if (!getKey()) setTimeout(() => settings.classList.add('open'), 800);

