/**
 * 九类记录的元数据与动态表单配置。
 * 表单页、时间轴、统计页都基于这里的定义渲染，后续新增记录类型只需在此登记。
 */

const sideLabel = { left: '左侧', right: '右侧', both: '双侧' };
const diaperLabel = { pee: '尿了', poo: '大便', mixed: '尿+便' };
const feedingLabel = { breast: '亲喂', bottle: '瓶喂母乳', formula: '配方奶' };
const methodLabel = { 腋温: '腋温', 耳温: '耳温', 额温: '额温', 肛温: '肛温' };

export const RECORD_TYPES = [
  {
    key: 'feeding',
    name: '喂养',
    icon: '🍼',
    color: '#ff8fa3',
    bg: '#fff1f4',
    desc: '亲喂 / 瓶喂 / 配方奶',
    fields: [
      {
        key: 'mode',
        label: '方式',
        type: 'chips',
        default: 'breast',
        options: [
          { label: '亲喂', value: 'breast' },
          { label: '瓶喂母乳', value: 'bottle' },
          { label: '配方奶', value: 'formula' }
        ]
      },
      {
        key: 'side',
        label: '侧别',
        type: 'chips',
        default: 'both',
        show: f => f.mode === 'breast',
        options: [
          { label: '左侧', value: 'left' },
          { label: '右侧', value: 'right' },
          { label: '双侧', value: 'both' }
        ]
      },
      {
        key: 'duration',
        label: '时长',
        type: 'stepper',
        unit: '分钟',
        min: 1,
        max: 180,
        step: 1,
        default: 15,
        show: f => f.mode === 'breast'
      },
      {
        key: 'amount',
        label: '奶量',
        type: 'stepper',
        unit: 'ml',
        min: 5,
        max: 500,
        step: 5,
        default: 90,
        show: f => f.mode !== 'breast'
      }
    ],
    summary(r) {
      const p = r.payload || {};
      if (p.mode === 'breast') {
        return `${feedingLabel.breast} · ${sideLabel[p.side] || '双侧'} · ${p.duration || 0}分钟`;
      }
      const amount = p.amount ? `${p.amount}ml` : '';
      return `${feedingLabel[p.mode] || '喂养'} ${amount}`.trim();
    }
  },
  {
    key: 'diaper',
    name: '换尿布',
    icon: '💧',
    color: '#6fa8e8',
    bg: '#eef5ff',
    desc: '尿布 / 便便性状',
    fields: [
      {
        key: 'kind',
        label: '类型',
        type: 'chips',
        default: 'pee',
        options: [
          { label: '尿了', value: 'pee' },
          { label: '大便', value: 'poo' },
          { label: '尿+便', value: 'mixed' }
        ]
      },
      {
        key: 'stoolColor',
        label: '便便颜色',
        type: 'chips',
        default: '金黄',
        show: f => f.kind !== 'pee',
        options: [
          { label: '金黄', value: '金黄' },
          { label: '黄绿', value: '黄绿' },
          { label: '绿色', value: '绿色' },
          { label: '棕色', value: '棕色' },
          { label: '黑色', value: '黑色' },
          { label: '红色', value: '红色' },
          { label: '白陶土', value: '白陶土' }
        ]
      },
      {
        key: 'stoolTexture',
        label: '便便性状',
        type: 'chips',
        default: '糊状',
        show: f => f.kind !== 'pee',
        options: [
          { label: '稀水样', value: '稀水样' },
          { label: '糊状', value: '糊状' },
          { label: '成形', value: '成形' },
          { label: '干硬', value: '干硬' }
        ]
      }
    ],
    summary(r) {
      const p = r.payload || {};
      const base = diaperLabel[p.kind] || '尿布';
      if (p.kind === 'pee') return base;
      return `${base} · ${p.stoolColor || ''}${p.stoolTexture || ''}`;
    }
  },
  {
    key: 'sleep',
    name: '睡眠',
    icon: '🌙',
    color: '#9b8ce8',
    bg: '#f2efff',
    desc: '入睡时间与时长',
    fields: [
      {
        key: 'duration',
        label: '睡眠时长',
        type: 'stepper',
        unit: '分钟',
        min: 5,
        max: 1440,
        step: 5,
        default: 60
      },
      {
        key: 'quality',
        label: '睡眠质量',
        type: 'chips',
        default: '安稳',
        options: [
          { label: '安稳', value: '安稳' },
          { label: '易醒', value: '易醒' },
          { label: '哭闹', value: '哭闹' }
        ]
      }
    ],
    summary(r) {
      const p = r.payload || {};
      const h = Math.floor((p.duration || 0) / 60);
      const m = (p.duration || 0) % 60;
      const text = h ? (m ? `${h}小时${m}分` : `${h}小时`) : `${m}分钟`;
      return `睡眠 ${text}${p.quality ? ` · ${p.quality}` : ''}`;
    }
  },
  {
    key: 'growth',
    name: '身高体重',
    icon: '📏',
    color: '#45b49b',
    bg: '#eaf8f4',
    desc: '身高 / 体重 / 头围',
    fields: [
      { key: 'height', label: '身高', type: 'number', unit: 'cm', placeholder: '如 52.5' },
      { key: 'weight', label: '体重', type: 'number', unit: 'kg', placeholder: '如 3.6' },
      { key: 'head', label: '头围', type: 'number', unit: 'cm', placeholder: '选填' }
    ],
    summary(r) {
      const p = r.payload || {};
      const parts = [];
      if (p.height) parts.push(`身高 ${p.height}cm`);
      if (p.weight) parts.push(`体重 ${p.weight}kg`);
      if (p.head) parts.push(`头围 ${p.head}cm`);
      return parts.join(' · ') || '体格测量';
    }
  },
  {
    key: 'temperature',
    name: '体温',
    icon: '🌡️',
    color: '#ff9a5c',
    bg: '#fff3ea',
    desc: '体温与测量方式',
    fields: [
      { key: 'value', label: '体温', type: 'number', unit: '℃', default: 36.5, placeholder: '如 37.2' },
      {
        key: 'method',
        label: '测量方式',
        type: 'chips',
        default: '腋温',
        options: [
          { label: '腋温', value: '腋温' },
          { label: '耳温', value: '耳温' },
          { label: '额温', value: '额温' },
          { label: '肛温', value: '肛温' }
        ]
      }
    ],
    summary(r) {
      const p = r.payload || {};
      if (!p.value) return '体温';
      return `${p.value}℃ · ${methodLabel[p.method] || p.method || ''}`;
    }
  },
  {
    key: 'medicine',
    name: '用药',
    icon: '💊',
    color: '#e07fa5',
    bg: '#fcf0f5',
    desc: '药品 / 剂量 / 途径',
    fields: [
      { key: 'name', label: '药品名称', type: 'text', placeholder: '如 布洛芬混悬液' },
      { key: 'dose', label: '剂量', type: 'number', placeholder: '如 5' },
      {
        key: 'unit',
        label: '单位',
        type: 'chips',
        default: 'ml',
        options: [
          { label: 'ml', value: 'ml' },
          { label: 'mg', value: 'mg' },
          { label: '片', value: '片' },
          { label: '滴', value: '滴' },
          { label: '袋', value: '袋' }
        ]
      },
      {
        key: 'route',
        label: '给药方式',
        type: 'chips',
        default: '口服',
        options: [
          { label: '口服', value: '口服' },
          { label: '外用', value: '外用' },
          { label: '雾化', value: '雾化' },
          { label: '注射', value: '注射' }
        ]
      }
    ],
    summary(r) {
      const p = r.payload || {};
      if (!p.name) return '用药';
      const dose = p.dose ? ` ${p.dose}${p.unit || ''}` : '';
      return `${p.name}${dose}`;
    }
  },
  {
    key: 'jaundice',
    name: '黄疸',
    icon: '☀️',
    color: '#e8b23c',
    bg: '#fff8e8',
    desc: '经皮胆红素数值',
    fields: [
      { key: 'value', label: '数值', type: 'number', default: 5, placeholder: '经皮测量值' },
      {
        key: 'unit',
        label: '单位',
        type: 'chips',
        default: 'mg/dL',
        options: [
          { label: 'mg/dL', value: 'mg/dL' },
          { label: 'μmol/L', value: 'μmol/L' }
        ]
      },
      {
        key: 'parts',
        label: '测量部位',
        type: 'chips',
        multiple: true,
        default: ['额头'],
        options: [
          { label: '额头', value: '额头' },
          { label: '脸颊', value: '脸颊' },
          { label: '胸部', value: '胸部' },
          { label: '四肢', value: '四肢' }
        ]
      }
    ],
    summary(r) {
      const p = r.payload || {};
      if (!p.value) return '黄疸测量';
      const parts = Array.isArray(p.parts) && p.parts.length ? ` · ${p.parts.join('/')}` : '';
      return `${p.value}${p.unit || ''}${parts}`;
    }
  },
  {
    key: 'supplement',
    name: '补剂',
    icon: '🧴',
    color: '#7fbf9a',
    bg: '#eef8f2',
    desc: '维生素 D / 益生菌等',
    fields: [
      {
        key: 'name',
        label: '补剂种类',
        type: 'chips',
        default: '维生素D',
        options: [
          { label: '维生素D', value: '维生素D' },
          { label: '维生素AD', value: '维生素AD' },
          { label: '益生菌', value: '益生菌' },
          { label: '铁剂', value: '铁剂' },
          { label: '钙剂', value: '钙剂' },
          { label: '其他', value: '其他' }
        ]
      },
      { key: 'dose', label: '剂量', type: 'number', default: 400, placeholder: '如 400' },
      {
        key: 'unit',
        label: '单位',
        type: 'chips',
        default: 'IU',
        options: [
          { label: 'IU', value: 'IU' },
          { label: '滴', value: '滴' },
          { label: '粒', value: '粒' },
          { label: 'ml', value: 'ml' },
          { label: 'mg', value: 'mg' }
        ]
      }
    ],
    summary(r) {
      const p = r.payload || {};
      const dose = p.dose ? ` ${p.dose}${p.unit || ''}` : '';
      return `${p.name || '补剂'}${dose}`;
    }
  },
  {
    key: 'solid',
    name: '辅食',
    icon: '🥣',
    color: '#d9904f',
    bg: '#fdf3ea',
    desc: '食物 / 份量 / 反应',
    fields: [
      { key: 'food', label: '食物', type: 'text', placeholder: '如 高铁米粉' },
      { key: 'amount', label: '份量', type: 'number', default: 30, placeholder: '如 30' },
      {
        key: 'unit',
        label: '单位',
        type: 'chips',
        default: 'g',
        options: [
          { label: 'g', value: 'g' },
          { label: 'ml', value: 'ml' },
          { label: '勺', value: '勺' },
          { label: '块', value: '块' }
        ]
      },
      { key: 'firstTry', label: '首次尝试', type: 'switch', default: false, tip: '开启后会记录为过敏观察食物' },
      {
        key: 'reaction',
        label: '接受度',
        type: 'chips',
        default: '一般',
        options: [
          { label: '喜欢', value: '喜欢' },
          { label: '一般', value: '一般' },
          { label: '拒绝', value: '拒绝' },
          { label: '过敏', value: '过敏' }
        ]
      }
    ],
    summary(r) {
      const p = r.payload || {};
      const food = p.food || '辅食';
      const amount = p.amount ? ` ${p.amount}${p.unit || ''}` : '';
      const first = p.firstTry ? ' · 首次尝试' : '';
      return `${food}${amount}${first}`;
    }
  }
];

export const RECORD_TYPE_MAP = RECORD_TYPES.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});

export function getRecordType(type) {
  return RECORD_TYPE_MAP[type] || RECORD_TYPES[0];
}

/** 生成某类型的默认表单数据 */
export function createPayload(type) {
  const schema = getRecordType(type);
  const payload = {};
  schema.fields.forEach(field => {
    if (field.default !== undefined) {
      payload[field.key] = Array.isArray(field.default) ? [...field.default] : field.default;
    } else if (field.type === 'number' || field.type === 'stepper') {
      payload[field.key] = '';
    } else if (field.type === 'switch') {
      payload[field.key] = false;
    } else if (field.multiple) {
      payload[field.key] = [];
    } else {
      payload[field.key] = '';
    }
  });
  return payload;
}

/** 过滤出当前条件下应展示的字段 */
export function visibleFields(type, payload) {
  const schema = getRecordType(type);
  return schema.fields.filter(field => (typeof field.show === 'function' ? field.show(payload) : true));
}

export function recordSummary(record) {
  if (!record) return '';
  const schema = getRecordType(record.type);
  try {
    return schema.summary(record);
  } catch (e) {
    return schema.name;
  }
}
