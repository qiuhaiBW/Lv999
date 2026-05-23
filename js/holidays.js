/**
 * 公历固定节日 + 农历节日公历对照（2024–2027）
 */
const HolidayCalendar = (function () {
  const SOLAR = {
    '1-1': '元旦',
    '2-14': '情人节',
    '3-8': '国际妇女节',
    '3-12': '植树节',
    '4-1': '愚人节',
    '5-1': '劳动节',
    '5-4': '青年节',
    '6-1': '儿童节',
    '7-1': '建党节',
    '8-1': '建军节',
    '9-10': '教师节',
    '10-1': '国庆节',
    '12-24': '平安夜',
    '12-25': '圣诞节',
  };

  const SOLAR_RANGES = [
    { start: [4, 4], end: [4, 6], name: '清明节' },
  ];

  const LUNAR_GREGORIAN = [
    { y: 2024, m: 2, d: 10, name: '春节' },
    { y: 2024, m: 2, d: 24, name: '元宵节' },
    { y: 2024, m: 6, d: 10, name: '端午节' },
    { y: 2024, m: 8, d: 10, name: '七夕节' },
    { y: 2024, m: 9, d: 17, name: '中秋节' },
    { y: 2024, m: 10, d: 11, name: '重阳节' },
    { y: 2025, m: 1, d: 29, name: '春节' },
    { y: 2025, m: 2, d: 12, name: '元宵节' },
    { y: 2025, m: 5, d: 31, name: '端午节' },
    { y: 2025, m: 8, d: 29, name: '七夕节' },
    { y: 2025, m: 10, d: 6, name: '中秋节' },
    { y: 2025, m: 10, d: 29, name: '重阳节' },
    { y: 2026, m: 2, d: 17, name: '春节' },
    { y: 2026, m: 3, d: 3, name: '元宵节' },
    { y: 2026, m: 6, d: 19, name: '端午节' },
    { y: 2026, m: 8, d: 19, name: '七夕节' },
    { y: 2026, m: 9, d: 25, name: '中秋节' },
    { y: 2026, m: 10, d: 18, name: '重阳节' },
    { y: 2027, m: 2, d: 6, name: '春节' },
    { y: 2027, m: 2, d: 20, name: '元宵节' },
    { y: 2027, m: 6, d: 9, name: '端午节' },
    { y: 2027, m: 8, d: 8, name: '七夕节' },
    { y: 2027, m: 10, d: 15, name: '中秋节' },
    { y: 2027, m: 10, d: 8, name: '重阳节' },
  ];

  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  function inRange(month, day, start, end) {
    const d = month * 100 + day;
    const a = start[0] * 100 + start[1];
    const b = end[0] * 100 + end[1];
    return d >= a && d <= b;
  }

  function getFestivals(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const names = [];
    const key = `${m}-${d}`;
    if (SOLAR[key]) names.push(SOLAR[key]);

    for (const range of SOLAR_RANGES) {
      if (inRange(m, d, range.start, range.end)) names.push(range.name);
    }

    for (const item of LUNAR_GREGORIAN) {
      if (item.y === y && item.m === m && item.d === d) names.push(item.name);
    }

    return names;
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const w = WEEKDAYS[date.getDay()];
    return `${y}年${m}月${day}日 周${w}`;
  }

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${min}:${s}`;
  }

  function formatFestivalLabel(date) {
    const list = getFestivals(date);
    return list.length ? list.join(' · ') : '平日';
  }

  return { getFestivals, formatDate, formatTime, formatFestivalLabel };
})();
