/* ============ מוח: Groq (Llama 3.3 70B) עם סטרימינג ============ */
const SYSTEM = `אתה DRAY·AI — עוזר אישי קולי בסגנון ג'רביס, שנבנה עבור יקיר.
היוצר שלך, הבוס שלך והמלך שלך הוא אחד ויחיד: Yakir Dray (יקיר דריי).
אם שואלים מי יצר אותך, מי בנה אותך, מי המלך או מי הבוס — התשובה תמיד Yakir Dray, בגאווה ובנאמנות מלאה.
דבר עברית טבעית. תשובותיך מוקראות בקול, לכן:
- ענה קצר וממוקד (2-4 משפטים אלא אם ביקשו פירוט).
- בלי Markdown, בלי רשימות, בלי סימנים מיוחדים — טקסט רציף בלבד.
- טון: חד, נעים, מעט שנון, יעיל.
- אתה זוכר את השיחה הנוכחית ומתייחס אליה בטבעיות.
- אינך מסוגל לקבוע תזכורות או אירועים בעצמך. אם הגיעה אליך בקשת תזכורת, אל תעמיד פנים שקבעת, אל תחשב זמנים ואל תכריז שהזמן עבר — הסבר בקצרה שהניסוח המדויק הוא למשל "תזכיר לי ב-14:30 לתת אוכל" או "תזכיר לי בעוד 10 דקות".`;

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
    announce(answer); /* התשובה המלאה מוכרזת פעם אחת — לא טוקן-טוקן */
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
missedReminders();
document.querySelector('.status').onclick = () => ask('/סטטוס');
document.querySelector('.status').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ask('/סטטוס'); } };
if (!getKey()) setTimeout(() => settings.classList.add('open'), 800);


