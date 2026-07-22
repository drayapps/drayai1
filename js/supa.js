/* ============ Supabase: התחברות Google + סנכרון ענן ============
   הלקוח נטען מ-CDN (window.supabase). כשלא מחוברים / אין רשת — האפליקציה
   עובדת בדיוק כמו קודם (localStorage). בהתחברות: מיזוג מקומי→ענן ואז הענן
   הופך למקור האמת, ומאותו רגע כל שינוי נדחף לענן. */
const SUPABASE_URL = 'https://obyxmabgelvqinwdfuwq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6Bu2GJ1rLtfpIn9XnOW8yg_klVwf16V';

let sb = null;
let cloudUser = null;
let cloudApplying = false;   /* בזמן משיכה מהענן — לא דוחפים בחזרה (מניעת לולאה) */

function initSupabase(){
  if (!window.supabase || !window.supabase.createClient) return;
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  sb.auth.onAuthStateChange((_e, session) => onAuth(session));
  sb.auth.getSession().then(({ data }) => onAuth(data && data.session));
  wireAuthButtons();
  checkAuthError();
}

/* אם חזרנו מ-OAuth עם שגיאה בכתובת — מציגים אותה במקום להיתקע בשקט */
function checkAuthError(){
  const p = new URLSearchParams(location.search);
  const err = p.get('error_description') || p.get('error');
  if (!err) return;
  const msg = decodeURIComponent(err).replace(/\+/g, ' ');
  if (typeof addAlert === 'function')
    addAlert(1, 'התחברות Google נכשלה: ' + msg, 'ודא ש-Site URL וה-Redirect URLs ב-Supabase תואמים לכתובת שבה פתחת את האפליקציה');
  try { history.replaceState({}, '', location.origin + location.pathname); } catch(e){}
}

