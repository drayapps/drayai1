const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const THREE_LOCAL = fs.readFileSync(path.join(__dirname, 'three.min.js'), 'utf8');
const SHOTS = '/home/user/drayai1/shots';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });

  // Serve local three.js in place of the blocked CDN; drop the supabase CDN quietly.
  await ctx.route(/cdnjs\.cloudflare\.com\/.*three.*\.js/, r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: THREE_LOCAL }));
  await ctx.route(/cdn\.jsdelivr\.net\/.*supabase.*/, r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' }));

  // Seed a dummy key + fresh prefs BEFORE any app script runs (avoids the "missing key" alert).
  await ctx.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('dray_groq_key', 'gsk_demo_key_for_screenshots_only');
      localStorage.setItem('dray_tts', '0');        // keep speech silent during capture
      localStorage.setItem('dray_conv', '0');
    } catch (e) {}
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4325/index.html', { waitUntil: 'load', timeout: 25000 });

  // Wait for the 3D avatar (or fall back to the 2D orb) and neutralise speech.
  await page.waitForFunction(() => window.THREE !== undefined, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const use3d = await page.evaluate(() => {
    try { window.speak = () => {}; } catch (e) {}
    try { window.askNotifyPermission = () => {}; } catch (e) {}
    return document.body.classList.contains('use3d');
  });
  console.log('use3d =', use3d, '| THREE =', await page.evaluate(() => !!window.THREE));

  // ---- Seed realistic Hebrew demo data ----
  await page.evaluate(() => {
    const now = new Date();
    const at = (addDays, h, m) => { const d = new Date(now); d.setDate(d.getDate() + addDays); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
    // upcoming + spread-across-month events so the calendar shows dots
    events = [
      { id: 1, ts: at(0, 14, 0),  title: 'רופא שיניים', done: false },
      { id: 2, ts: at(0, 18, 30), title: 'אימון כושר', done: false },
      { id: 3, ts: at(1, 9, 0),   title: 'פגישה עם דני על הפרויקט', done: false },
      { id: 4, ts: at(1, 20, 0),  title: 'לקחת תרופה', done: false, repeat: 'daily' },
      { id: 5, ts: at(2, 8, 0),   title: 'להוציא כביסה', done: false, repeat: 'weekly' },
      { id: 6, ts: at(3, 10, 30), title: 'שיחה עם רואה החשבון', done: false },
      { id: 7, ts: at(5, 19, 0),  title: 'ארוחת ערב עם מיכל', done: false },
      { id: 8, ts: at(9, 11, 0),  title: 'חידוש רישיון', done: false },
      { id: 9, ts: at(-2, 16, 0), title: 'תספורת', done: true },
    ];
    facts = [
      'אני שותה קפה שחור בלי סוכר בבוקר',
      'יש לי אלרגיה לבוטנים',
      'אשתי מיכל, יום הנישואין ב-3 ביוני',
      'אני צמחוני',
      'הבת שלי נועה בת 6'
    ];
    contacts = [ { name: 'מיכל', phone: '972501234567' }, { name: 'אמא', phone: '972521112233' }, { name: 'דני', phone: '972549998877' } ];
    // archive: give a believable count for the profile / memory stats
    archive = [];
    for (let i = 0; i < 148; i++) archive.push({ r: i % 2 ? 'ai' : 'user', c: '…', t: Date.now() - i * 60000 });
    try { store.set('dray_events', JSON.stringify(events)); store.set('dray_facts', JSON.stringify(facts)); store.set('dray_contacts', JSON.stringify(contacts)); store.set('dray_archive', JSON.stringify(archive)); } catch (e) {}
  });

  // ---- helpers ----
  const resetBase = () => page.evaluate(() => {
    ['settings','guide','calendar','profile','alertsPanel','aside'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('open'); });
    log.innerHTML = '';
    history = [];
    chips.classList.add('hidden');
    setMode(State.IDLE);
    audioLevel = 0;
  });
  const shot = async (name, ms = 700) => { await page.waitForTimeout(ms); await page.screenshot({ path: `${SHOTS}/${name}.png` }); console.log('shot', name); };

  // ================= SHOTS =================

  // 01 — HERO: idle core + welcome + chips
  await resetBase();
  await page.evaluate(() => { chips.classList.remove('hidden'); setMode(State.IDLE); });
  await shot('01_hero', 1400);

  // 02 — VOICE / conversation: speaking core + warm transcript
  await resetBase();
  await page.evaluate(() => {
    aside.classList.add('open');
    addMsg('user', 'בוקר טוב, קצת לחוץ מהיום — מלא דברים על הראש');
    addMsg('ai', 'בוקר טוב יקיר 💙 נשמע עמוס. בוא נסדר את זה יחד — רוצה שאעבור איתך על מה שמחכה לך היום?');
    addMsg('user', 'כן, תזכירי לי גם לקחת תרופה בערב');
    addMsg('ai', 'קבעתי לך תזכורת יומית לתרופה בשמונה בערב, ואזכיר לך בקול בכל ערב. יש לך היום רופא שיניים בשתיים ואימון בשש וחצי.');
    lastAnswer.textContent = 'קבעתי לך תזכורת יומית לתרופה בשמונה בערב, ואזכיר לך בקול בכל ערב.';
    setMode(State.SPEAK); audioLevel = 0.5;
  });
  await shot('02_voice', 1200);

  // 03 — NATURAL REMINDER: real parse flow in the transcript
  await resetBase();
  await page.evaluate(() => {
    aside.classList.add('open');
    addMsg('user', 'תזכיר לי מחר בשמונה בערב לקחת תרופה');
    addMsg('ai', 'נקבע: ב׳, 20:00 — לקחת תרופה. אזכיר לך בזמן, בקול ובהתראה.');
    addMsg('user', 'וקבעי מחר בתשע פגישה עם דני ובאחת ארוחה');
    addMsg('ai', 'סידרתי — 2 משימות ביומן. ב׳ 09:00 פגישה עם דני, ב׳ 13:00 ארוחה.');
    lastAnswer.textContent = 'נקבע ליום שני בשמונה בערב. אזכיר לך.';
    setMode(State.IDLE);
  });
  await shot('03_reminder', 1000);

  // 04 — CALENDAR: month grid + selected day
  await resetBase();
  await page.evaluate(() => { openCalendar(false); });
  await shot('04_calendar', 1300);

  // 05 — WHATSAPP compose: drafted message + green send button
  await resetBase();
  await page.evaluate(() => {
    aside.classList.add('open');
    addMsg('user', 'שלח וואטסאפ למיכל שאני אאחר בעשרים דקות, אוהב אותך');
    addMsg('ai', 'היי מיכל, אני אאחר בערך בעשרים דקות — יצא לי יותר מאוחר מהצפוי. אוהב אותך ❤️');
    addWhatsAppAction(waLink('972501234567', 'היי מיכל, אני אאחר בערך בעשרים דקות. אוהב אותך'), '972501234567', 'מיכל');
    lastAnswer.textContent = 'ניסחתי הודעה למיכל. לחץ על הכפתור לשליחה בוואטסאפ.';
    setMode(State.IDLE);
  });
  await shot('05_whatsapp', 1000);

  // 06 — TASK REPORT: numbered daily report + send button
  await resetBase();
  await page.evaluate(() => {
    aside.classList.add('open');
    addMsg('user', 'שלחי דוח משימות של היום לאמא');
    composeTaskReport('שלחי דוח משימות של היום לאמא');
    setMode(State.IDLE);
  });
  await shot('06_report', 1100);

  // 07 — MEMORY: what do you remember
  await resetBase();
  await page.evaluate(async () => {
    aside.classList.add('open');
    addMsg('user', 'מה את זוכרת עליי?');
    const r = await localAnswer('מה את זוכרת עליי');
    addMsg('sys', r.text);
    lastAnswer.textContent = 'הנה מה שאני זוכרת עליך.';
    setMode(State.IDLE);
  });
  await shot('07_memory', 1000);

  // 08 — STATUS / JARVIS: status report + alerts panel
  await resetBase();
  await page.evaluate(async () => {
    aside.classList.add('open');
    addAlert(2, 'זיהוי דיבור יעבור ל-Whisper', 'נסה Chrome לזיהוי מובנה');
    addAlert(3, 'יומן קובץ לא מחובר', 'כתוב /תיקייה כדי לחבר');
    addMsg('user', 'סטטוס מערכת');
    addMsg('sys', statusBrief());
    alertsPanel.classList.add('open');
    lastAnswer.textContent = 'כל המערכות תקינות.';
    setMode(State.THINK); audioLevel = 0.3;
  });
  await shot('08_status', 1100);

  // 09 — PROFILE (cloud sync): inject a demo logged-in user
  await resetBase();
  await page.evaluate(() => {
    cloudUser = { id: 'demo', email: 'yakirdray1@gmail.com', created_at: '2026-01-12T00:00:00Z',
      user_metadata: { full_name: 'יקיר דריי', name: 'יקיר דריי' } };
    openProfile();
    const el = document.getElementById('pfCloudToday'); if (el) el.textContent = '📅 היום (מהענן): 2 משימות';
  });
  await shot('09_profile', 1100);

  // 10 — GUIDE: capabilities dialog
  await resetBase();
  await page.evaluate(() => { openGuide(); });
  await shot('10_guide', 1100);

  // 11 — SETTINGS: Groq key + accessibility + Google sign-in
  await resetBase();
  await page.evaluate(() => { document.getElementById('keyInput').value = ''; settings.classList.add('open'); });
  await shot('11_settings', 1000);

  console.log('ERRORS', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
})();
