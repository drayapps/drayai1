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
