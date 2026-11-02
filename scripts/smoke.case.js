import assert from 'assert';
import { durationText, ageText, parseDateTime, agoText, navMetrics } from '@/common/utils';
import { createPayload, visibleFields, recordSummary, getRecordType } from '@/common/record-schema';
import * as store from '@/store/index.js';

const memory = new Map();

globalThis.uni = {
  getStorageSync(key) {
    return memory.has(key) ? memory.get(key) : '';
  },
  setStorageSync(key, value) {
    memory.set(key, JSON.parse(JSON.stringify(value)));
  },
  removeStorageSync(key) {
    memory.delete(key);
  },
  getSystemInfoSync() {
    return { statusBarHeight: 44, windowWidth: 390 };
  },
  // 模拟 iPhone 14 的胶囊按钮：左边界 296，宽 86，相对屏幕右边空出 94
  getMenuButtonBoundingClientRect() {
    return { top: 51, left: 296, width: 86, height: 32, right: 382, bottom: 83 };
  }
};

function reset() {
  memory.clear();
  store.state.records = [];
  store.state.tombstones = [];
  store.state.babies = [];
  store.state.currentBabyId = '';
  Object.keys(store.state.baby).forEach(key => delete store.state.baby[key]);
  store.state.sync.code = '';
  store.state.sync.lastSyncAt = 0;
  store.state.family.code = '';
  store.state.family.members = [];
  Object.assign(store.state.auth, { token: '', memberId: '', nickname: '', role: '' });
  store.state.ready = true;
}

export function 旧数据迁移为多宝宝() {
  reset();
  const legacyId = 'legacy-baby';
  memory.set('bfd:baby', { id: legacyId, name: '宝宝A', birthday: '2026-03-01', avatar: '👶' });
  memory.set('bfd:records', [
    { id: 'r1', type: 'feeding', time: Date.now(), payload: { mode: 'breast' }, updatedAt: 1 },
    { id: 'r2', type: 'diaper', time: Date.now(), payload: { kind: 'pee' }, updatedAt: 1 }
  ]);
  memory.set('bfd:babies', []);

  store.state.ready = false;
  store.initStore();

  assert.equal(store.state.babies.length, 1, '旧档案应迁移成一个宝宝');
  assert.equal(store.state.babies[0].id, legacyId, '迁移后沿用原 ID');
  assert.equal(store.state.currentBabyId, legacyId);
  assert.equal(store.state.baby.name, '宝宝A');
  store.state.records.forEach(item => assert.equal(item.babyId, legacyId, '历史记录应挂到迁移后的宝宝'));
}

export function 多宝宝记录互相隔离() {
  reset();
  const first = store.createBaby({ name: '大宝' });
  const dayTs = Date.now();
  store.addRecord(store.createRecord('feeding', { time: dayTs, payload: { mode: 'bottle', amount: 120 } }));

  const second = store.createBaby({ name: '二宝' });
  assert.equal(store.state.currentBabyId, second.id, '新增宝宝后应自动切过去');
  assert.equal(store.recordsOfDay(dayTs).length, 0, '切换后看不到别的宝宝的记录');

  store.addRecord(store.createRecord('diaper', { time: dayTs, payload: { kind: 'poo' } }));
  assert.equal(store.recordsOfDay(dayTs).length, 1);
  assert.equal(store.recordsOfDay(dayTs)[0].type, 'diaper');

  store.switchBaby(first.id);
  assert.equal(store.state.baby.name, '大宝');
  assert.equal(store.recordsOfDay(dayTs).length, 1);
  assert.equal(store.recordsOfDay(dayTs)[0].type, 'feeding');

  // 删掉二宝会连带清掉它的记录，且不能删到最后一个宝宝
  const ok = store.removeBaby(second.id);
  assert.equal(ok, true);
  assert.equal(store.state.babies.length, 1);
  assert.equal(store.removeBaby(first.id), false, '至少保留一个宝宝');
}

export function 角色权限矩阵() {
  reset();

  // 未登录（本地单机）默认全权限，不能把老用户锁死
  assert.equal(store.state.auth.role, '');
  assert.equal(store.can('record.write'), true);
  assert.equal(store.can('member.manage'), true);

  Object.assign(store.state.auth, { role: 'viewer' });
  assert.equal(store.can('record.write'), false);
  assert.equal(store.can('baby.write'), false);
  assert.equal(store.can('baby.remove'), false);
  assert.equal(store.can('member.manage'), false);

  Object.assign(store.state.auth, { role: 'editor' });
  assert.equal(store.can('record.write'), true);
  assert.equal(store.can('baby.write'), true, '共同记录可以加宝宝');
  assert.equal(store.can('baby.remove'), false, '共同记录不能删宝宝');
  assert.equal(store.can('member.manage'), false);

  Object.assign(store.state.auth, { role: 'owner' });
  ['record.write', 'baby.write', 'baby.remove', 'member.manage'].forEach(action => {
    assert.equal(store.can(action), true, `超管应拥有 ${action}`);
  });
}

