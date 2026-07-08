/* ============ הכרזות לקוראי מסך (IS 5568) ============ */
const srAnnounce = document.getElementById('srAnnounce');
function announce(text){
  /* איפוס קצר כדי שאותה הודעה פעמיים עדיין תוכרז */
  srAnnounce.textContent = '';
  setTimeout(() => { srAnnounce.textContent = text; }, 30);
}


/* ============ יומן ============ */
function addMsg(role, text){
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  if (role === 'err') d.setAttribute('role', 'alert'); /* שגיאות מוכרזות מיד בקורא מסך */
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
function addTyping(){
  const d = document.createElement('div');
  d.className = 'msg ai typing';
  d.innerHTML = '<i></i><i></i><i></i>';
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
function saveHistory(){
  store.set(HIST_NAME, JSON.stringify(history.slice(-40)));
}
function restoreHistory(){
  try {
    history = JSON.parse(store.get(HIST_NAME, '[]'));
  } catch(e){ history = []; }
  if (!Array.isArray(history)) history = [];
  history.forEach(m => addMsg(m.role === 'user' ? 'user' : 'ai', m.content));
  const lastAi = [...history].reverse().find(m => m.role === 'assistant');
  if (lastAi) lastAnswer.textContent = lastAi.content;
  chips.classList.toggle('hidden', history.length > 0);
}
document.getElementById('clearBtn').onclick = () => {
  history = []; log.innerHTML = '';
  store.set(HIST_NAME, '[]');
  chips.classList.remove('hidden');
  lastAnswer.textContent = 'השיחה נוקתה. הארכיון והעובדות נשמרו — שאל "מה אתה זוכר".';
};

