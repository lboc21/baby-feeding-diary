const db = uniCloud.database();
const RECORDS = 'bdf-records';
const BABIES = 'bdf-babies';
const MEMBERS = 'bdf-members';
const FAMILIES = 'bdf-families';
const INVITES = 'bdf-invites';

const PAGE_SIZE = 100;
const MAX_PUSH = 500;
const INVITE_TTL = 7 * 24 * 3600 * 1000;
/** 家庭码与邀请码都避开 0/O、1/I 这类容易看错的字符 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return out;
}

function randomToken() {
  return `${Date.now().toString(36)}${randomCode(12)}${Math.random().toString(36).slice(2, 10)}`;
}

function newId() {
  return `${Date.now().toString(36)}-${randomCode(10)}`;
}

/** 客户端身份校验：token 换成员，顺带做角色过滤 */
async function requireMember(token, roles) {
  if (!token) throw new Error('未登录');
  const res = await db.collection(MEMBERS).where({ token }).limit(1).get();
  const member = res.data && res.data[0];
  if (!member || !member.active) throw new Error('登录已失效，请重新进入小程序');
  if (!member.familyCode) throw new Error('尚未加入家庭');
  if (roles && roles.indexOf(member.role) === -1) throw new Error('没有操作权限');
  return member;
}

/**
 * 读环境变量，顺手去掉复制粘贴带进来的空白与引号。
 * 微信后台的密钥是一长串没有空格的字符，末尾多一个换行就会 invalid appsecret。
 */