async function onAuth(session){
  const u = session && session.user;
  const wasIn = !!cloudUser;
  cloudUser = u || null;
  updateAuthUI();
  if (typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
  if (cloudUser && !wasIn) {
    setSyncStatus('מסנכרן…');
    try { await mergeThenPull(); setSyncStatus('מסונכרן ✓'); renderProfileIfOpen(); }
    catch (e) { setSyncStatus('שגיאת סנכרון'); }
  }
}

/* ----- UI ----- */
function wireAuthButtons(){
  const inBtn = document.getElementById('googleSignIn');
  const outBtn = document.getElementById('signOutBtn');
  if (inBtn) inBtn.onclick = async () => {
    if (!sb) return;
    const redirectTo = location.origin + location.pathname;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setSyncStatus('שגיאה: ' + error.message);
  };
  if (outBtn) outBtn.onclick = async () => { if (sb) await sb.auth.signOut(); setSyncStatus(''); };
}
function updateAuthUI(){
  const out = document.getElementById('authLoggedOut');
  const inn = document.getElementById('authLoggedIn');
  if (!out || !inn) return;
  if (cloudUser) {
    out.style.display = 'none';
    inn.style.display = 'block';
    const m = cloudUser.user_metadata || {};
    const name = m.full_name || m.name || cloudUser.email || 'מחובר';
    const nameEl = document.getElementById('authName');
    const avEl = document.getElementById('authAvatar');
    if (nameEl) nameEl.textContent = name;
    if (avEl) { if (m.avatar_url || m.picture) { avEl.src = m.avatar_url || m.picture; avEl.style.display = ''; } else avEl.style.display = 'none'; }
  } else {
    out.style.display = 'block';
    inn.style.display = 'none';
  }
}
function setSyncStatus(t){ const el = document.getElementById('syncStatus'); if (el) el.textContent = t; }

/* ----- מיפוי אירוע ↔ שורת tasks ----- */
const evToRow = e => ({ title: e.title, scheduled_at: new Date(e.ts).toISOString(), done: !!e.done, repeat: e.repeat || null });
const rowToEv = t => ({ cid: t.id, id: Date.parse(t.scheduled_at) || Date.now(), ts: Date.parse(t.scheduled_at), title: t.title, done: !!t.done, repeat: t.repeat || null });

/* ----- סנכרון ----- */
async function mergeThenPull(){
  await pushTasks();   /* מעלה אירועים מקומיים שעדיין לא בענן */
  await pushFacts();
  await pushContacts();
  await pushMessagesSeedIfEmpty();
  await pushPrefs();
  await pullAll();     /* ואז הענן = מקור האמת */
}

async function pushTasks(){
  if (!sb || !cloudUser) return;
  const { data: cloud } = await sb.from('tasks').select('id');
  const cloudIds = new Set((cloud || []).map(r => r.id));
  const keep = new Set();
  for (const e of events) {
    if (e.cid) {
      keep.add(e.cid);
      await sb.from('tasks').update(evToRow(e)).eq('id', e.cid);
    } else {
      const { data } = await sb.from('tasks').insert(evToRow(e)).select('id').single();
      if (data) { e.cid = data.id; keep.add(data.id); }
    }
  }
  const del = [...cloudIds].filter(id => !keep.has(id));
  if (del.length) await sb.from('tasks').delete().in('id', del);
  store.set('dray_events', JSON.stringify(events)); /* לשמור את ה-cid */
}

async function pushFacts(){
  if (!sb || !cloudUser) return;
  const { data } = await sb.from('facts').select('content');
  const have = new Set((data || []).map(r => r.content));
  const add = facts.filter(c => !have.has(c));
  if (add.length) await sb.from('facts').insert(add.map(c => ({ content: c })));
}

async function pushContacts(){
  if (!sb || !cloudUser || typeof contacts === 'undefined') return;
  const { data } = await sb.from('contacts').select('name');
  const have = new Set((data || []).map(r => r.name));
  const add = contacts.filter(c => c && c.name && !have.has(c.name));
  if (add.length) await sb.from('contacts').insert(add.map(c => ({ name: c.name, phone: c.phone || null })));
}

/* שמירת הודעת שיחה בודדת ב-messages (append-only) */
async function cloudPushMessage(role, content){
  if (!sb || !cloudUser || cloudApplying) return;
  const r = role === 'user' ? 'user' : (role === 'ai' ? 'ai' : 'sys');
  try { await sb.from('messages').insert({ role: r, content: content }); } catch (e) {}
}

/* בהתחברות ראשונה: אם אין עדיין שיחות בענן — מזרעים את הארכיון המקומי (חד-פעמי, בלי כפילויות) */
async function pushMessagesSeedIfEmpty(){
  if (!sb || !cloudUser || typeof archive === 'undefined') return;
  const { count } = await sb.from('messages').select('id', { count: 'exact', head: true });
  if ((count || 0) === 0 && archive.length) {
    const rows = archive.slice(-500).map(m => ({
      role: m.r === 'user' ? 'user' : (m.r === 'ai' ? 'ai' : 'sys'),
      content: m.c, created_at: new Date(m.t || Date.now()).toISOString()
    }));
    for (let i = 0; i < rows.length; i += 200) { try { await sb.from('messages').insert(rows.slice(i, i + 200)); } catch (e) {} }
  }
}

async function pushPrefs(){
  if (!sb || !cloudUser) return;
  await sb.from('preferences').upsert({
    user_id: cloudUser.id,
    text_size: store.get('dray_textsize', 'normal'),
    reduced_motion: store.get('dray_motion', 'full') === 'reduced',
    high_contrast: store.get('dray_contrast', '0') === '1',
    tts_enabled: store.get('dray_tts', '1') === '1',
    conversation_mode: store.get('dray_conv', '0') === '1'
  });
}

async function pullAll(){
  if (!sb || !cloudUser) return;
  cloudApplying = true;
  try {
    const { data: tasks } = await sb.from('tasks').select('*').order('scheduled_at');
    if (tasks) { events = tasks.map(rowToEv); store.set('dray_events', JSON.stringify(events)); }
    const { data: f } = await sb.from('facts').select('content').order('created_at');
    if (f) { facts = f.map(r => r.content); store.set('dray_facts', JSON.stringify(facts)); }
    const { data: p } = await sb.from('preferences').select('*').eq('user_id', cloudUser.id).maybeSingle();
    if (p) {
      store.set('dray_textsize', p.text_size);
      store.set('dray_motion', p.reduced_motion ? 'reduced' : 'full');
      store.set('dray_contrast', p.high_contrast ? '1' : '0');
      store.set('dray_tts', p.tts_enabled ? '1' : '0');
      store.set('dray_conv', p.conversation_mode ? '1' : '0');
      if (typeof applyPrefs === 'function') applyPrefs();
      if (typeof ttsChk !== 'undefined') ttsChk.checked = p.tts_enabled;
      if (typeof convChk !== 'undefined') convChk.checked = p.conversation_mode;
    }
    if (typeof calendar !== 'undefined' && calendar.classList.contains('open')) {
      renderCalendar(); if (calSelected) selectDay(calSelected, false);
    }
  } finally { cloudApplying = false; }
}

/* ----- הוקים (נקראים מ-saveEvents/saveFacts ומההעדפות). מוגנים לחלוטין. ----- */
let _tTasks = null, _tFacts = null, _tPrefs = null;
function cloudPushTasks(){ if (!cloudUser || cloudApplying) return; clearTimeout(_tTasks); _tTasks = setTimeout(() => pushTasks().then(() => setSyncStatus('מסונכרן ✓')).catch(() => setSyncStatus('שגיאת סנכרון')), 800); }
function cloudPushFacts(){ if (!cloudUser || cloudApplying) return; clearTimeout(_tFacts); _tFacts = setTimeout(() => pushFacts().catch(() => {}), 800); }
function cloudPushPrefs(){ if (!cloudUser || cloudApplying) return; clearTimeout(_tPrefs); _tPrefs = setTimeout(() => pushPrefs().catch(() => {}), 500); }

/* ============ מסך פרופיל ============ */
let profileReturnFocus = null;
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

function renderProfile(){
  const body = document.getElementById('profileBody');
  if (!body) return;

  if (!cloudUser) {
    body.innerHTML = '<div class="profile-empty"><div class="profile-avatar big" aria-hidden="true">👤</div>'
      + '<p>התחברי עם Google כדי לראות את הפרופיל שלך ולסנכרן משימות, זיכרון והעדפות בין המכשירים.</p></div>';
    const b = document.createElement('button');
    b.className = 'google-btn'; b.type = 'button'; b.textContent = 'התחבר עם Google';
    b.onclick = () => { const g = document.getElementById('googleSignIn'); if (g) g.click(); };
    body.querySelector('.profile-empty').appendChild(b);
    return;
  }

  const m = cloudUser.user_metadata || {};
  const name = m.full_name || m.name || cloudUser.email || 'משתמש';
  const email = cloudUser.email || '';
  const avatar = m.avatar_url || m.picture || '';
  const joined = cloudUser.created_at ? new Date(cloudUser.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const evs = (typeof events !== 'undefined') ? events : [];
  const upcoming = (typeof listEvents === 'function') ? listEvents(Date.now(), Infinity) : evs.filter(e => !e.done && e.ts >= Date.now());
  const recurring = evs.filter(e => e.repeat).length;
  const factCount = (typeof facts !== 'undefined') ? facts.length : 0;
  const archiveCount = (typeof archive !== 'undefined') ? archive.length : 0;
  const sizeLbl = { normal: 'רגיל', large: 'גדול', xl: 'ענק' }[store.get('dray_textsize', 'normal')] || 'רגיל';
  const ttsOn = store.get('dray_tts', '1') === '1';

  const nextList = upcoming.slice(0, 3).map(e =>
    '<div class="pf-ev"><span class="pf-ev-t">' + esc(new Date(e.ts).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }))
    + '</span><span class="pf-ev-title">' + esc(e.title) + '</span>' + (e.repeat ? '<span class="pf-rep">🔁</span>' : '') + '</div>'
  ).join('') || '<div class="cal-de-empty">אין משימות קרובות — יום פנוי 🌿</div>';

  const avatarHtml = avatar
    ? '<img class="profile-avatar" src="' + esc(avatar) + '" alt="" referrerpolicy="no-referrer">'
    : '<div class="profile-avatar initial" aria-hidden="true">' + esc((name[0] || 'D').toUpperCase()) + '</div>';

  body.innerHTML =
    '<div class="profile-id">' + avatarHtml
    + '<div class="profile-id-txt"><div class="profile-name">' + esc(name) + '</div>'
    + '<div class="profile-email">' + esc(email) + '</div>'
    + '<div class="profile-sync">☁️ מסונכרן עם הענן</div></div></div>'
    + '<div class="stat-grid">'
    + '<div class="stat"><div class="stat-num">' + upcoming.length + '</div><div class="stat-label">משימות קרובות</div></div>'
    + '<div class="stat"><div class="stat-num">' + recurring + '</div><div class="stat-label">תזכורות חוזרות</div></div>'
    + '<div class="stat"><div class="stat-num">' + factCount + '</div><div class="stat-label">פריטי זיכרון</div></div>'
    + '<div class="stat"><div class="stat-num">' + archiveCount + '</div><div class="stat-label">הודעות בארכיון</div></div>'
    + '</div>'
    + '<div class="profile-section"><h3>מה מחכה לך</h3>' + nextList + '</div>'
    + '<div class="profile-section"><h3>העדפות</h3><div class="pf-chips">'
    + '<span class="pf-chip">טקסט: ' + sizeLbl + '</span>'
    + '<span class="pf-chip">קול: ' + (ttsOn ? 'פעיל' : 'כבוי') + '</span>'
    + '<span class="pf-chip">' + (store.get('dray_motion', 'full') === 'reduced' ? 'תנועה מופחתת' : 'תנועה רגילה') + '</span>'
    + (store.get('dray_contrast', '0') === '1' ? '<span class="pf-chip">ניגודיות גבוהה</span>' : '')
    + '</div></div>'
    + '<div class="profile-section"><h3>חשבון</h3><div class="pf-meta">' + esc(email) + (joined ? ' · מחובר מאז ' + esc(joined) : '') + '</div></div>'
    + '<button id="profileSignOut" type="button">התנתק</button>';

  const so = document.getElementById('profileSignOut');
  if (so) so.onclick = async () => { if (sb) await sb.auth.signOut(); closeProfile(); };
}

