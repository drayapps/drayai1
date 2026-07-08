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
  + '/מדריך — מסך עם כל היכולות\n'
  + '/סטטוס · /בריאות · /התראות — מצב המערכת\n'
  + '/יומן — האירועים שלך · "קבע מחר ב-14:00 רופא" · "תזכיר לי בעוד 10 דקות להוציא כביסה"\n'
  + '"פתח לוח שנה" — לוח חודשי חזותי (📅) · "מה יש לי היום / מחר / השבוע"\n'
  + '"תזכור ש..." — זיכרון לתמיד · "מה אתה זוכר" · /ייצוא — הורדת כל השיחות לקובץ\n'
  + '/תיקייה — חיבור תיקייה (+יומן שיחות אוטומטי) · /קבצים · /קרא <שם קובץ> — סיכום\n'
  + '"פתח יוטיוב / גוגל / וואטסאפ" — פתיחת אתרים\n'
  + '"שלח וואטסאפ לאמא שאני אאחר" — אנסח הודעה ואתן קישור מוכן לשליחה (אפשר גם מספר: "שלח וואטסאפ ל052-1234567 …")\n'
  + '"דוח משימות של היום" / "שלח דוח משימות של מחר לאמא" — דוח ממוספר עם שעות, מוכן לשליחה בוואטסאפ\n'
  + '/מטבע · /קובייה — כשצריך להחליט\n'
  + 'וגם: "מה השעה", "מה התאריך", ו... נסה לשאול מי המלך 👑';

/* פיצול משפט דיבור לכמה משימות — רק בגבול "וגם/ואז/אחר כך/," או "ו" שלפני רמז-זמן ברור.
   כל מקטע נבדק בנפרד; אם לא יוצאות ≥2 משימות תקינות — נופלים חזרה למשימה יחידה. */
