import { CLOUD_CONFIG } from '@/config';
import { storage } from '@/services/storage';
import {
  state,
  saveSync,
  saveAuth,
  saveFamily,
  setMembers,
  allRecordsForSync,
  mergeFromCloud,
  mergeBabiesFromCloud
} from '@/store';

let client = null;
let objectRef = null;

/** 单次推送上限，避免云对象逐条 upsert 超时 */
const PUSH_BATCH = 80;

/** 判断当前运行环境是否具备 uniCloud 能力 */
export function cloudAvailable() {
  return typeof uniCloud !== 'undefined';
}

function getClient() {
  if (client) return client;
  if (!cloudAvailable()) return null;
  let base = uniCloud;
  // 未填写 spaceId 时保持空值，直接使用编译器注入的空间配置
  if (CLOUD_CONFIG.spaceId && typeof uniCloud.init === 'function') {
    try {
      const res = uniCloud.init({
        provider: CLOUD_CONFIG.provider,
        spaceId: CLOUD_CONFIG.spaceId,
        clientSecret: CLOUD_CONFIG.clientSecret,
        endpoint: CLOUD_CONFIG.endpoint
      });
      if (res && typeof res.importObject === 'function') base = res;
    } catch (e) {
      console.warn('[cloud] 初始化参数被忽略，使用编译期注入的空间配置', e);
    }
  }
  client = base;
  return base;
}

function getObject() {
  const base = getClient();
  if (!base || typeof base.importObject !== 'function') {
    throw new Error('当前环境未启用 uniCloud');
  }
  if (!objectRef) {
    objectRef = base.importObject(CLOUD_CONFIG.objectName, { customUI: true });
  }
  // CLI 打包的产物里 importObject 是空壳，只会打印错误并返回 undefined
  if (!objectRef) {
    throw new Error('云空间未关联：请用 HBuilderX 打开项目、关联服务空间后重新运行');
  }
  return objectRef;
}

/** 是否已完成登录且已加入家庭 */
export function hasFamily() {
  return !!(state.auth.token && state.family.code);
}

/**
 * 取本机的设备身份，没有就生成一个并持久化。
 * 微信登录不可用（小程序测试号 / 未配 AppSecret）时用它当身份键。
 */
function deviceId() {
  let id = storage.getDeviceId();
  if (!id) {
    id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    storage.saveDeviceId(id);
  }
  return id;
}

/** 小程序端尝试拿 wx.login 的 code，失败返回空串 */
async function wxLoginCode() {
  // #ifdef MP-WEIXIN
  try {
    const res = await new Promise((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject });
    });
    return (res && res.code) || '';
  } catch (e) {
    console.warn('[cloud] wx.login 失败，改用设备身份', e);
    return '';
  }
  // #endif
  // #ifndef MP-WEIXIN
  return '';
  // #endif
}

/**
 * 确保已登录。
 *
 * 优先用微信 code 换 openid；换不到（例如小程序测试号的 AppSecret 不支持
 * code2Session，会返回 invalid appsecret）时自动降级为设备身份，
 * 此时身份键存在本机，家庭数据靠邀请码保证安全。
 */
export async function ensureLogin() {
  if (state.auth.token) return state.auth;

  // #ifndef MP-WEIXIN
  throw new Error('当前环境不支持家庭协作，请用微信小程序打开');
  // #endif

  const code = await wxLoginCode();
  const obj = getObject();
  const res = await obj.login({ code, deviceId: deviceId() });
  if (res && res.loginType === 'device' && res.warning) {
    console.warn('[cloud] 已降级为设备身份：', res.warning);
  }
  saveAuth({
    token: (res && res.token) || '',
    memberId: (res && res.memberId) || '',
    nickname: (res && res.nickname) || '',
    role: (res && res.role) || '',
    loginType: (res && res.loginType) || ''
  });
  if (res && res.familyCode) {
    saveFamily({ code: res.familyCode });
    saveSync({ code: res.familyCode });
  }
  return state.auth;
}

/** 创建家庭，并把本地已有的宝宝一起带上去 */
export async function createFamily() {
  await ensureLogin();
  const obj = getObject();
  const baby = state.baby && state.baby.name ? toRemoteBaby(state.baby) : null;
  const res = await obj.createFamily({ token: state.auth.token, baby });
  saveFamily({ code: (res && res.familyCode) || '' });
  saveSync({ code: (res && res.familyCode) || '' });
  saveAuth({ role: 'owner' });
  return res;
}

/** 拉取家庭信息（成员、宝宝、我的角色） */
export async function fetchFamily() {
  await ensureLogin();
  const obj = getObject();
  const res = await obj.getFamily({ token: state.auth.token });
  saveFamily({ code: (res && res.code) || '', ownerId: (res && res.ownerId) || '' });
  saveSync({ code: (res && res.code) || '' });
  setMembers((res && res.members) || []);
  if (res && res.me) {
    saveAuth({ nickname: res.me.nickname || '', role: res.me.role || '' });
  }
  if (res && res.babies && res.babies.length) mergeBabiesFromCloud(res.babies);
  return res;
}

/** 生成邀请码，仅超管 */
export async function createInvite(role) {
  await ensureLogin();
  const obj = getObject();
  return obj.invite({ token: state.auth.token, role });
}

/** 加入前预览邀请信息 */
export async function peekInvite(inviteCode) {
  const obj = getObject();
  return obj.peekInvite({ inviteCode });
}

