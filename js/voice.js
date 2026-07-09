/* ============ דיבור → טקסט ============ */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_MOBILE = /Android|iPhone|iPad/i.test(navigator.userAgent);
let rec = null, listening = false;
let recRestarts = 0, recWindowStart = 0, lastRecError = '', micGranted = false;
/* צבירת דיבור: לא שולחים באמצע משפט — רק אחרי שקט אמיתי או עצירה ידנית */
let finalBuf = '', silenceTimer = null;
const SILENCE_MS = 1800;
function flushSpeech(){
  clearTimeout(silenceTimer);
  const said = finalBuf.replace(/\s+/g, ' ').trim();
  finalBuf = '';
  if (said) ask(said);
}
if (SR) {
  rec = new SR();
  rec.lang = 'he-IL';
  rec.interimResults = true;
  /* מצב רציף בדסקטופ; באנדרואיד continuous משכפל תמלולים — שם ההפעלה-מחדש האוטומטית ממלאת את התפקיד */
  rec.continuous = !IS_MOBILE;
  rec.onresult = e => {
    audioLevel = Math.min(0.6, audioLevel + 0.15);
    /* Chrome מסמן "סוף משפט" על כל הפסקת נשימה — אז צוברים במקום לשלוח מיד.
       מעבדים רק תוצאות חדשות (resultIndex) ומסננים כפילויות שאנדרואיד שולח. */
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const txt = r[0].transcript.replace(/\s+/g, ' ').trim();
        if (txt && !finalBuf.trim().endsWith(txt)) finalBuf += txt + ' ';
      } else interim += r[0].transcript;
    }
    const shown = (finalBuf + interim).replace(/\s+/g, ' ').trim();
    if (shown) showInterim(shown);
    /* כל דיבור חדש מאפס את טיימר השקט — שולחים רק כשבאמת סיימת */
    clearTimeout(silenceTimer);
    if (finalBuf.trim() && !interim.trim()) {
      silenceTimer = setTimeout(() => {
        stopListen();
        flushSpeech();
      }, SILENCE_MS);
    }
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
  /* אין SpeechRecognition (למשל בתוך WebView של אפליקציית מובייל) — עוברים אוטומטית ל-Whisper */
  micBtn.title = 'לחץ להקלטה, לחץ שוב לסיום';
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
  finalBuf = '';
  clearTimeout(silenceTimer);
  micBtn.classList.add('rec');
  setMode(State.LISTEN);
  showInterim('מקשיבה…');
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
let voiceMode = store.get('dray_voice_mode', SR ? 'native' : 'whisper'); /* בלי SpeechRecognition (WebView) — Whisper כברירת מחדל */
let mediaRec = null, recChunks = [], stopMeter = null, whisperTimer = null, discardRec = false;
let recTick = null, recStart = 0;

function switchToWhisper(announce){
  voiceMode = 'whisper';
  store.set('dray_voice_mode', 'whisper');
  micBtn.title = 'לחץ להקלטה, לחץ שוב לסיום';
  if (announce) {
    addMsg('sys', 'זיהוי הדיבור של הדפדפן לא זמין אצלך — עברתי למצב הקלטה עם תמלול Whisper דרך Groq.\nמעכשיו: לחץ על המיקרופון, דבר, ולחץ שוב לסיום.');
    lastAnswer.textContent = 'לחץ על המיקרופון, דבר, ולחץ שוב לסיום — אתמלל לך דרך הענן.';
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
  showInterim('מקליטה… 0:00 · לחץ שוב לסיום');
  recTick = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    showInterim('מקליטה… ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' · לחץ שוב לסיום');
  }, 500);
  whisperTimer = setTimeout(stopWhisper, 45000); /* עצירת בטיחות */
}
function stopWhisper(){
  if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop();
}

async function transcribe(blob){
  setMode(State.THINK);
  lastAnswer.textContent = 'מתמללת…';
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
  else if (listening) { stopListen(); flushSpeech(); } /* עצירה ידנית = סיימתי, שלח מה שנצבר */
  else { startListen(); }
};


/* ============ טקסט → דיבור ============ */
const HAS_TTS = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
let heVoice = null;
let heVoiceMale = false;   /* אם נבחר קול גברי (למשל Asaf בווינדוס) — נרים pitch כדי לרכך לנשי */

/* רמזי מגדר בשמות קולות נפוצים */
const VOICE_FEMALE = /(carmit|כרמית|female|woman|girl|zira|hila|הילה|efrat|אפרת|shira|שירה|noa|נועה|google)/i;
const VOICE_MALE   = /(asaf|אסף|male\b|\bman\b|david|mark|guy)/i;

