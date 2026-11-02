import { reactive } from 'vue';
import { storage } from '@/services/storage';
import { createPayload, getRecordType } from '@/common/record-schema';
import { uuid, startOfDay, endOfDay } from '@/common/utils';

const defaultBaby = () => ({
  id: '',
  name: '',
  gender: 'unknown',
  birthday: '',
  avatar: '👶',
  birthHeight: '',
  birthWeight: '',
  profileCompleted: false,
  updatedAt: 0
});

const defaultSettings = () => ({
  /** 每次写入后自动尝试云端同步 */
  autoSync: true,
  /** 喂养间隔提醒（分钟），首页用于提示 */
  feedInterval: 180,
  hapticFeedback: true
});

const defaultSync = () => ({
  /** 家庭码：同一个家庭的设备共享同一份日记 */
  code: '',
  enabled: true,
  lastSyncAt: 0,
  lastError: ''
});

/** 登录后由云端下发的身份信息，token 是长期凭证 */
const defaultAuth = () => ({
  token: '',
  memberId: '',
  nickname: '',
  role: '',
  /** wechat 微信登录 / device 设备身份（微信登录不可用时的降级） */
  loginType: ''
});

/** 家庭空间信息，members 只含云端已同步的成员列表 */
const defaultFamily = () => ({
  code: '',
  ownerId: '',
  members: []
});

export const state = reactive({
  ready: false,
  auth: defaultAuth(),
  family: defaultFamily(),
  /** 家庭内全部宝宝，当前选中的由 currentBabyId 指定 */
  babies: [],
  currentBabyId: '',
  /** 当前宝宝快照，页面统一读它，切换宝宝时整体替换 */
  baby: defaultBaby(),
  /** 有效记录，按发生时间倒序，包含全部宝宝 */
  records: [],
  /** 已删除记录的墓碑，保留到云端同步完成，用于多端一致 */
  tombstones: [],
  settings: defaultSettings(),
  sync: defaultSync()
});

/**
 * 角色权限表。
 *
 * 未登录（纯本地模式）时 role 为空，视为全权限，
 * 否则老用户在没部署云空间的情况下会把功能锁死。
 */
const RIGHTS = {
  owner: ['record.write', 'baby.write', 'baby.remove', 'member.manage'],
  editor: ['record.write', 'baby.write'],
  viewer: []
};

export const ROLE_LABELS = {
  owner: '超管',
  editor: '共同记录',
  viewer: '仅查看'
};

/** 当前角色是否具备某项权限 */
export function can(action) {
  const role = state.auth.role;
  if (!role) return true;
  return (RIGHTS[role] || []).indexOf(action) > -1;
}

export function isViewer() {
  return state.auth.role === 'viewer';
}

let persistTimer = null;

function persistRecords(immediate) {
  if (persistTimer) clearTimeout(persistTimer);
  const flush = () => storage.saveRecords([...state.records, ...state.tombstones]);
  if (immediate) {
    flush();
    return;
  }
  persistTimer = setTimeout(flush, 200);
}

function sortRecords() {
  state.records.sort((a, b) => b.time - a.time || b.updatedAt - a.updatedAt);
}

/** 把 currentBabyId 对应的宝宝同步到 state.baby，供页面直接读取 */
function refreshBaby() {
  let found = state.babies.find(item => item.id === state.currentBabyId);
  if (!found) {
    found = state.babies[0] || null;
    state.currentBabyId = found ? found.id : '';
  }
  if (found) {
    Object.assign(state.baby, defaultBaby(), found);
  } else {
    Object.assign(state.baby, defaultBaby());
  }
  return state.baby;
}

/**
 * 旧版单宝宝数据迁移。
 *
 * 老版本把宝宝存在 bfd:baby、记录不带 babyId，升级后要整体搬进 babies 数组，
 * 并把历史记录挂到第一个宝宝名下，否则切换逻辑会看到一堆无主记录。
 */
