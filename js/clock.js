/**
 * 大厅时钟（24 小时制 + 日期 + 节日）
 */
const HubClock = (function () {
  let dateEl, timeEl, festivalEl;
  let timerId = null;

  function tick() {
    const now = new Date();
    if (dateEl) dateEl.textContent = HolidayCalendar.formatDate(now);
    if (timeEl) timeEl.textContent = HolidayCalendar.formatTime(now);
    if (festivalEl) {
      const label = HolidayCalendar.formatFestivalLabel(now);
      festivalEl.textContent = label;
      festivalEl.classList.toggle('clock-festival--holiday', label !== '平日');
    }
  }

  function start() {
    dateEl = document.getElementById('clock-date');
    timeEl = document.getElementById('clock-time');
    festivalEl = document.getElementById('clock-festival');
    if (!dateEl || !timeEl) return;
    tick();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  }

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  return { start, stop };
})();