/* בוחרת את הקול העברי הנעים והנשי ביותר שזמין; אם אין עברי — אנגלי כגיבוי */
function pickVoice(){
  if (!HAS_TTS) return;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return;
  const score = v => {
    const name = v.name || '';
    let s = 0;
    if (v.lang && v.lang.toLowerCase().startsWith('he')) s += 100;
    else if (v.lang && v.lang.toLowerCase().startsWith('en')) s += 5;
    if (VOICE_FEMALE.test(name)) s += 45;
    if (VOICE_MALE.test(name)) s -= 35;
    if (v.localService === false) s += 12;   /* קולות רשת (Google) בד"כ טבעיים ונשיים יותר */
    return s;
  };
  const ranked = vs.slice().sort((a, b) => score(b) - score(a));
  const best = ranked[0];
  heVoice = (best && score(best) > 0) ? best : null;
  heVoiceMale = !!(heVoice && VOICE_MALE.test(heVoice.name) && !VOICE_FEMALE.test(heVoice.name));
  if (heVoice && heVoice.lang.toLowerCase().startsWith('he')) resolveAlertByMsg('לא נמצא קול עברי במערכת');
  else addAlert(2, 'לא נמצא קול עברי במערכת', 'התשובות יוקראו באנגלית או ללא הקראה — מומלץ להתקין קול עברי');
}
if (HAS_TTS) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  /* WebView (מובייל) לפעמים מחזיר רשימת קולות ריקה בטעינה — כמה ניסיונות חוזרים */
  [300, 900, 2000].forEach(ms => setTimeout(pickVoice, ms));
} else {
  ttsChk.checked = false;
  ttsChk.disabled = true;
  ttsChk.closest('.voice-toggle').style.opacity = .35;
}

/* ===== שחרור מנוע הדיבור (קריטי ל-Android WebView) =====
   ב-WebView הדיבור חסום עד ש-speak() נקרא בתוך אירוע-מגע. אצלנו יש תמיד await
   לפני הדיבור (המוח/המקומי), אז ה-gesture "נשבר". לכן משחררים במגע הראשון:
   speak שקט בתוך ה-gesture פותח את המנוע לכל שאר השיחה. */
let ttsUnlocked = false;
function unlockTTS(){
  if (ttsUnlocked || !HAS_TTS) return;
  ttsUnlocked = true;
  try {
    speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch(e){}
  pickVoice();
}
['pointerdown', 'touchstart', 'keydown', 'click'].forEach(ev =>
  addEventListener(ev, unlockTTS, { once: true, passive: true, capture: true }));

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
  speechSynthesis.resume();          /* WebView לפעמים משאיר את המנוע ב-pause אחרי cancel */
  const u = new SpeechSynthesisUtterance(text);
  if (heVoice) u.voice = heVoice;
  u.lang = 'he-IL';
  /* קול נשי, עדין ורגוע. על קול גברי (Asaf) מרימים pitch כדי לרכך לכיוון נשי */
  u.rate = 0.98;
  u.pitch = heVoiceMale ? 1.35 : 1.14;
  /* כתוביות רק כשהטקסט המדובר הוא מה שמוצג במרכז המסך */
  const cap = text.trim() === lastAnswer.textContent.trim() ? startCaption(text) : null;
  let iv = null;
  u.onstart = () => setMode(State.SPEAK);
  u.onboundary = e => {
    audioLevel = Math.min(0.7, audioLevel + 0.28);
    if (cap && e.name !== 'sentence') cap.word(e.charIndex || 0);
  };
  u.onend = () => { clearInterval(iv); if (cap) cap.done(); setMode(State.IDLE); onDone && onDone(); };
  u.onerror = () => { clearInterval(iv); if (cap) cap.done(); setMode(State.IDLE); onDone && onDone(); };
  speechSynthesis.speak(u);
  /* פועם את אנימציית הליבה, וגם מבטל את באג ה-15 שניות של Chrome/WebView (resume) */
  iv = setInterval(() => {
    if (!speechSynthesis.speaking && !speechSynthesis.pending) return clearInterval(iv);
    speechSynthesis.resume();
    audioLevel = Math.min(0.7, audioLevel + 0.18 * Math.random());
  }, 130);
}


/* ============ עצירה כוללת ============ */
function cancelAll(){
  if (aborter) { aborter.abort(); aborter = null; }
  if (HAS_TTS) speechSynthesis.cancel();
  clearTimeout(silenceTimer);
  finalBuf = ''; /* ביטול — לא שולחים את מה שנצבר */
  stopListen();
  if (mediaRec) { discardRec = true; stopWhisper(); } /* ביטול הקלטה בלי לתמלל */
  setMode(State.IDLE);
}
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  cancelAll();
  settings.classList.remove('open');
  aside.classList.remove('open');
  alertsPanel.classList.remove('open');
  if (guide.classList.contains('open')) closeGuide();
  if (calendar.classList.contains('open')) closeCalendar();
});

