// LEGACY / SUPERSEDED HELPER (not loaded by index.html)
// Service Worker registration, hash navigation, and privacy-safe reminder scheduling
// are handled directly inside index.html and sw.js.
// Kept aligned with MR.Pharma's reminder schema ({ id, name, time, notes, active, createdAt })
// and lock-screen privacy rules in case loaded externally.

(function () {
  function isSwAllowed() {
    try {
      const loc = window.location;
      if (!loc || loc.protocol === 'file:') return false;
      const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.hostname === '[::1]';
      return loc.protocol === 'https:' || Boolean(window.isSecureContext) || (loc.protocol === 'http:' && isLocal);
    } catch (e) {
      return false;
    }
  }

  // Register Service Worker only if not already handled by index.html and on a valid origin
  if ('serviceWorker' in navigator && isSwAllowed()) {
    window.addEventListener('load', () => {
      if (window.__pharmdSwStatus) return;
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then((reg) => { window.__pharmdSwStatus = 'registered'; console.log('Service Worker Ready!', reg.scope); })
        .catch((err) => console.warn('Service Worker Error:', err));
    });
  }

  // Hash navigation fallback for browser Back button
  window.addEventListener('hashchange', () => {
    const currentModule = location.hash.replace('#', '') || 'dashboard';
    if (typeof switchModule === 'function') {
      switchModule(currentModule);
    }
  });

  // Aligned, privacy-safe reminder background helper (omits patient names/free-text from OS notifications)
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof window.sendReminderToBackground === 'undefined') {
      window.sendReminderToBackground = function (reminder) {
        if (!reminder || !reminder.time) return;
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const match = /^(\d{1,2}):(\d{2})$/.exec(String(reminder.time).trim());
          if (!match) return;
          const now = new Date();
          const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
          let delay = target.getTime() - now.getTime();
          if (delay < 0) delay += 24 * 60 * 60 * 1000;

          const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'ar';
          const isEn = lang === 'en';
          navigator.serviceWorker.controller.postMessage({
            type: 'SCHEDULE_REMINDER',
            payload: {
              id: reminder.id || Date.now(),
              time: reminder.time,
              lang: lang,
              // Privacy-safe generic text: intentionally omits reminder.name / patient identifiers
              title: isEn ? 'MR.Pharma — Medication Reminder' : 'MR.Pharma — منبه الدواء',
              body: isEn
                ? 'It is time for your scheduled medication reminder. Open MR.Pharma to view details.'
                : 'حان موعد تنبيه الدواء المجدول. افتح MR.Pharma لعرض التفاصيل.',
              delay: delay
            }
          });
        }
      };
    }
  });
})();