function migrateLegacy() {
  const legacy = storage.getBaby();
  if (!legacy || (!legacy.name && !legacy.birthday)) return false;
  const id = legacy.id || uuid();
  state.babies = [{ ...defaultBaby(), ...legacy, id }];
  state.currentBabyId = id;
  let touched = false;
  state.records.forEach(item => {
    if (!item.babyId) {
      item.babyId = id;
      touched = true;
    }
  });
  state.tombstones.forEach(item => {
    if (!item.babyId) item.babyId = id;
  });
  storage.saveBabies(state.babies);
  storage.saveCurrentBabyId(id);
  if (touched) persistRecords(true);
  return true;
}

export function initStore() {
  if (state.ready) return;

  const settings = storage.getSettings();
  if (settings) Object.assign(state.settings, defaultSettings(), settings);

  const sync = storage.getSync();
  if (sync) Object.assign(state.sync, defaultSync(), sync);

  const auth = storage.getAuth();
  if (auth) Object.assign(state.auth, defaultAuth(), auth);

  const family = storage.getFamily();
  if (family) Object.assign(state.family, defaultFamily(), family);

  const records = storage.getRecords().filter(item => item && item.id);
  state.records = records.filter(item => !item.deleted);
  state.tombstones = records.filter(item => item.deleted);

  state.babies = storage.getBabies().filter(item => item && item.id);
  state.currentBabyId = storage.getCurrentBabyId();
  if (!state.babies.length) migrateLegacy();

  sortRecords();
  refreshBaby();
  state.ready = true;
}

export function getRecord(id) {
  return state.records.find(item => item.id === id) || null;
}

export function createRecord(type, options = {}) {
  const now = Date.now();
  return {
    id: uuid(),
    babyId: options.babyId || state.currentBabyId,
    type,
    time: options.time || now,
    payload: options.payload || createPayload(type),
    note: options.note || '',
    createdAt: now,
    updatedAt: now,
    deleted: false
  };
}

export function addRecord(record) {
  const now = Date.now();
  const next = {
    ...record,
    babyId: record.babyId || state.currentBabyId,
    createdAt: record.createdAt || now,
    updatedAt: now,
    deleted: false
  };
  state.records.push(next);
  sortRecords();
  persistRecords(true);
  return next;
}

export function updateRecord(id, patch) {
  const index = state.records.findIndex(item => item.id === id);
  if (index < 0) return null;
  const next = {
    ...state.records[index],
    ...patch,
    updatedAt: Date.now()
  };
  state.records.splice(index, 1, next);
  sortRecords();
  persistRecords(true);
  return next;
}

export function removeRecord(id) {
  const index = state.records.findIndex(item => item.id === id);
  if (index < 0) return false;
  const removed = { ...state.records[index], deleted: true, updatedAt: Date.now() };
  state.records.splice(index, 1);
  state.tombstones = state.tombstones.filter(item => item.id !== id);
  state.tombstones.push(removed);
  persistRecords(true);
  return true;
}

/** 同步用：包含墓碑的全量本地数据 */
export function allRecordsForSync() {
  return [...state.records, ...state.tombstones];
}

/** 云端合并后回写本地 */
export function mergeFromCloud(list) {
  if (!Array.isArray(list) || !list.length) return 0;
  const merged = new Map();
  allRecordsForSync().forEach(item => merged.set(item.id, item));
  let changed = 0;
  list.forEach(remote => {
    if (!remote || !remote.id) return;
    // 旧数据没有 babyId，归到第一个宝宝，避免出现看不到的无主记录
    if (!remote.babyId && state.babies.length) remote.babyId = state.babies[0].id;
    const local = merged.get(remote.id);
    if (!local || (remote.updatedAt || 0) > (local.updatedAt || 0)) {
      merged.set(remote.id, remote);
      changed += 1;
    }
  });
  const all = [...merged.values()];
  state.records = all.filter(item => !item.deleted);
  state.tombstones = all.filter(item => item.deleted);
  sortRecords();
  persistRecords(true);
  return changed;
}

