/* ============ וואטסאפ: ניסוח הודעה + קישור שליחה ============ */
/* פירוק בקשת וואטסאפ למספר, נמען, טקסט מפורש (אחרי נקודתיים) וכוונה לניסוח */
function parseWhatsApp(t){
  /* מספר טלפון — 8+ ספרות עם רווחים/מקפים אפשריים */
  let number = '';
  const pn = t.match(/\+?\d[\d\-\s]{6,}\d/);
  if (pn) number = pn[0];

  /* נמען — השם שאחרי "וואטסאפ ל…" או אחרי פועל השליחה */
  let recipient = '';
  const rm = t.match(/(?:וואטסאפ|ווטסאפ|וואצאפ|whatsapp)\s+ל([^\s:,.]+)/i)
        || t.match(/^(?:אנא |בבקשה )?(?:שלח|תשלח|שלחי|כתוב|תכתוב|כתבי|נסח|תנסח)(?:י)?\s+(?:הודעה\s+)?ל([^\s:,.]+)/);
  if (rm && rm[1].length >= 2 && !/[\d+]/.test(rm[1]) && !['שלוח','כתוב','נסח'].includes(rm[1])) recipient = rm[1];

  /* טקסט מפורש — כל מה שאחרי נקודתיים נשלח כמו שהוא, בלי מודל */
  const ci = t.indexOf(':');
  const literal = ci !== -1 ? t.slice(ci + 1).trim() : '';

  /* כוונה — המשפט מנוקה מפעלים, ממילת "וואטסאפ", מהנמען ומהמספר */
  let intent = t
    .replace(/^(?:אנא |בבקשה )?(?:שלח|תשלח|שלחי|כתוב|תכתוב|כתבי|נסח|תנסח|תגיד|תשדר|הודעה|הודעת)(?:י)?\s*/, '')
    .replace(/(?:הודעת\s+)?(?:ב)?(?:וואטסאפ|ווטסאפ|וואצאפ|whatsapp)/ig, ' ');
  if (recipient) intent = intent.replace(new RegExp('(^|\\s)ל' + recipient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), ' ');
  if (number) intent = intent.replace(new RegExp('ל?\\s*' + number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), ' '); /* גם ה"ל" שלפני המספר */
  intent = intent
    .replace(/:[\s\S]*/, ' ')                                   /* את החלק המפורש כבר תפסנו */
    .replace(/^\s*(?:הודעה|לו|לה|להם|לי|אליו|אליה|אליהם)\s+/, '')
    .replace(/^\s*ל\s+/, ' ')                                  /* "ל" יתום שנשאר לפני המספר */
    .replace(/^\s*ש(?=[א-ת])/, '')                             /* "שאני אאחר" → "אני אאחר" */
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { number, recipient, literal, intent };
}

/* מספר ישראלי/בינלאומי → פורמט wa.me (ספרות בלבד, עם קידומת מדינה) */
function waPhone(raw){
  if (!raw) return '';
  let dg = raw.replace(/\D/g, '');
  if (!dg) return '';
  if (dg.startsWith('972')) return dg;
  if (dg.startsWith('0')) return '972' + dg.slice(1);
  if (dg.length <= 9) return '972' + dg;   /* מספר ישראלי בלי אפס מוביל */
  return dg;
}
function waLink(number, text){
  const n = waPhone(number);
  const q = 'text=' + encodeURIComponent(text);
  return n ? 'https://wa.me/' + n + '?' + q : 'https://wa.me/?' + q;
}

/* אנשי קשר: משלים מספר שמור לפי שם ("שלח לאמא" → המספר שלה), ושומר שם+מספר חדשים */
function resolveContactNumber(recipient, number){
  if (!recipient || typeof contacts === 'undefined') return number;
  const found = contacts.find(c => c.name === recipient) || contacts.find(c => c.name && (c.name.includes(recipient) || recipient.includes(c.name)));
  if (!number && found && found.phone) return found.phone;   /* השלמה משם */
  const norm = waPhone(number);
  if (norm) {                                                /* שמירה לפעם הבאה */
    const ex = contacts.find(c => c.name === recipient);
    if (ex) { if (ex.phone !== norm) { ex.phone = norm; if (typeof saveContacts === 'function') saveContacts(); } }
    else { contacts.push({ name: recipient, phone: norm }); if (typeof saveContacts === 'function') saveContacts(); }
  }
  return number;
}

/* כפתור־קישור ירוק בתמלול — פותח את וואטסאפ עם ההודעה מוכנה */
function addWhatsAppAction(link, number, recipient){
  const wrap = document.createElement('div');
  wrap.className = 'msg ai wa-action';
  const a = document.createElement('a');
  a.href = link;
  a.target = '_blank';
  a.rel = 'noopener';
  a.className = 'wa-send-btn';
  a.textContent = '💬 שלח בוואטסאפ' + (recipient ? ' ל' + recipient : waPhone(number) ? '' : ' (בחר איש קשר)');
  a.setAttribute('aria-label', 'פתח את וואטסאפ עם ההודעה מוכנה לשליחה');
  wrap.appendChild(a);
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
  return a;
}