function wxCredential(name) {
  const raw = process.env[name];
  if (!raw) return '';
  return String(raw)
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * 把微信的英文错误码翻成能直接照着做的中文提示。
 * 只回显 AppID 尾号与密钥长度，两者都不敏感，但足够定位「填错项目 / 复制不全」这类问题。
 */
function wxErrorMessage(data, appId, secret) {
  const code = Number(data.errcode) || 0;
  const errmsg = data.errmsg || '无返回信息';
  const detail = `（errcode ${code || '未知'}：${errmsg}）`;

  if (code === 40125 || /invalid appsecret/i.test(errmsg)) {
    return `AppSecret 与 AppID 不匹配或已失效${detail}。请确认 WX_APPSECRET 填的是同一个小程序的密钥（不是公众号、也不是其他小程序的）；若在微信后台重置过密钥，旧密钥会立即失效。当前 AppID 尾号 ${appId.slice(-6)}，密钥长度 ${secret.length}（应为 32）`;
  }
  if (code === 40013 || /invalid appid/i.test(errmsg)) {
    return `AppID 不被微信认可${detail}。请确认 WX_APPID 是小程序 AppID，且与密钥属于同一个应用。当前填的是 ${appId.slice(0, 6)}...${appId.slice(-4)}`;
  }
  if (code === 40029 || /invalid code/i.test(errmsg)) {
    return `登录凭证无效或已使用过${detail}。重新进入小程序再试一次即可`;
  }
  if (code === 45011) return `登录过于频繁${detail}，请稍后再试`;
  return `微信登录失败${detail}`;
}

/** 微信登录换 openid，凭据只从环境变量读，不进代码 */
async function code2session(code) {
  const appId = wxCredential('WX_APPID');
  const secret = wxCredential('WX_APPSECRET');
  if (!appId || !secret) {
    const missing = [!appId && 'WX_APPID', !secret && 'WX_APPSECRET'].filter(Boolean).join(' / ');
    throw new Error(`云对象缺少环境变量 ${missing}。请在 uniCloud 控制台给云对象 baby-diary 配置后重新上传部署`);
  }

  let data;
  try {
    const res = await uniCloud.httpclient.request('https://api.weixin.qq.com/sns/jscode2session', {
      method: 'GET',
      data: { appid: appId, secret, js_code: code, grant_type: 'authorization_code' },
      dataType: 'json',
      timeout: 10000
    });
    data = (res && res.data) || {};
  } catch (e) {
    throw new Error(`请求微信接口失败：${e.message || '网络异常'}，请稍后重试`);
  }

  if (data.openid) return data.openid;
  throw new Error(wxErrorMessage(data, appId, secret));
}

/** 成员对外结构：不下发 openid 与 token */
function stripMember(doc) {
  if (!doc) return null;
  return {
    memberId: doc.memberId,
    nickname: doc.nickname || '',
    role: doc.role || '',
    joinedAt: doc.joinedAt || 0
  };
}

function stripRecord(doc) {
  if (!doc) return null;
  const { _id, syncCode, serverUpdatedAt, openid, ...rest } = doc;
  return rest;
}

function stripBaby(doc) {
  if (!doc) return null;
  const { _id, syncCode, serverUpdatedAt, ...rest } = doc;
  return { ...rest, id: rest.babyId || rest.id };
}

function toRecordDoc(record, familyCode, now, fallbackBabyId) {
  return {
    syncCode: familyCode,
    babyId: String(record.babyId || fallbackBabyId || ''),
    id: String(record.id),
    type: record.type,
    time: Number(record.time) || now,
    payload: record.payload || {},
    note: record.note || '',
    createdAt: Number(record.createdAt) || now,
    updatedAt: Number(record.updatedAt) || now,
    deleted: !!record.deleted,
    serverUpdatedAt: now
  };
}

function toBabyDoc(baby, familyCode, now) {
  return {
    syncCode: familyCode,
    babyId: String(baby.babyId || baby.id),
    name: baby.name || '',
    gender: baby.gender || 'unknown',
    birthday: baby.birthday || '',
    avatar: baby.avatar || '👶',
    birthHeight: baby.birthHeight === undefined ? '' : baby.birthHeight,
    birthWeight: baby.birthWeight === undefined ? '' : baby.birthWeight,
    profileCompleted: !!baby.profileCompleted,
    deleted: !!baby.deleted,
    updatedAt: Number(baby.updatedAt) || now,
    serverUpdatedAt: now
  };
}

/** 批量 upsert：先查已存在的 _id，避免逐条 select */
async function upsertBatch(collection, familyCode, idField, docs) {
  if (!docs.length) return 0;
  const ids = docs.map(item => item[idField]);
  const existed = await db
    .collection(collection)
    .where({ syncCode: familyCode, [idField]: db.command.in(ids) })
    .limit(1000)
    .get();
  const idMap = new Map((existed.data || []).map(item => [item[idField], item._id]));
  let count = 0;
  for (const doc of docs) {
    const target = idMap.get(doc[idField]);
    if (target) {
      await db.collection(collection).doc(target).update(doc);
    } else {
      await db.collection(collection).add(doc);
    }
    count += 1;
  }
  return count;
}

module.exports = {
  async ping() {
    return { ok: true, serverTime: Date.now() };
  },

  /**
   * 配置自检：不返回密钥本身，只回显是否读到、长度与 AppID 尾号。
   * 在 HBuilderX 的云对象「运行测试」里直接调 checkWxConfig 即可确认环境变量是否生效。
   */
  async checkWxConfig() {
    const appId = wxCredential('WX_APPID');
    const secret = wxCredential('WX_APPSECRET');
    return {
      hasAppId: !!appId,
      hasSecret: !!secret,
      appIdTail: appId ? appId.slice(-6) : '',
      secretLength: secret.length,
      secretLooksValid: secret.length === 32
    };
  },

  /**
   * 登录：优先用微信 code 换 openid，拿不到再用设备身份。
   *
   * 设备身份是一条兜底链路：微信「小程序测试号」的 AppSecret 不支持 code2Session，
   * 也会返回 40125；另外换 AppID 时旧 openid 也会失效。
   * 这两种情况下改用客户端持久化的 deviceId 作为身份键（存成 dev_xxx），
   * 家庭数据的安全性由邀请码保证，不依赖微信身份。
   */
  async login({ code, deviceId } = {}) {
    let identity = '';
    let loginType = '';
    let wxError = null;

    if (code) {
      try {
        identity = await code2session(code);
        loginType = 'wechat';
      } catch (e) {
        wxError = e;
      }
    }

    if (!identity && deviceId) {
      identity = `dev_${String(deviceId).slice(0, 64)}`;
      loginType = 'device';
    }
    if (!identity) {
      if (wxError) throw wxError;
      throw new Error('缺少登录凭证');
    }

    const res = await db.collection(MEMBERS).where({ openid: identity }).limit(1).get();
    const now = Date.now();
    let member = res.data && res.data[0];

    if (!member) {
      member = {
        openid: identity,
        loginType,
        token: randomToken(),
        familyCode: '',
        memberId: newId(),
        nickname: '',
        role: '',
        active: true,
        joinedAt: 0,
        updatedAt: now
      };
      await db.collection(MEMBERS).add(member);
    } else if (member.loginType !== loginType) {
      await db.collection(MEMBERS).doc(member._id).update({ loginType, updatedAt: now });
    }

    return {
      token: member.token,
      memberId: member.memberId,
      nickname: member.nickname || '',
      role: member.familyCode ? member.role : '',
      familyCode: member.familyCode || '',
      loginType,
      /** 降级到设备身份时把微信的原始报错带回去，方便页面上提示 */
      warning: loginType === 'device' && wxError ? wxError.message : ''
    };
  },

  /** 创建家庭：调用者成为超管，同时写入第一个宝宝 */
  async createFamily({ token, baby = null } = {}) {
    if (!token) throw new Error('未登录');
    const res = await db.collection(MEMBERS).where({ token }).limit(1).get();
    const member = res.data && res.data[0];
    if (!member || !member.active) throw new Error('登录已失效，请重新进入小程序');
    if (member.familyCode) throw new Error('已经加入家庭，不能重复创建');
    return createFamilyFor(member, baby);
  },

  /** 家庭信息：我的角色 + 成员列表 + 宝宝列表 */
  async getFamily({ token } = {}) {
    const me = await requireMember(token);
    const [memberRes, babyRes] = await Promise.all([
      db.collection(MEMBERS).where({ familyCode: me.familyCode, active: true }).get(),
      db.collection(BABIES).where({ syncCode: me.familyCode }).limit(100).get()
    ]);
    const members = (memberRes.data || []).map(stripMember);
    const babies = (babyRes.data || []).filter(item => !item.deleted).map(stripBaby);
    const owner = members.find(item => item.role === 'owner');
    return {
      code: me.familyCode,
      ownerId: owner ? owner.memberId : '',
      me: stripMember(me),
      members,
      babies
    };
  },

  /** 生成邀请码，仅超管 */
  async invite({ token, role = 'editor' } = {}) {
    const me = await requireMember(token, ['owner']);
    if (role !== 'editor' && role !== 'viewer') throw new Error('邀请角色不合法');
    const now = Date.now();
    const code = randomCode(6);
    await db.collection(INVITES).add({
      code,
      familyCode: me.familyCode,
      role,
      createdBy: me.memberId,
      expireAt: now + INVITE_TTL,
      usedBy: [],
      createdAt: now
    });
    return { code, role, expireAt: now + INVITE_TTL };
  },

  /** 查询邀请码对应的家庭信息，用于加入页展示 */
  async peekInvite({ inviteCode } = {}) {
    const code = String(inviteCode || '')
      .trim()
      .toUpperCase();
    if (!code) throw new Error('邀请码不能为空');
    const res = await db.collection(INVITES).where({ code }).limit(1).get();
    const invite = res.data && res.data[0];
    if (!invite) throw new Error('邀请码不存在');
    if (invite.expireAt && invite.expireAt < Date.now()) throw new Error('邀请码已过期');
    const babyRes = await db.collection(BABIES).where({ syncCode: invite.familyCode }).limit(1).get();
    const baby = babyRes.data && babyRes.data[0];
    return {
      familyCode: invite.familyCode,
      role: invite.role,
      babyName: baby ? baby.name : ''
    };
  },

  /** 用邀请码加入家庭 */
  async joinFamily({ token, inviteCode, nickname = '' } = {}) {
    const code = String(inviteCode || '')
      .trim()
      .toUpperCase();
    if (!code) throw new Error('邀请码不能为空');
    const res = await db.collection(MEMBERS).where({ token }).limit(1).get();
    const member = res.data && res.data[0];
    if (!member) throw new Error('登录已失效，请重新进入小程序');

    const inviteRes = await db.collection(INVITES).where({ code }).limit(1).get();
    const invite = inviteRes.data && inviteRes.data[0];
    if (!invite) throw new Error('邀请码不存在');
    if (invite.expireAt && invite.expireAt < Date.now()) throw new Error('邀请码已过期');
    // 被移出过的成员 active 为 false，重新邀请时允许恢复，否则这个人将永久无法再加入
    if (member.active !== false && member.familyCode && member.familyCode !== invite.familyCode) {
      throw new Error('你已经加入了其他家庭，请先退出');
    }

    const now = Date.now();
    await db
      .collection(MEMBERS)
      .doc(member._id)
      .update({
        familyCode: invite.familyCode,
        role: invite.role,
        nickname: nickname ? String(nickname).slice(0, 20) : member.nickname || '家人',
        active: true,
        joinedAt: member.joinedAt || now,
        updatedAt: now
      });

    return {
      familyCode: invite.familyCode,
      role: invite.role,
      nickname: nickname || member.nickname || '家人'
    };
  },

  /** 修改成员备注名或角色，仅超管；不能改自己的角色 */
  async updateMember({ token, memberId, nickname, role } = {}) {
    const me = await requireMember(token, ['owner']);
    if (!memberId) throw new Error('缺少成员 ID');
    const res = await db.collection(MEMBERS).where({ familyCode: me.familyCode, memberId }).limit(1).get();
    const target = res.data && res.data[0];
    if (!target) throw new Error('成员不存在');

    const patch = { updatedAt: Date.now() };
    if (nickname !== undefined) patch.nickname = String(nickname).slice(0, 20);
    if (role !== undefined) {
      if (memberId === me.memberId) throw new Error('不能修改自己的角色');
      if (role !== 'editor' && role !== 'viewer') throw new Error('角色不合法');
      patch.role = role;
    }
    await db.collection(MEMBERS).doc(target._id).update(patch);
    return { memberId, nickname: patch.nickname, role: patch.role };
  },

  /** 移出成员，仅超管；不能移除自己 */
  async removeMember({ token, memberId } = {}) {
    const me = await requireMember(token, ['owner']);
    if (memberId === me.memberId) throw new Error('不能移除自己');
    const res = await db.collection(MEMBERS).where({ familyCode: me.familyCode, memberId }).limit(1).get();
    const target = res.data && res.data[0];
    if (!target) throw new Error('成员不存在');
    await db
      .collection(MEMBERS)
      .doc(target._id)
      .update({ familyCode: '', role: '', active: false, updatedAt: Date.now() });
    return { memberId };
  },

  /** 主动退出家庭，超管需先转让 */
  async leaveFamily({ token } = {}) {
    const me = await requireMember(token);
    if (me.role === 'owner') throw new Error('超管需要先转让超管或解散家庭');
    await db.collection(MEMBERS).doc(me._id).update({ familyCode: '', role: '', active: false, updatedAt: Date.now() });
    return { ok: true };
  },

  /** 转让超管，仅超管 */
  async transferOwner({ token, memberId } = {}) {
    const me = await requireMember(token, ['owner']);
    if (!memberId || memberId === me.memberId) throw new Error('请选择其他成员');
    const res = await db.collection(MEMBERS).where({ familyCode: me.familyCode, memberId }).limit(1).get();
    const target = res.data && res.data[0];
    if (!target || !target.active) throw new Error('成员不存在');
    const now = Date.now();
    await db.collection(MEMBERS).doc(target._id).update({ role: 'owner', updatedAt: now });
    await db.collection(MEMBERS).doc(me._id).update({ role: 'editor', updatedAt: now });
    await db.collection(FAMILIES).where({ code: me.familyCode }).update({ ownerId: memberId, updatedAt: now });
    return { memberId };
  },

  /** 解散家庭，仅超管；成员全部解绑，数据保留但不再可访问 */
  async dissolveFamily({ token } = {}) {
    const me = await requireMember(token, ['owner']);
    const now = Date.now();
    const res = await db.collection(MEMBERS).where({ familyCode: me.familyCode }).get();
    for (const item of res.data || []) {
      await db.collection(MEMBERS).doc(item._id).update({ familyCode: '', role: '', active: false, updatedAt: now });
    }
    await db.collection(FAMILIES).where({ code: me.familyCode }).remove();
    await db.collection(INVITES).where({ familyCode: me.familyCode }).remove();
    return { ok: true };
  },

  /** 保存宝宝档案：超管与共同记录都可以新增/编辑 */
  async saveBaby({ token, baby } = {}) {
    const me = await requireMember(token, ['owner', 'editor']);
    if (!baby || !(baby.id || baby.babyId)) throw new Error('缺少宝宝 ID');
    const now = Date.now();
    const doc = toBabyDoc(baby, me.familyCode, now);
    const existed = await db.collection(BABIES).where({ syncCode: me.familyCode, babyId: doc.babyId }).limit(1).get();
    if (existed.data && existed.data.length) {
      await db.collection(BABIES).doc(existed.data[0]._id).update(doc);
    } else {
      await db.collection(BABIES).add(doc);
    }
    return stripBaby(doc);
  },

  /** 删除宝宝（软删除）并连带删除其记录，仅超管 */
  async removeBaby({ token, babyId } = {}) {
    const me = await requireMember(token, ['owner']);
    if (!babyId) throw new Error('缺少宝宝 ID');
    const now = Date.now();
    await db
      .collection(BABIES)
      .where({ syncCode: me.familyCode, babyId: String(babyId) })
      .update({ deleted: true, updatedAt: now, serverUpdatedAt: now });
    await db
      .collection(RECORDS)
      .where({ syncCode: me.familyCode, babyId: String(babyId) })
      .remove();
    return { babyId };
  },

  /** 推送本地变更（含墓碑） */
  async push({ token, records = [], babies = [] } = {}) {
    const me = await requireMember(token, ['owner', 'editor']);
    const now = Date.now();
    const familyCode = me.familyCode;
    const fallbackBabyId = babies[0] ? String(babies[0].id || babies[0].babyId) : '';

    const recordDocs = (Array.isArray(records) ? records.slice(0, MAX_PUSH) : [])
      .filter(item => item && item.id)
      .map(item => toRecordDoc(item, familyCode, now, fallbackBabyId));
    const recordCount = await upsertBatch(RECORDS, familyCode, 'id', recordDocs);

    const babyDocs = (Array.isArray(babies) ? babies : [])
      .filter(item => item && (item.id || item.babyId))
      .map(item => toBabyDoc(item, familyCode, now));
    const babyCount = await upsertBatch(BABIES, familyCode, 'babyId', babyDocs);

    return { count: recordCount, babyCount, serverTime: now };
  },

  /** 增量拉取：since 为上次同步返回的 serverTime */
  async pull({ token, since = 0 } = {}) {
    const me = await requireMember(token);
    const cmd = db.command;
    const where = since
      ? { syncCode: me.familyCode, serverUpdatedAt: cmd.gte(Number(since)) }
      : { syncCode: me.familyCode };

    const records = [];
    let skip = 0;
    for (;;) {
      const res = await db.collection(RECORDS).where(where).orderBy('time', 'desc').skip(skip).limit(PAGE_SIZE).get();
      const rows = (res && res.data) || [];
      rows.forEach(row => records.push(stripRecord(row)));
      if (rows.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
      if (skip > 20000) break;
    }

    const babyWhere = since
      ? { syncCode: me.familyCode, serverUpdatedAt: cmd.gte(Number(since)) }
      : { syncCode: me.familyCode };
    const babyRes = await db.collection(BABIES).where(babyWhere).limit(100).get();
    const babies = (babyRes.data || []).map(stripBaby);

    return {
      records,
      babies,
      role: me.role,
      familyCode: me.familyCode,
      serverTime: Date.now()
    };
  }
};

/** createFamily 的实际落库逻辑，登录态不同分支共用 */
async function createFamilyFor(member, baby) {
  const now = Date.now();
  let code = randomCode(6);
  // 极小概率重复，重试几次避免直接失败
  for (let i = 0; i < 5; i += 1) {
    const existed = await db.collection(FAMILIES).where({ code }).limit(1).get();
    if (!existed.data || !existed.data.length) break;
    code = randomCode(6);
  }

  await db.collection(FAMILIES).add({ code, ownerId: member.memberId, createdAt: now });
  await db
    .collection(MEMBERS)
    .doc(member._id)
    .update({ familyCode: code, role: 'owner', active: true, joinedAt: now, updatedAt: now });

  if (baby) {
    const doc = toBabyDoc(baby, code, now);
    await db.collection(BABIES).add(doc);
  }

  return { familyCode: code, role: 'owner', memberId: member.memberId };
}
