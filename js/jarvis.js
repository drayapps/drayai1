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
  /* קפיצת פידבק כשהמונה עולה — אינדיקציית מצב, לא קישוט */
  if (badge > +(alertBadge.dataset.count || 0)) {
    alertBadge.classList.remove('pop');
    void alertBadge.offsetWidth; /* אתחול האנימציה כדי שתרוץ שוב */
    alertBadge.classList.add('pop');
  }
  alertBadge.dataset.count = badge;
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