/** 用邀请码加入家庭 */
export async function joinFamily(inviteCode, nickname) {
  await ensureLogin();
  const obj = getObject();
  const res = await obj.joinFamily({ token: state.auth.token, inviteCode, nickname });
  saveFamily({ code: (res && res.familyCode) || '' });
  saveSync({ code: (res && res.familyCode) || '' });
  saveAuth({ role: (res && res.role) || 'editor', nickname: (res && res.nickname) || '' });
  return res;
}

export async function updateMember(memberId, patch) {
  await ensureLogin();
  const obj = getObject();
  const res = await obj.updateMember({ token: state.auth.token, memberId, ...patch });
  await fetchFamily();
  return res;
}

export async function removeMember(memberId) {
  await ensureLogin();
  const obj = getObject();
  const res = await obj.removeMember({ token: state.auth.token, memberId });
  await fetchFamily();
  return res;
}

export async function transferOwner(memberId) {
  await ensureLogin();
  const obj = getObject();
  const res = await obj.transferOwner({ token: state.auth.token, memberId });
  await fetchFamily();
  return res;
}

export async function leaveFamily() {
  await ensureLogin();
  const obj = getObject();
  await obj.leaveFamily({ token: state.auth.token });
  saveAuth({ role: '' });
  saveFamily({ code: '', ownerId: '', members: [] });
  saveSync({ code: '' });
}

export async function dissolveFamily() {
  await ensureLogin();
  const obj = getObject();
  await obj.dissolveFamily({ token: state.auth.token });
  saveAuth({ role: '' });
  saveFamily({ code: '', ownerId: '', members: [] });
  saveSync({ code: '' });
}

/** 本地宝宝结构转云端结构（前端用 id，云端用 babyId） */
function toRemoteBaby(baby) {
  return {
    babyId: baby.id,
    id: baby.id,
    name: baby.name,
    gender: baby.gender,
    birthday: baby.birthday,
    avatar: baby.avatar,
    birthHeight: baby.birthHeight,
    birthWeight: baby.birthWeight,
    profileCompleted: baby.profileCompleted,
    updatedAt: baby.updatedAt
  };
}

/** 单独保存宝宝档案到云端 */
export async function saveBabyRemote(baby) {
  if (!hasFamily() || !baby || !baby.id) return null;
  const obj = getObject();
  return obj.saveBaby({ token: state.auth.token, baby: toRemoteBaby(baby) });
}

/** 删除云端宝宝（软删除并连带清理记录），仅超管 */
export async function removeBabyRemote(babyId) {
  if (!hasFamily()) return null;
  const obj = getObject();
  return obj.removeBaby({ token: state.auth.token, babyId });
}

/**
 * 双向同步：先推送本地增量，再拉取云端增量并合并。
 * 返回 { pushed, pulled, serverTime }
 */
export async function syncNow() {
  await ensureLogin();
  if (!hasFamily()) throw new Error('请先创建或加入家庭');

  const obj = getObject();
  const token = state.auth.token;
  const since = state.sync.lastSyncAt || 0;
  const pending = since ? allRecordsForSync().filter(item => (item.updatedAt || 0) > since) : allRecordsForSync();

  try {
    // 记录分批推，宝宝数量少，整批带上
    let pushed = 0;
    if (pending.length) {
      for (let index = 0; index < pending.length; index += PUSH_BATCH) {
        const slice = pending.slice(index, index + PUSH_BATCH);
        const res = await obj.push({
          token,
          records: slice,
          babies: index === 0 ? state.babies.map(toRemoteBaby) : []
        });
        pushed += (res && res.count) || 0;
      }
    } else {
      await obj.push({ token, records: [], babies: state.babies.map(toRemoteBaby) });
    }

    const pullRes = await obj.pull({ token, since });
    const mergedCount = mergeFromCloud((pullRes && pullRes.records) || []);
    if (pullRes && pullRes.babies && pullRes.babies.length) {
      mergeBabiesFromCloud(pullRes.babies);
    }
    if (pullRes && pullRes.role && pullRes.role !== state.auth.role) {
      saveAuth({ role: pullRes.role });
    }

    const serverTime = (pullRes && pullRes.serverTime) || Date.now();
    saveSync({ lastSyncAt: serverTime, lastError: '' });
    return { pushed, pulled: mergedCount, serverTime };
  } catch (e) {
    saveSync({ lastError: e.message || '同步失败' });
    throw e;
  }
}

/** 仅拉取云端数据（新设备恢复场景） */
export async function pullAll() {
  await ensureLogin();
  if (!hasFamily()) throw new Error('请先创建或加入家庭');
  const obj = getObject();
  const res = await obj.pull({ token: state.auth.token, since: 0 });
  const count = mergeFromCloud((res && res.records) || []);
  if (res && res.babies && res.babies.length) mergeBabiesFromCloud(res.babies);
  saveSync({ lastSyncAt: (res && res.serverTime) || Date.now(), lastError: '' });
  return count;
}

let syncing = false;

/** 写操作后触发的静默同步，失败不影响本地记录 */
export async function maybeSync() {
  if (!state.settings.autoSync || !state.sync.enabled) return null;
  if (!hasFamily()) return null;
  if (syncing) return null;
  syncing = true;
  try {
    return await syncNow();
  } catch (e) {
    console.warn('[cloud] 自动同步失败，本地数据已保存', e);
    return null;
  } finally {
    syncing = false;
  }
}