/** 用云端下发的宝宝列表覆盖本地，保留更新时间更晚的本地版本 */
export function mergeBabiesFromCloud(list) {
  if (!Array.isArray(list) || !list.length) return 0;
  const map = new Map(state.babies.map(item => [item.id, item]));
  let changed = 0;
  list.forEach(remote => {
    if (!remote || !remote.id) return;
    const local = map.get(remote.id);
    if (!local || (remote.updatedAt || 0) >= (local.updatedAt || 0)) {
      map.set(remote.id, { ...defaultBaby(), ...remote });
      changed += 1;
    }
  });
  state.babies = [...map.values()];
  storage.saveBabies(state.babies);
  refreshBaby();
  return changed;
}

/** 当前宝宝对象 */
export function currentBaby() {
  return state.baby;
}

/** 切换当前宝宝 */
export function switchBaby(id) {
  if (!id || id === state.currentBabyId) return state.baby;
  const found = state.babies.find(item => item.id === id);
  if (!found) return state.baby;
  state.currentBabyId = id;
  storage.saveCurrentBabyId(id);
  return refreshBaby();
}

/**
 * 保存宝宝档案。
 * 传 id 表示编辑指定宝宝，不传则编辑当前宝宝；宝宝不存在则新建。
 */
export function saveBaby(patch, options = {}) {
  const targetId = patch.id || state.currentBabyId;
  let index = state.babies.findIndex(item => item.id === targetId);
  const isNew = index < 0;
  const base = isNew ? { ...defaultBaby(), id: targetId || uuid() } : { ...state.babies[index] };
  const next = { ...base, ...patch, id: base.id };
  if (next.name && next.birthday) next.profileCompleted = true;
  if (!options.silent) next.updatedAt = Date.now();

  if (isNew) {
    state.babies.push(next);
    if (!state.currentBabyId) state.currentBabyId = next.id;
  } else {
    state.babies.splice(index, 1, next);
  }

  storage.saveBabies(state.babies);
  storage.saveCurrentBabyId(state.currentBabyId);
  if (next.id === state.currentBabyId) Object.assign(state.baby, defaultBaby(), next);
  return next;
}

/** 新增一个空宝宝并立即切换过去 */
export function createBaby(patch = {}) {
  const next = { ...defaultBaby(), id: uuid(), ...patch, updatedAt: Date.now() };
  state.babies.push(next);
  state.currentBabyId = next.id;
  storage.saveBabies(state.babies);
  storage.saveCurrentBabyId(next.id);
  refreshBaby();
  return next;
}

/** 删除宝宝：连同其记录一起清掉，并重置当前宝宝 */
export function removeBaby(id) {
  const index = state.babies.findIndex(item => item.id === id);
  if (index < 0 || state.babies.length <= 1) return false;
  state.babies.splice(index, 1);
  state.records = state.records.filter(item => item.babyId !== id);
  state.tombstones = state.tombstones.filter(item => item.babyId !== id);
  if (state.currentBabyId === id) state.currentBabyId = state.babies[0].id;
  storage.saveBabies(state.babies);
  storage.saveCurrentBabyId(state.currentBabyId);
  persistRecords(true);
  refreshBaby();
  return true;
}

export function saveAuth(patch) {
  Object.assign(state.auth, patch);
  storage.saveAuth(state.auth);
}

export function saveFamily(patch) {
  Object.assign(state.family, patch);
  storage.saveFamily(state.family);
}

/** 覆盖成员列表（来自云端） */
export function setMembers(list) {
  state.family.members = Array.isArray(list) ? list : [];
  storage.saveFamily(state.family);
}

export function saveSettings(patch) {
  Object.assign(state.settings, patch);
  storage.saveSettings(state.settings);
}

/** 清空全部本地记录（保留宝宝档案与家庭信息） */
export function clearRecords() {
  state.records = [];
  state.tombstones = [];
  storage.saveRecords([]);
}

