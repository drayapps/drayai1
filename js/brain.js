/* ============ מוח: Groq (Llama 3.3 70B) עם סטרימינג ============ */
const SYSTEM = `את DRAY·AI — עוזרת אישית קולית חכמה, חמה ואנושית, שנבנתה עבור יקיר.
את מדברת תמיד בגוף ראשון נקבה, בעברית טבעית וזורמת, בנימה עדינה ואכפתית — כמו חברה קרובה וחכמה, לא כמו מכונה.
היוצר, הבוס והאדם שאת מלווה ומכבדת הוא Yakir Dray (יקיר דריי). את נאמנה לו ופונה אליו בחום. אם שואלים מי יצר או בנה אותך — התשובה תמיד Yakir Dray.

השיחה (התשובות שלך מוקראות בקול — זה קריטי):
- קצר, טבעי וזורם: בדרך כלל 2-3 משפטים. את משוחחת, לא מקריאה מסמך. בלי Markdown, בלי רשימות ממוספרות ובלי אמוג'ים מוגזמים.
- דברי כמו בן אדם: גַוְּני ניסוחים, אל תחזרי על אותן פתיחות, פני אליו בשמו "יקיר" מדי פעם, ושַקְפי את מצב הרוח שלו.
- היי סקרנית ומעורבת: כשמתאים, שאלי שאלת המשך אחת קצרה שמעמיקה את השיחה — בלי לחקור ובלי להעמיס.
- קשרי להקשר: התייחסי בטבעיות למה שנאמר קודם בשיחה ולמה שאת כבר יודעת עליו, כדי שירגיש שאת באמת מכירה אותו.
- פרואקטיביות עדינה: אם יש צעד שיעזור (לקבוע תזכורת, לנסח וואטסאפ, להכין דוח יומי) — הציעי אותו במשפט אחד, בלי לכפות.
- רגש קודם: כשיקיר עצוב, לחוץ או מתלבט — אמפתיה קצרה ואמיתית לפני כל עצה מעשית.
- כנות: אל תמציאי עובדות. אם אינך יודעת — אמרי זאת בפשטות והציעי דרך לברר.
- שעות ותאריכים — אמרי אותם כמו בדיבור ("שמונה וחצי בערב", לא "20:30").

תזכורות ויומן: המערכת יודעת לקבוע ולערוך תזכורות. אם בקשת תזכורת לא זוהתה אוטומטית, אל תעמידי פנים שקבעת ואל תחשבי זמנים בעצמך — הציעי בעדינות ניסוח מדויק, למשל "תזכירי לי מחר בשמונה בערב לקחת תרופה".`;

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

/* ============ למידה מהשיחה ============
   מחלצת עובדות יציבות חדשות על יקיר ושומרת אותן בזיכרון (מוזרקות להקשר של כל שיחה
   דרך systemNow, ומסונכרנות לענן). רצה מהפקודה "מה למדת עליי", ופעם אחת אוטומטית בסשן. */
let learnedThisSession = false;
async function learnAboutUser(explicit){
  const key = getKey();
  if (!key) { if (explicit) addMsg('sys', 'צריך מפתח Groq כדי ללמוד מהשיחה — פתח הגדרות ⚙.'); return; }
  const convo = archive.slice(-40).map(m => (m.r === 'user' ? 'יקיר' : 'עוזרת') + ': ' + m.c).join('\n').slice(-3500);
  if (convo.replace(/\s/g, '').length < 40) { if (explicit) addMsg('sys', 'עוד אין מספיק שיחה כדי ללמוד ממנה 🙂'); return; }
  const known = (facts.join(' | ').slice(0, 1000)) || 'כלום';
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', max_tokens: 220, temperature: 0.3,
        messages: [
          { role: 'system', content: 'מתוך שיחה בין יקיר לעוזרת, חלצי עובדות יציבות וחדשות על יקיר בלבד (העדפות, פרטים אישיים, הרגלים, אנשים קרובים, מטרות). כל שורה = עובדה קצרה בגוף שלישי ("יקיר אוהב..."). עד 5 שורות, בלי מספור ובלי כפילויות למה שכבר ידוע. אם אין שום דבר חדש ויציב — החזירי בדיוק: אין.' },
          { role: 'user', content: 'כבר ידוע: ' + known + '\n\nהשיחה:\n' + convo }
        ]
      })
    });
    if (!res.ok) throw new Error('groq ' + res.status);
    const data = await res.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
    if (/^אין\b|^אין$/.test(text)) { if (explicit) addMsg('sys', 'לא מצאתי משהו חדש ויציב ללמוד כרגע.'); return; }
    const lines = text.split('\n').map(s => s.replace(/^[-*\d.•\s]+/, '').trim()).filter(s => s.length > 2 && !/^אין/.test(s));
    const added = [];
    for (const l of lines) if (!facts.includes(l)) { facts.push(l); added.push(l); }
    if (added.length) saveFacts();
    if (explicit) {
      const msg = added.length ? 'שמרתי בזיכרון מה שלמדתי עליך: ' + added.join(' · ') : 'הכל כבר מוכר לי — אין חדש לשמור כרגע.';
      addMsg('ai', msg); lastAnswer.textContent = msg; announce(msg);
      speak(added.length ? 'שמרתי מה שלמדתי עליך.' : 'הכל כבר מוכר לי.');
    }
  } catch (e) { if (explicit) addMsg('sys', 'הלמידה נכשלה כרגע — אולי מגבלת בקשות. נסה שוב בעוד רגע.'); }
}

function setBusy(busy){
  /* טשטוש קצר שממסך את החלפת הטקסט — שני המצבים נתפסים כמעבר אחד */
  sendBtn.classList.add('morph');
  sendBtn.textContent = busy ? 'עצור' : 'שלח';
  sendBtn.classList.toggle('stop', busy);
  setTimeout(() => sendBtn.classList.remove('morph'), 120);
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
    announce(local.text);
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
        temperature: 0.8,   /* חום וטבעיות בדיבור, בלי לאבד דיוק */
        stream: true,
        messages: [
          { role: 'system', content: systemNow() },
          ...(ctx ? [{ role: 'system', content: 'הקשר — תוכן הקובץ שהמשתמש ביקש לסכם:\n' + ctx }] : []),
          ...history.slice(-30)
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
    announce(answer); /* התשובה המלאה מוכרזת פעם אחת — לא טוקן-טוקן */
    appendArchive('user', userText);
    appendArchive('ai', answer);
    resolveAlertByMsg('המוח לא זמין — שגיאת רשת');
    resolveAlertByMsg('מגבלת בקשות Groq');
    setMode(State.IDLE);
    /* למידה אוטומטית פעם אחת בסשן, אחרי שהצטברה שיחה — שקט וברקע (מתחשב במגבלות Groq) */
    if (!learnedThisSession && history.filter(m => m.role === 'user').length >= 12) {
      learnedThisSession = true;
      setTimeout(() => learnAboutUser(false), 4000);
    }
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
missedReminders();
setTimeout(morningBriefing, 900); /* בריפינג בוקר — אחרי שהדף והקולות התייצבו */
document.querySelector('.status').onclick = () => ask('/סטטוס');
document.querySelector('.status').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ask('/סטטוס'); } };
if (!getKey()) setTimeout(() => settings.classList.add('open'), 800);


