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
}

async function onAuth(session){
  const u = session && session.user;
  const wasIn = !!cloudUser;
  cloudUser = u || null;
  updateAuthUI();
  if (cloudUser && !wasIn) {
    setSyncStatus('מסנכרן…');
    try { await mergeThenPull(); setSyncStatus('מסונכרן ✓'); }
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

initSupabase();