/* ניסוח גוף ההודעה במוח (Groq) — מחזיר טקסט בלבד */
async function draftWhatsApp(key, intent, recipient){
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'את מנסחת הודעות וואטסאפ קצרות, טבעיות, חמות ומנומסות בעברית עבור יקיר. '
          + 'החזירי אך ורק את גוף ההודעה עצמה — בלי מרכאות, בלי הקדמה, בלי הסבר ובלי חתימה. התאימי את הטון לנמען.' },
        { role: 'user', content: (recipient ? 'נמען: ' + recipient + '\n' : '') + 'ההודעה צריכה להעביר: ' + intent }
      ]
    })
  });
  if (!res.ok) throw new Error('groq ' + res.status);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content || '').replace(/^["'“”\s]+|["'“”\s]+$/g, '').trim();
}

/* התזמור: מנסח (או משתמש בטקסט מפורש), מציג את ההודעה ואת קישור השליחה */
async function composeWhatsApp({ number, recipient, literal, intent }){
  number = resolveContactNumber(recipient, number); /* השלמה/שמירה של איש קשר */
  const typing = addTyping();
  let msg = literal;
  if (!msg) {
    const key = getKey();
    if (key && intent) {
      try { msg = await draftWhatsApp(key, intent, recipient); } catch(e){}
    }
    if (!msg) msg = intent;   /* בלי מפתח/אם נכשל — שולחים את מה שנאמר כמו שהוא */
  }
  typing.remove();
  msg = (msg || '').trim();
  if (!msg) {
    addMsg('sys', 'לא הבנתי מה לשלוח. נסה: "שלח וואטסאפ לאמא שאני אאחר בעשר דקות".');
    return;
  }
  addMsg('ai', msg);
  addWhatsAppAction(waLink(number, msg), number, recipient);
  const conf = recipient ? 'ניסחתי הודעה ל' + recipient + '. לחץ על הכפתור לשליחה בוואטסאפ.'
    : 'הנה ההודעה. לחץ על הכפתור כדי לשלוח בוואטסאפ.';
  lastAnswer.textContent = conf;
  announce(conf + ' ' + msg);
  appendArchive('ai', 'וואטסאפ' + (recipient ? ' ל' + recipient : '') + ': ' + msg);
  speak(conf);
}


/* ============ דוח משימות יומי/שבועי → הודעת וואטסאפ ============ */
/* איתור נמען/מספר בפקודת הדוח ("...לאמא בוואטסאפ", "...ל052...") */
function waTargetFrom(t){
  let number = '';
  const pn = t.match(/\+?\d[\d\-\s]{6,}\d/);
  if (pn) number = pn[0];
  let recipient = '';
  const m = t.match(/(?:וואטסאפ|ווטסאפ|וואצאפ|whatsapp)\s+ל([א-ת]{2,}(?:\s[א-ת]+)?)/i)
        || t.match(/ל([א-ת]{2,})\s+(?:בוואטסאפ|בווטסאפ|בוואצאפ)/)
        || t.match(/ל([א-ת]{2,}(?:\s[א-ת]+)?)\s*$/);
  if (m) recipient = m[1].trim();
  /* מילות היקף/זמן אינן שם של נמען */
  if (/^(היום|מחר|מחרתיים|הערב|הבוקר|הצהריים|שבוע|השבוע|יום|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|וואטסאפ|ווטסאפ|וואצאפ|משימות|רשימת)$/.test(recipient)) recipient = '';
  return { number, recipient };
}

/* טווח הדוח לפי הניסוח: היום (ברירת מחדל) / מחר / מחרתיים / יום בשבוע / השבוע */
function reportRange(t){
  const now = new Date();
  if (/שבוע/.test(t)) {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    return { from: from.getTime(), to: from.getTime() + 7 * 86400000, weekly: true, label: 'השבוע הקרוב' };
  }
  const d = new Date(now);
  if (/מחרתיים/.test(t)) d.setDate(d.getDate() + 2);
  else if (/מחר/.test(t)) d.setDate(d.getDate() + 1);
  else {
    const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    for (let i = 0; i < 7; i++) {
      if (new RegExp('ב?יום ' + days[i]).test(t)) { d.setDate(d.getDate() + ((i - now.getDay() + 7) % 7 || 7)); break; }
    }
  }
  const from = new Date(d); from.setHours(0, 0, 0, 0);
  return { from: from.getTime(), to: from.getTime() + 86400000, weekly: false,
    label: d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }) };
}

/* בניית טקסט הדוח — ממוספר, עם שעות, נקי וקריא לוואטסאפ */
function buildDailyReport(t){
  const r = reportRange(t);
  const list = events.filter(e => e.ts >= r.from && e.ts < r.to).sort((a, b) => a.ts - b.ts);
  let text = '📋 דוח משימות — ' + r.label;
  if (!list.length) {
    text += '\n\nאין משימות מתוכננות. יום פנוי לגמרי 🌿';
  } else {
    const lines = list.map((e, i) => {
      const dt = new Date(e.ts);
      const time = dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const day = r.weekly ? dt.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ', ' : '';
      return (i + 1) + '. ' + day + time + ' — ' + e.title;
    });
    text += '\n\n' + lines.join('\n') + '\n\nסה״כ ' + list.length + (list.length === 1 ? ' משימה.' : ' משימות.');
  }
  const { number, recipient } = waTargetFrom(t);
  return { text, number, recipient, count: list.length, label: r.label };
}

/* מציגה את הדוח בתמלול + כפתור שליחה מוכן בוואטסאפ */
function composeTaskReport(t){
  const r = buildDailyReport(t);
  const { text, recipient, count, label } = r;
  const number = resolveContactNumber(recipient, r.number); /* השלמה/שמירה של איש קשר */
  addMsg('ai', text);
  addWhatsAppAction(waLink(number, text), number, recipient);
  const conf = 'הכנתי דוח משימות — ' + label + (count ? ' (' + count + (count === 1 ? ' משימה' : ' משימות') + ')' : '')
    + '. הקישור לשליחה בוואטסאפ' + (recipient ? ' ל' + recipient : '') + ' מחכה למטה.';
  lastAnswer.textContent = conf;
  announce(conf);
  appendArchive('ai', text);
  speak(recipient ? 'הכנתי דוח מוכן לשליחה ל' + recipient + '.' : 'הכנתי לך דוח משימות מוכן לשליחה בוואטסאפ.');
}