function renderProfileIfOpen(){
  const dlg = document.getElementById('profile');
  if (dlg && dlg.classList.contains('open')) renderProfile();
}
function openProfile(){
  profileReturnFocus = document.activeElement;
  renderProfile();
  const dlg = document.getElementById('profile');
  if (dlg) dlg.classList.add('open');
  const c = document.getElementById('closeProfile'); if (c) c.focus();
}
function closeProfile(){
  const dlg = document.getElementById('profile');
  if (dlg) dlg.classList.remove('open');
  if (profileReturnFocus && profileReturnFocus.focus) profileReturnFocus.focus();
}

(function wireProfile(){
  const btn = document.getElementById('profileBtn');
  const closeBtn = document.getElementById('closeProfile');
  const dlg = document.getElementById('profile');
  if (btn) btn.onclick = openProfile;
  if (closeBtn) closeBtn.onclick = closeProfile;
  if (dlg) dlg.addEventListener('click', e => { if (e.target === dlg) closeProfile(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && dlg && dlg.classList.contains('open')) closeProfile(); });
  if (dlg) dlg.addEventListener('keydown', e => {  /* מלכודת פוקוס */
    if (e.key !== 'Tab') return;
    const f = dlg.querySelectorAll('button:not([disabled]), a[href]');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();

initSupabase();
