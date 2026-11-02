import { STORAGE_KEYS } from '@/config';

function read(key, fallback) {
  try {
    const value = uni.getStorageSync(key);
    if (value === '' || value === null || value === undefined) return fallback;
    return value;
  } catch (e) {
    console.warn('[storage] 读取失败', key, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    uni.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.warn('[storage] 写入失败', key, e);
    return false;
  }
}

export const storage = {
  getRecords() {
    const list = read(STORAGE_KEYS.records, []);
    return Array.isArray(list) ? list : [];
  },
  saveRecords(records) {
    return write(STORAGE_KEYS.records, records);
  },
  getBaby() {
    return read(STORAGE_KEYS.baby, null);
  },
  saveBaby(baby) {
    return write(STORAGE_KEYS.baby, baby);
  },
  getBabies() {
    const list = read(STORAGE_KEYS.babies, []);
    return Array.isArray(list) ? list : [];
  },
  saveBabies(babies) {
    return write(STORAGE_KEYS.babies, babies);
  },
  getCurrentBabyId() {
    return read(STORAGE_KEYS.currentBabyId, '');
  },
  saveCurrentBabyId(id) {
    return write(STORAGE_KEYS.currentBabyId, id);
  },
  getAuth() {
    return read(STORAGE_KEYS.auth, null);
  },
  saveAuth(auth) {
    return write(STORAGE_KEYS.auth, auth);
  },
  getFamily() {
    return read(STORAGE_KEYS.family, null);
  },
  saveFamily(family) {
    return write(STORAGE_KEYS.family, family);
  },
  getDeviceId() {
    return read(STORAGE_KEYS.deviceId, '');
  },
  saveDeviceId(id) {
    return write(STORAGE_KEYS.deviceId, id);
  },
  getSettings() {
    return read(STORAGE_KEYS.settings, null);
  },
  saveSettings(settings) {
    return write(STORAGE_KEYS.settings, settings);
  },
  getSync() {
    return read(STORAGE_KEYS.sync, null);
  },
  saveSync(sync) {
    return write(STORAGE_KEYS.sync, sync);
  },
  clearAll() {
    [
      STORAGE_KEYS.records,
      STORAGE_KEYS.baby,
      STORAGE_KEYS.babies,
      STORAGE_KEYS.currentBabyId,
      STORAGE_KEYS.auth,
      STORAGE_KEYS.family,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.sync
    ].forEach(key => {
      try {
        uni.removeStorageSync(key);
      } catch (e) {
        console.warn('[storage] 清除失败', key, e);
      }
    });
  }
};