export function 新建宝宝后档案自动切换() {
  reset();
  const baby = store.createBaby({ name: '二宝', birthday: '2026-05-01' });
  assert.equal(store.state.currentBabyId, baby.id);
  assert.equal(store.state.baby.name, '二宝');

  store.saveBaby({ gender: 'girl' });
  assert.equal(store.state.babies[0].gender, 'girl');
  assert.equal(store.state.baby.gender, 'girl', '当前宝宝快照要同步更新');
  assert.equal(store.state.baby.profileCompleted, true);
}

export function 时长格式化() {
  assert.equal(durationText(45), '45分钟');
  assert.equal(durationText(120), '2小时');
  assert.equal(durationText(135), '2小时15分');
  assert.equal(durationText(0), '0分钟');
}

export function 时间解析不受时区影响() {
  const ts = parseDateTime('2026-10-30', '08:30');
  const d = new Date(ts);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 9);
  assert.equal(d.getDate(), 30);
  assert.equal(d.getHours(), 8);
  assert.equal(d.getMinutes(), 30);
}

export function 相对时间文案() {
  assert.equal(agoText(Date.now() - 30 * 1000), '刚刚');
  assert.equal(agoText(Date.now() - 5 * 60000), '5分钟前');
  assert.equal(agoText(Date.now() - 65 * 60000), '1小时5分前');
}

export function 月龄计算() {
  const now = new Date();
  const y = now.getFullYear() - 1;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  assert.equal(ageText(`${y}-${m}-${d}`), '12个月');
  assert.equal(ageText(''), '');
}

export function 导航栏胶囊避让只作用于标题行() {
  const metrics = navMetrics();
  assert.equal(metrics.statusBar, 44);
  assert.equal(metrics.capsuleGap, 390 - 296);

  // 标题行：在 header 已有 32rpx 内边距的基础上，再补 rowRightPad
  const headerPadding = (32 * 390) / 750;
  const titleRowRight = 390 - headerPadding - metrics.rowRightPad;
  assert.ok(titleRowRight <= 296, `标题行右边界 ${titleRowRight} 不应越过胶囊左边界 296`);
  assert.ok(titleRowRight > 296 - 12, `避让过度：${titleRowRight} 离胶囊太远`);

  // 日期栏 / 筛选条不追加 padding，保持满宽（旧实现把它们一起缩进了）
  assert.equal(Math.round(390 - headerPadding), 373);
}

export function 点击记录可回填并二次编辑() {
  reset();
  const record = store.addRecord(
    store.createRecord('temperature', {
      time: Date.now(),
      payload: { value: 37.8, method: '耳温' },
      note: '下午有点热'
    })
  );

  // 列表点击只拿得到 id，编辑页靠 id 回填
  const loaded = store.getRecord(record.id);
  assert.ok(loaded, '应能按 id 取到记录');
  assert.equal(loaded.type, 'temperature');
  assert.equal(loaded.payload.value, 37.8);
  assert.equal(loaded.payload.method, '耳温');
  assert.equal(loaded.note, '下午有点热');

  // 二次编辑：数值更新，但不会变成两条记录
  store.updateRecord(record.id, { payload: { value: 38.5, method: '耳温' } });
  assert.equal(store.state.records.length, 1, '编辑不应新增记录');
  assert.equal(store.getRecord(record.id).payload.value, 38.5);
  assert.equal(store.getRecord(record.id).type, 'temperature');

  // 删除后按 id 取不到，编辑页要提示而不是静默打开空白新增页
  store.removeRecord(record.id);
  assert.equal(store.getRecord(record.id), null);
}

export function 新建喂养沿用上次方式与奶量() {
  reset();

  // 没有历史记录时用类型默认值
  assert.equal(store.initialPayload('feeding').mode, 'breast');

  // 记一条瓶喂后，下次默认就是瓶喂 + 上次奶量
  store.addRecord(
    store.createRecord('feeding', {
      time: Date.now() - 3600 * 1000,
      payload: { mode: 'bottle', amount: 120 }
    })
  );
  const afterBottle = store.initialPayload('feeding');
  assert.equal(afterBottle.mode, 'bottle');
  assert.equal(afterBottle.amount, 120);

  // 更新的亲喂记录应覆盖旧设置，且瓶喂奶量不会带到亲喂
  store.addRecord(
    store.createRecord('feeding', {
      time: Date.now(),
      payload: { mode: 'breast', side: 'right', duration: 25 }
    })
  );
  const afterBreast = store.initialPayload('feeding');
  assert.equal(afterBreast.mode, 'breast');
  assert.equal(afterBreast.side, 'right');
  assert.equal(afterBreast.duration, 25);
  // 亲喂记录本身不含奶量字段，不能把上一条瓶喂的 120 带过来
  assert.notEqual(afterBreast.amount, 120, '瓶喂奶量不应带到亲喂记录上');
  assert.equal(afterBreast.amount, createPayload('feeding').amount, '奶量应回到类型默认值');

  // 切回瓶喂时，带出的应是上次瓶喂的 120，而不是默认 90
  const switched = store.initialPayload('feeding');
  store.applyFeedingHistory(switched, 'bottle');
  assert.equal(switched.amount, 120, '切到瓶喂应带出上次瓶喂的奶量');
  assert.equal(switched.mode, 'breast', 'applyFeedingHistory 只补方式相关字段，不改方式本身');

  // 体温这类每次都要重新测量的数值不继承
  store.addRecord(store.createRecord('temperature', { payload: { value: 38.5, method: '腋温' } }));
  assert.equal(store.initialPayload('temperature').value, 36.5);
}

