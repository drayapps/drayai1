/* ============ לוח שנה חזותי — דיאלוג נגיש ============ */
const calendar = document.getElementById('calendar');
const calGrid = document.getElementById('calGrid');
const calTitle = document.getElementById('calTitle');
const calDayEvents = document.getElementById('calDayEvents');
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HE_DOW = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
let calView = new Date();       /* החודש המוצג */
let calSelected = null;         /* היום הנבחר (Date) */
let calReturnFocus = null;

const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
/* כל אירועי היומן ליום מסוים (כולל שכבר "נורו") — לוח שנה מציג הכול */
function eventsOnDay(ts){
  const from = dayStart(ts), to = from + 86400000;
  return events.filter(e => e.ts >= from && e.ts < to).sort((a, b) => a.ts - b.ts);
}

/* animate=true רק כשמגיע תוכן חדש (פתיחה / מעבר חודש); בבחירת יום או מחיקה — בלי כניסה מחדש */
function renderCalendar(animate){
  const y = calView.getFullYear(), m = calView.getMonth();
  calTitle.textContent = HE_MONTHS[m] + ' ' + y;
  calGrid.innerHTML = '';
  HE_DOW.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-dow';
    h.textContent = d;
    calGrid.appendChild(h);
  });
  const first = new Date(y, m, 1).getDay();      /* 0=ראשון */
  const days = new Date(y, m + 1, 0).getDate();
  const todayTs = dayStart(Date.now());
  const selTs = calSelected ? dayStart(calSelected) : null;
  for (let i = 0; i < first; i++) {
    const b = document.createElement('div');
    b.className = 'cal-cell blank';
    calGrid.appendChild(b);
  }
  for (let d = 1; d <= days; d++) {
    const ts = dayStart(new Date(y, m, d));
    const cell = document.createElement('button');
    cell.className = 'cal-cell';
    cell.textContent = d;
    cell.dataset.ts = ts;
    if (animate) {
      /* סטגר לפי שורות — מטאטא מלמעלה למטה, 40ms/שורה (בתוך טווח 30–80) */
      const row = Math.floor((first + d - 1) / 7);
      cell.style.animationDelay = Math.min(row * 40, 200) + 'ms';
    } else {
      cell.style.animation = 'none'; /* רה-רנדר בתוך אותו חודש — בלי כניסה שמשתחזרת */
    }
    const evs = eventsOnDay(ts);
    if (evs.length) {
      cell.classList.add('has-ev');
      cell.setAttribute('aria-label', d + ' ב' + HE_MONTHS[m] + ', ' + evs.length + ' אירועים');
    } else {
      cell.setAttribute('aria-label', d + ' ב' + HE_MONTHS[m]);
    }
    if (ts === todayTs) cell.classList.add('today');
    if (ts < todayTs) cell.classList.add('past');
    if (selTs && ts === selTs) cell.classList.add('selected');
    cell.onclick = () => selectDay(new Date(y, m, d), true);
    calGrid.appendChild(cell);
  }
}

/* עדכון היום הנבחר במקום — בלי לבנות מחדש את הרשת */
function markSelected(ts){
  calGrid.querySelectorAll('.cal-cell.selected').forEach(c => c.classList.remove('selected'));
  const cell = calGrid.querySelector('.cal-cell[data-ts="' + ts + '"]');
  if (cell) cell.classList.add('selected');
}

/* בחירת יום — מציג את אירועיו ומקריא אותם בקול. לא בונה מחדש את הרשת. */
function selectDay(date, speakOut){
  calSelected = date;
  markSelected(dayStart(date));
  const evs = eventsOnDay(date.getTime());
  const label = date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  calDayEvents.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'cal-de-title';
  head.textContent = label;
  calDayEvents.appendChild(head);
  if (!evs.length) {
    const e = document.createElement('div');
    e.className = 'cal-de-empty';
    e.textContent = 'אין אירועים ביום זה.';
    calDayEvents.appendChild(e);
  } else {
    evs.forEach(ev => {
      const row = document.createElement('div');
      row.className = 'cal-ev';
      const tm = document.createElement('span');
      tm.className = 'cal-ev-time';
      tm.textContent = new Date(ev.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const ti = document.createElement('span');
      ti.className = 'cal-ev-title';
      ti.textContent = ev.title;
      const del = document.createElement('button');
      del.className = 'cal-ev-del';
      del.textContent = '✕';
      del.setAttribute('aria-label', 'מחק את ' + ev.title);
      del.onclick = () => {
        events = events.filter(x => x !== ev);
        saveEvents();
        renderCalendar(false); /* עדכון נקודות בלי אנימציית כניסה */
        selectDay(date, false);
        announce('נמחק: ' + ev.title);
      };
      row.append(tm, ti, del);
      calDayEvents.appendChild(row);
    });
  }
  /* הקראה בקול — מה יש ביום שנבחר */
  if (speakOut) {
    const spoken = evs.length
      ? label + '. יש לך ' + evs.length + (evs.length === 1 ? ' אירוע: ' : ' אירועים: ')
        + evs.map(e => new Date(e.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ', ' + e.title).join('; ')
      : label + '. אין אירועים ביום זה.';
    announce(spoken);
    speak(spoken);
  }
}

function openCalendar(speakToday){
  calReturnFocus = document.activeElement;
  calView = new Date();
  calSelected = new Date();
  calendar.classList.add('open');
  renderCalendar(true); /* כניסה עם סטגר — פעם אחת בפתיחה */
  selectDay(new Date(), !!speakToday);
  document.getElementById('closeCal').focus();
}
function closeCalendar(){
  calendar.classList.remove('open');
  if (HAS_TTS) speechSynthesis.cancel();
  if (calReturnFocus && calReturnFocus.focus) calReturnFocus.focus();
}
document.getElementById('calBtn').onclick = () => openCalendar(true);
document.getElementById('closeCal').onclick = closeCalendar;
document.getElementById('calPrev').onclick = () => { calView.setMonth(calView.getMonth() - 1); renderCalendar(true); };
document.getElementById('calNext').onclick = () => { calView.setMonth(calView.getMonth() + 1); renderCalendar(true); };
document.getElementById('calToday').onclick = () => { calView = new Date(); renderCalendar(true); selectDay(new Date(), true); };
calendar.addEventListener('click', e => { if (e.target === calendar) closeCalendar(); });
/* מלכודת פוקוס */
calendar.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const f = calendar.querySelectorAll('button:not([disabled])');
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

