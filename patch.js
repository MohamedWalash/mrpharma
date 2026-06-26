// كود تشغيل الـ Service Worker من برة برة
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker Ready!', reg.scope))
      .catch((err) => console.error('Service Worker Error:', err));
  });
}

// كود الـ Hash Navigation عشان زرار الـ Back
window.addEventListener('hashchange', () => {
  const currentModule = location.hash.replace('#', '') || 'dashboard';
  if (typeof switchModule === 'function') {
    switchModule(currentModule);
  }
});

// تعديل منطق الـ Reminders تلقائياً أول ما الصفحة تحمل
window.addEventListener('DOMContentLoaded', () => {
  if (typeof sendReminderToBackground === 'undefined') {
    window.sendReminderToBackground = function(reminder) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const now = new Date();
        const reminderTime = new Date(now.toDateString() + ' ' + reminder.time);
        let delay = reminderTime.getTime() - now.getTime();
        if (delay < 0) delay += 24 * 60 * 60 * 1000;

        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_REMINDER',
          payload: {
            id: reminder.id,
            title: `موعد دواء: ${reminder.medName}`,
            body: `جرعة: ${reminder.dosage}`,
            delay: delay
          }
        });
      }
    };
  }
});