export function 喂养表单按方式切换字段() {
  const payload = createPayload('feeding');
  assert.equal(payload.mode, 'breast');
  const breastFields = visibleFields('feeding', payload).map(f => f.key);
  assert.deepEqual(breastFields, ['mode', 'side', 'duration']);

  const bottleFields = visibleFields('feeding', { mode: 'bottle' }).map(f => f.key);
  assert.deepEqual(bottleFields, ['mode', 'amount']);
}

export function 记录摘要文案() {
  const feeding = { type: 'feeding', payload: { mode: 'breast', side: 'left', duration: 20 } };
  assert.equal(recordSummary(feeding), '亲喂 · 左侧 · 20分钟');

  const growth = { type: 'growth', payload: { height: 60.5, weight: 6.2 } };
  assert.equal(recordSummary(growth), '身高 60.5cm · 体重 6.2kg');

  const solid = { type: 'solid', payload: { food: '米粉', amount: 30, unit: 'g', firstTry: true } };
  assert.equal(recordSummary(solid), '米粉 30g · 首次尝试');

  assert.equal(getRecordType('unknown').key, 'feeding');
}

export function 新增记录与当日统计() {
  reset();
  const now = Date.now();
  const record = store.createRecord('feeding', {
    time: now,
    payload: { mode: 'formula', amount: 120 }
  });
  store.addRecord(record);
  store.addRecord(store.createRecord('diaper', { time: now, payload: { kind: 'mixed', stoolColor: '金黄' } }));
  store.addRecord(store.createRecord('sleep', { time: now, payload: { duration: 90 } }));

  assert.equal(store.state.records.length, 3);

  const stats = store.dayStats(now);
  assert.equal(stats.feedCount, 1);
  assert.equal(stats.feedAmount, 120);
  assert.equal(stats.diaperCount, 1);
  assert.equal(stats.pooCount, 1);
  assert.equal(stats.sleepMinutes, 90);
}

export function 记录按时间倒序() {
  reset();
  const base = Date.now();
  store.addRecord(store.createRecord('feeding', { time: base - 3600 * 1000 }));
  store.addRecord(store.createRecord('feeding', { time: base }));
  assert.ok(store.state.records[0].time > store.state.records[1].time);
}

export function 编辑与软删除() {
  reset();
  const record = store.addRecord(store.createRecord('temperature', { payload: { value: 36.8 } }));
  store.updateRecord(record.id, { payload: { value: 37.6 }, note: '有点热' });

  const updated = store.getRecord(record.id);
  assert.equal(updated.payload.value, 37.6);
  assert.equal(updated.note, '有点热');
  assert.ok(updated.updatedAt >= updated.createdAt);

  store.removeRecord(record.id);
  assert.equal(store.state.records.length, 0);
  assert.equal(store.state.tombstones.length, 1);
  assert.equal(store.state.tombstones[0].deleted, true);
}

export function 云端合并以较新者为准() {
  reset();
  const local = store.addRecord(store.createRecord('feeding', { payload: { mode: 'formula', amount: 90 } }));

  // 云端有更新的版本
  const remoteNewer = {
    ...local,
    payload: { mode: 'formula', amount: 150 },
    updatedAt: local.updatedAt + 1000
  };
  // 云端有更旧的版本，不应覆盖本地
  const remoteOlder = {
    id: 'remote-only-id',
    type: 'diaper',
    time: Date.now(),
    payload: { kind: 'pee' },
    createdAt: 1,
    updatedAt: 1,
    deleted: false
  };

  store.mergeFromCloud([remoteNewer, remoteOlder]);
  assert.equal(store.getRecord(local.id).payload.amount, 150);
  assert.ok(store.getRecord('remote-only-id'));

  // 云端删除应同步到本地
  store.mergeFromCloud([{ ...remoteNewer, deleted: true, updatedAt: remoteNewer.updatedAt + 1000 }]);
  assert.equal(store.getRecord(local.id), null);
  assert.equal(store.state.tombstones.length, 1);
}

export function 同步数据包含墓碑() {
  reset();
  const record = store.addRecord(store.createRecord('supplement', { payload: { name: '维生素D', dose: 400 } }));
  store.removeRecord(record.id);
  const all = store.allRecordsForSync();
  assert.equal(all.length, 1);
  assert.equal(all[0].deleted, true);
}

export function 数据持久化到本地存储() {
  reset();
  store.addRecord(store.createRecord('growth', { payload: { height: 62, weight: 6.5 } }));
  const raw = memory.get('bfd:records');
  assert.ok(Array.isArray(raw));
  assert.equal(raw.length, 1);
  assert.equal(raw[0].payload.weight, 6.5);
}
