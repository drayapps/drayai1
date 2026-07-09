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
ttsChk.onchange = () => { store.set('dray_tts', ttsChk.checked ? '1' : '0'); if (typeof cloudPushPrefs === 'function') cloudPushPrefs(); };
convChk.onchange = () => { store.set('dray_conv', convChk.checked ? '1' : '0'); if (typeof cloudPushPrefs === 'function') cloudPushPrefs(); };


/* ============ נגישות: גודל טקסט, הפחתת תנועה, ניגודיות ============ */
const segText = document.getElementById('segText');
const motionChk = document.getElementById('motionChk');
const contrastChk = document.getElementById('contrastChk');
const root = document.documentElement;

function applyPrefs(){
  const size = store.get('dray_textsize', 'normal');
  const motion = store.get('dray_motion', 'full');
  const contrast = store.get('dray_contrast', '0');
  root.dataset.textsize = size;
  root.dataset.motion = motion;
  root.dataset.contrast = contrast === '1' ? 'high' : 'normal';
  if (segText) segText.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.size === size)));
  if (motionChk) motionChk.checked = motion === 'reduced';
  if (contrastChk) contrastChk.checked = contrast === '1';
  if (typeof cloudPushPrefs === 'function') cloudPushPrefs(); /* ענן: guard פנימי (מחובר + לא בזמן משיכה) */
}
if (segText) segText.querySelectorAll('button').forEach(b => {
  b.onclick = () => { store.set('dray_textsize', b.dataset.size); applyPrefs(); announce('גודל טקסט: ' + b.textContent); };
});
if (motionChk) motionChk.onchange = () => { store.set('dray_motion', motionChk.checked ? 'reduced' : 'full'); applyPrefs(); };
if (contrastChk) contrastChk.onchange = () => { store.set('dray_contrast', contrastChk.checked ? '1' : '0'); applyPrefs(); };
applyPrefs();


/* ============ הגדרות ============ */
const settings = document.getElementById('settings');
const keyInput = document.getElementById('keyInput');
document.getElementById('gearBtn').onclick = () => { keyInput.value = getKey(); settings.classList.add('open'); };
document.getElementById('closeSet').onclick = () => settings.classList.remove('open');
document.getElementById('saveKey').onclick = () => {
  store.set(KEY_NAME, keyInput.value.trim());
  settings.classList.remove('open');
  if (getKey()) resolveAlertByMsg('חסר מפתח Groq — המוח מנותק');
  lastAnswer.textContent = 'המפתח נשמר. אני מוכנה — דברו איתי.';
};
settings.addEventListener('click', e => { if (e.target === settings) settings.classList.remove('open'); });


/* ============ תמלול במובייל ============ */
const aside = document.getElementById('aside');
document.getElementById('chatBtn').onclick = () => aside.classList.toggle('open');


/* ============ מדריך יכולות — דיאלוג נגיש ============ */
const guide = document.getElementById('guide');
let guideReturnFocus = null;
function openGuide(){
  guideReturnFocus = document.activeElement;
  guide.classList.add('open');
  document.getElementById('closeGuide').focus(); /* הפוקוס נכנס לדיאלוג */
}
function closeGuide(){
  guide.classList.remove('open');
  if (guideReturnFocus && guideReturnFocus.focus) guideReturnFocus.focus(); /* וחוזר לכפתור שפתח */
}
document.getElementById('helpBtn').onclick = openGuide;
document.getElementById('closeGuide').onclick = closeGuide;
guide.addEventListener('click', e => { if (e.target === guide) closeGuide(); });
/* מלכודת פוקוס — Tab נשאר בתוך הדיאלוג כל עוד הוא פתוח */
guide.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const f = guide.querySelectorAll('button, a, [tabindex]');
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

