/* ============ שכבת מובייל (Capacitor) — התראות נייטיב לתזכורות ============
   בדפדפן רגיל זה no-op מוחלט (אין window.Capacitor). באפליקציה הנייטיבית
   התזכורות נקבעות כהתראות מקומיות שקופצות גם כשהאפליקציה סגורה/ברקע. */
const Cap = window.Capacitor;
const IS_NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
function nativePlugin(name){ return Cap && Cap.Plugins && Cap.Plugins[name]; }

/* מזהה התראה יציב בגודל int32 (חלק מהפלטפורמות דורשות int) */
function notifId(ev){ return (Math.abs((ev.id || ev.ts) % 2147483000)) || 1; }

/* בקשת הרשאת התראות פעם אחת — באפליקציה הנייטיבית בלבד */
if (IS_NATIVE) {
  const LN = nativePlugin('LocalNotifications');
  if (LN) { try { LN.requestPermissions(); } catch (e) {} }
}

/* סנכרון כל התזכורות הקרובות להתראות נייטיב.
   נקרא בכל שינוי ביומן (מתוך saveEvents). מבטל את הקיימות וקובע מחדש. */
async function syncNativeReminders(){
  if (!IS_NATIVE) return;
  const LN = nativePlugin('LocalNotifications');
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    if (pending && pending.notifications && pending.notifications.length)
      await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });

    const list = (typeof events !== 'undefined' ? events : [])
      .filter(e => !e.done && e.ts > Date.now())
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 60); /* תקרת מערכת ההפעלה להתראות ממתינות */

    const notifications = list.map(e => ({
      id: notifId(e),
      title: 'DRAY·AI — תזכורת',
      body: e.title,
      schedule: e.repeat === 'daily'  ? { at: new Date(e.ts), every: 'day',  repeats: true }
              : e.repeat === 'weekly' ? { at: new Date(e.ts), every: 'week', repeats: true }
              :                         { at: new Date(e.ts) }
    }));
    if (notifications.length) await LN.schedule({ notifications });
  } catch (e) {}
}

/* שורת סטטוס כהה תואמת הנושא — נייטיב בלבד */
if (IS_NATIVE) {
  const SB = nativePlugin('StatusBar');
  if (SB) { try { SB.setStyle({ style: 'DARK' }); SB.setBackgroundColor({ color: '#04070d' }); } catch (e) {} }
}