export function saveSync(patch) {
  Object.assign(state.sync, patch);
  storage.saveSync(state.sync);
}

/** 当前宝宝的记录，页面统计都基于它 */
export function babyRecords() {
  const id = state.currentBabyId;
  if (!id) return state.records;
  // 未带 babyId 的旧记录归当前宝宝，避免升级后数据突然消失
  return state.records.filter(item => !item.babyId || item.babyId === id);
}

export function recordsOfDay(ts) {
  const from = startOfDay(ts);
  const to = endOfDay(ts);
  return babyRecords().filter(item => item.time >= from && item.time <= to);
}

export function recordsBetween(from, to) {
  return babyRecords().filter(item => item.time >= from && item.time <= to);
}

export function lastRecordOfType(type) {
  return babyRecords().find(item => item.type === type) || null;
}

/**
 * 喂养里可以沿用的字段。
 *
 * 亲喂看侧别和时长、瓶喂看奶量，这几个值在日常里很稳定，
 * 而体温、身高体重这类每次都要重新测量的数值不继承，避免误把旧数据当成本次结果。
 */
const FEEDING_FIELDS = ['side', 'duration', 'amount'];

/**
 * 用指定喂奶方式的历史记录填充 payload 的侧别/时长/奶量。
 *
 * 按方式分别记忆，而不是只看最后一条：上次亲喂 25 分钟、再上次瓶喂 120ml，
 * 切到瓶喂时应该带出 120 而不是回到默认值。
 */
export function applyFeedingHistory(payload, mode) {
  if (!mode) return payload;
  const prev = babyRecords().find(item => item.type === 'feeding' && item.payload && item.payload.mode === mode);
  if (!prev) return payload;
  FEEDING_FIELDS.forEach(key => {
    const value = prev.payload[key];
    if (value === undefined || value === null || value === '') return;
    payload[key] = value;
  });
  return payload;
}

/**
 * 新建记录时的初始 payload：先取类型默认值，喂养再按上一条记录的方式带出对应设置，
 * 这样妈妈连续用同一种方式喂奶时不用重复点选。
 */
export function initialPayload(type) {
  const payload = createPayload(type);
  if (type !== 'feeding') return payload;
  const last = lastRecordOfType('feeding');
  if (!last || !last.payload || !last.payload.mode) return payload;
  payload.mode = last.payload.mode;
  return applyFeedingHistory(payload, payload.mode);
}

/** 今日概览指标 */
export function dayStats(ts) {
  const list = recordsOfDay(ts);
  const stats = {
    feedCount: 0,
    feedAmount: 0,
    breastMinutes: 0,
    diaperCount: 0,
    peeCount: 0,
    pooCount: 0,
    sleepMinutes: 0,
    sleepCount: 0,
    lastTemp: null,
    lastGrowth: null
  };
  list.forEach(item => {
    const p = item.payload || {};
    switch (item.type) {
      case 'feeding':
        stats.feedCount += 1;
        if (p.mode === 'breast') stats.breastMinutes += Number(p.duration) || 0;
        else stats.feedAmount += Number(p.amount) || 0;
        break;
      case 'diaper':
        stats.diaperCount += 1;
        if (p.kind === 'pee') stats.peeCount += 1;
        if (p.kind === 'poo' || p.kind === 'mixed') stats.pooCount += 1;
        break;
      case 'sleep':
        stats.sleepCount += 1;
        stats.sleepMinutes += Number(p.duration) || 0;
        break;
      case 'temperature':
        if (!stats.lastTemp) stats.lastTemp = item;
        break;
      case 'growth':
        if (!stats.lastGrowth) stats.lastGrowth = item;
        break;
      default:
        break;
    }
  });
  return stats;
}

/** 距离上次喂养的分钟数 */
export function minutesSinceLastFeeding() {
  const record = lastRecordOfType('feeding');
  if (!record) return null;
  return Math.floor((Date.now() - record.time) / 60000);
}

export function typeMeta(type) {
  return getRecordType(type);
}
