/** 通用时间与格式化工具 */

const pad = n => (n < 10 ? `0${n}` : `${n}`);

export function formatTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatMonthDay(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayText(ts) {
  return WEEKDAYS[new Date(ts).getDay()];
}

/** 本地日期字符串，避免 new Date('2026-01-01') 被当成 UTC 解析 */
export function dateKeyOf(ts) {
  return formatDate(ts);
}

export function parseDateTime(dateStr, timeStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00')
    .split(':')
    .map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime();
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ts) {
  return startOfDay(ts) + 24 * 3600 * 1000 - 1;
}

export function addDays(ts, days) {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function isToday(ts) {
  return startOfDay(ts) === startOfDay(Date.now());
}

export function isYesterday(ts) {
  return startOfDay(ts) === startOfDay(addDays(Date.now(), -1));
}

/** 分钟 -> 2小时15分 */
export function durationText(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  if (total < 60) return `${total}分钟`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}小时${m}分` : `${h}小时`;
}

/** 距离某时刻过去了多久 */
export function agoText(ts) {
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return '刚刚';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}小时${rest}分前` : `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

/** 宝宝月龄文案 */
export function ageText(birthday) {
  if (!birthday) return '';
  const birth = parseDateTime(birthday, '00:00');
  if (Number.isNaN(birth) || birth > Date.now()) return '';
  const now = new Date();
  const b = new Date(birth);
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  let anchor = new Date(b.getFullYear(), b.getMonth() + months, b.getDate());
  if (anchor.getTime() > now.getTime()) {
    months -= 1;
    anchor = new Date(b.getFullYear(), b.getMonth() + months, b.getDate());
  }
  const days = Math.floor((now.getTime() - anchor.getTime()) / (24 * 3600 * 1000));
  if (months <= 0) {
    const totalDays = Math.floor((now.getTime() - birth) / (24 * 3600 * 1000));
    return `${Math.max(totalDays, 0)}天`;
  }
  return days > 0 ? `${months}个月${days}天` : `${months}个月`;
}

export function uuid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return n < min ? min : n > max ? max : n;
}

export function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

/** 生成 6 位同步码（去除易混淆字符） */
export function makeSyncCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXY23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** 十六进制颜色转 rgba，用于动态主题色 */
export function hexToRgba(hex, alpha = 1) {
  const value = String(hex || '#ff7b8b').replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map(c => c + c)
          .join('')
      : value.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

let cachedStatusBar = null;

/** 状态栏高度，用于自定义导航栏留白 */
export function statusBarHeight() {
  if (cachedStatusBar !== null) return cachedStatusBar;
  try {
    const info = uni.getSystemInfoSync();
    cachedStatusBar = info.statusBarHeight || 20;
  } catch (e) {
    cachedStatusBar = 20;
  }
  return cachedStatusBar;
}

let cachedNavMetrics = null;

/**
 * 自定义导航栏布局参数。
 *
 * 微信小程序右上角胶囊按钮会盖住自定义导航栏的右侧区域，但只有和胶囊处于同一
 * 水平带的元素才需要避让（通常是标题行）；下面的日期栏、筛选条仍应用满宽度，
 * 否则整个 header 被整体缩进，右侧会空出一大块。所以避让宽度单独给出 rowRightPad，
 * 只作用于标题行。
 */
export function navMetrics() {
  if (cachedNavMetrics) return cachedNavMetrics;
  const statusBar = statusBarHeight();
  let navHeight = 44;
  let windowWidth = 375;
  let capsuleGap = 0;
  let rowRightPad = 0;
  try {
    const info = uni.getSystemInfoSync();
    windowWidth = info.windowWidth || 375;
    const rect =
      typeof uni.getMenuButtonBoundingClientRect === 'function' ? uni.getMenuButtonBoundingClientRect() : null;
    if (rect && rect.width) {
      const gap = Math.max(rect.top - statusBar, 0);
      navHeight = rect.height + gap * 2;
      // 胶囊（含其右侧边距）到屏幕右边缘的距离
      capsuleGap = windowWidth - rect.left;
      // 页面基础左右内边距是 32rpx，扣掉后才是这一行需要额外追加的宽度
      const contentPadding = (32 * windowWidth) / 750;
      rowRightPad = Math.max(capsuleGap - contentPadding + 8, 8);
    }
  } catch (e) {
    // 非微信小程序环境（如 H5）没有胶囊，保持 0，不额外留白
  }
  cachedNavMetrics = { statusBar, navHeight, windowWidth, capsuleGap, rowRightPad };
  return cachedNavMetrics;
}