function splitTasks(s){
  const TIME_CUE = 'ב-?\\d|בשעה|בעוד|היום|מחר|מחרתיים|ביום|הערב|בבוקר|בערב|בצהריים|בלילה'
    + '|ב(?:אחת|שתיים|שתים|שניים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|עשרה)';
  const re = new RegExp('\\s+(?:וגם|ואז|אחר[ ]?כך|אחרי[ ]?כן)\\s+|\\s*,\\s*|\\s+(?=ו(?:' + TIME_CUE + '))');
  return s.split(re).map(x => x.trim()).filter(Boolean);
}

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
  if (/^\/?(מדריך|guide)$/i.test(t) || /^מה את(?:ה)? (יודעת?|יכולה?) לעשות$/.test(t)) {
    openGuide();
    return { text: 'פתחתי את המדריך — כל מה שאני יודעת לעשות, במסך אחד.', sys: true, say: 'הנה כל מה שאני יודעת לעשות.' };
  }
  if (/^\/?(לוח שנה|לוח|יומן חזותי|calendar)$/i.test(t) || /^(פתח|פתחי|הצג|הצגי|תפתח|תפתחי|תציג|תציגי)( לי)?( את)? (ה)?(לוח שנה|לוח|יומן)$/.test(t)) {
    openCalendar(true);
    return { text: 'פתחתי את לוח השנה.', sys: true };
  }

  /* --- זיכרון ארוך טווח --- */
  const rm = t.match(/^(?:תזכור|תזכרי) ש(.+)$/);
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
  if (/^(מה את(?:ה)? זוכר(?:ת)?( עליי| עלי)?|\/?זיכרון)$/.test(t)) {
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
    return { text: 'מורידה את DRAY-LOG.md — כל ' + archive.length + ' ההודעות מהארכיון.', sys: true };
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
  /* --- דוח משימות יומי/שבועי מוכן לשליחה בוואטסאפ --- */
  if (/^\/?(דוח|דו"ח)( משימות| יומי| שבועי)?$/.test(t)
      || (/(^|\s)דו"?ח(\s|$)/.test(t) && /(משימ|יומי|שבוע|לו"?ז|וואטס|ווטס)/.test(t))
      || /(שלח|שלחי|תשלח|צור|צרי|תכין|תכיני|הכן|הכיני)\s+(?:לי\s+)?(?:את\s+)?(?:ה)?דו"?ח/.test(t)
      || /רשימת משימות/.test(t)) {
    setTimeout(() => composeTaskReport(t), 0); /* אחרי הודעת המערכת — בונה ומציג קישור בעצמה */
    return { text: 'מכינה דוח משימות… 📋', sys: true };
  }
  /* פעלים שמפורשות מכוונים לתזכורת — גם בלי זמן מפורש נותנים הכוונה */
  const SCHED_STRONG = /^(?:אנא |בבקשה |תוכל[יה]? )?(קבעי|קבעו|תקבעי|תקבעו|תקבע|קבע|תזכירי|תזכיר|תזכורת|תתזכרו|תתזכר|תזכרי|הזכירי|הזכר|תזכור(?! ש)|טיימר|תזמני|תזמן)/; /* צורה ארוכה לפני קצרה — אחרת "קבעי" נתפס כ"קבע" */
  /* פעלים כלליים ("הוסף/רשום/שים/צור ליומן…") — נחשבים לתזמון רק אם נמצא זמן */
  const SCHED_SOFT = /^(?:אנא |בבקשה |תוכל[יה]? )?(הוסיפי|הוסף|תוסיפי|תוסיף|רשמי|רשום|תרשמי|תרשום|שימי|שים|תשימי|תשים|צרי|צור|תצור|תיצור|תכניסי|תכניס|הכנס)/;
  const schedCue = /(ליומן|בלוח|בלו"?ז|תזכורת|משימ|אירוע|פגיש|דדליין)/.test(t);
  const relTime = /(?:בעוד|אחרי)\s+(?:\d+|חצי|שעה|שעתיים|דקה|יומיים|שבוע|יום)/.test(t);
  /* הודעת וואטסאפ שאינה תזכורת מפורשת — תטופל בבלוק הוואטסאפ, לא כאן */
  const isWhatsApp = /(וואטסאפ|ווטסאפ|וואצאפ|whatsapp)/i.test(t)
    && (/(שלח|תשלח|שלחי|כתוב|תכתוב|כתבי|נסח|תנסח|תגיד|תשדר|הודעה|הודעת)/.test(t) || t.includes(':'));
  if (!(isWhatsApp && !SCHED_STRONG.test(t))
      && (SCHED_STRONG.test(t) || ((SCHED_SOFT.test(t) || schedCue || relTime)))) {
    /* ניקוי כותרת אחיד — מסיר פועל, זמן, רמזי-יומן ומילות קישור */
    const taskTitle = seg => stripWhen(seg
        .replace(SCHED_STRONG, '')
        .replace(SCHED_SOFT, '')
        .replace(/^\s*(לי|אותי|לנו|אותנו|לו|לה)\s+/, '')
        .replace(/(^|\s)(תזכורת|תזכורות|משימה|משימות)(\s|$)/g, ' ')
        .replace(/(ליומן|בלוח|בלו"?ז)\s*/g, ' ')
      ).replace(/^\s*ו\s+/, '')
       .replace(/^\s*(?:ש|של|את|על|לגבי)\s+/, '').trim() || 'תזכורת';
    const refreshCal = () => { if (calendar.classList.contains('open')) { renderCalendar(); if (calSelected) selectDay(calSelected, false); } };

    /* דיבור מרובה משימות: "קבעי מחר בתשע פגישה ובאחת ארוחה" → כמה אירועים ביומן */
    const segs = splitTasks(t);
    if (segs.length > 1) {
      const added = [];
      segs.forEach((seg, k) => {
        const ts2 = parseWhen(seg);
        if (!ts2) return;
        events.push({ id: Date.now() + k, ts: ts2, title: taskTitle(seg), done: false });
        added.push(events[events.length - 1]);
      });
      if (added.length >= 2) {
        added.sort((a, b) => a.ts - b.ts);
        saveEvents();
        refreshCal();
        askNotifyPermission();
        return { text: 'קבעתי לך ' + added.length + ' משימות ביומן:\n' + added.map((e, i) => (i + 1) + '. ' + fmtEv(e)).join('\n'),
          say: 'סידרתי — ' + added.length + ' משימות ביומן.' };
      }
      if (added.length) events = events.filter(e => !added.includes(e)); /* פחות משתיים תקינות — ביטול ומעבר למשימה יחידה */
    }

    const ts = parseWhen(t);
    if (!ts) {
      /* בקשת תזכורת ברורה (פועל מפורש / פועל רך + רמז יומן / זמן יחסי) — נותנים הכוונה עדינה.
         פועל רך בלי הקשר יומן — שהמוח יטפל בטבעיות */
      if (SCHED_STRONG.test(t) || relTime || (SCHED_SOFT.test(t) && schedCue))
        return { text: 'לא הצלחתי להבין מתי בדיוק 🙂 אפשר למשל: "קבעי מחר ב-14:00 רופא שיניים", "תזכירי לי בעוד עשר דקות" או "תזכירי לי היום בשמונה בערב".', sys: true };
      return null;
    }
    events.push({ id: Date.now(), ts, title: taskTitle(t), done: false });
    saveEvents();
    refreshCal(); /* רענון לוח אם פתוח */
    askNotifyPermission(); /* מבקשים הרשאת התראות מערכת בקביעה הראשונה */
    const when = new Date(ts).toLocaleString('he-IL', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    return { text: 'נקבע: ' + fmtEv(events[events.length - 1]) + '. אזכיר לך בזמן — בקול ובהתראה.',
      say: 'נקבע ל' + when + '. אזכיר לך.' };
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
  const rd = t.match(/^\/?(?:קרא|קראי) (?:את )?(.+)$/);
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
    return { text: 'קראתי את "' + file.name + '" — מעבירה למוח לסיכום…', sys: true,
      chain: { prompt: 'סכם לי בקצרה את הקובץ "' + file.name + '"', ctx: content } };
  }

  /* --- וואטסאפ: נסח הודעה + קישור שליחה --- */
  /* חייב פועל שליחה/כתיבה או נקודתיים — כדי ש"פתח וואטסאפ" יישאר פתיחת אתר בלבד */
  if (/(וואטסאפ|ווטסאפ|וואצאפ|whatsapp)/i.test(t)
      && (/(שלח|תשלח|שלחי|כתוב|תכתוב|כתבי|נסח|תנסח|תגיד|תשדר|הודעה|הודעת)/.test(t) || t.includes(':'))) {
    setTimeout(() => composeWhatsApp(parseWhatsApp(t)), 0); /* אחרי הודעת המערכת — מנסחת ומציגה קישור בעצמה */
    return { text: 'מנסחת הודעת וואטסאפ… ✍️', sys: true };
  }

  /* --- פתיחת אתרים --- */
  const op = t.match(/^(?:פתח|פתחי|תפתח|תפתחי) (?:לי )?(?:את )?(.+)$/);
  if (op) {
    const sites = { 'יוטיוב': ['YouTube', 'https://youtube.com'], 'גוגל': ['Google', 'https://google.com'],
      "ג'ימייל": ['Gmail', 'https://mail.google.com'], 'מייל': ['Gmail', 'https://mail.google.com'],
      'וואטסאפ': ['WhatsApp', 'https://web.whatsapp.com'], 'מפות': ['מפות Google', 'https://maps.google.com'],
      'ספוטיפיי': ['Spotify', 'https://open.spotify.com'] };
    const target = op[1].trim();
    for (const k in sites) if (target.includes(k)) { window.open(sites[k][1], '_blank'); return { text: 'פותחת את ' + sites[k][0] + '.', say: 'פותחת ' + sites[k][0] }; }
    const dom = target.match(/^([\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)$/i);
    if (dom) { window.open('https://' + dom[1], '_blank'); return { text: 'פותחת את ' + dom[1] + '.' }; }
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

