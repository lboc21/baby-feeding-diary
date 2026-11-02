/**
 * 生成 tabBar 图标（81x81 PNG）。
 * 纯 Node 实现：4 倍超采样描边绘制 + zlib 编码 PNG，避免引入图形依赖。
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 81;
const SS = 4; // 超采样倍数
const W = SIZE * SS;

const COLORS = {
  normal: [0x9c, 0x95, 0x99],
  active: [0xff, 0x7b, 0x8b]
};

function createMask() {
  return new Float32Array(W * W);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** 超采样绘制：逐点命中测试，erase 为真时挖空形状 */
function shape(mask, hitTest, erase) {
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (hitTest((x + 0.5) / SS, (y + 0.5) / SS)) {
        mask[y * W + x] = erase ? 0 : 1;
      }
    }
  }
}

function rect(mask, x, y, w, h, r, erase) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  shape(
    mask,
    (px, py) => {
      const dx = Math.abs(px - cx) - (w / 2 - r);
      const dy = Math.abs(py - cy) - (h / 2 - r);
      if (dx <= 0 && dy <= 0) return true;
      return Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2 <= r * r;
    },
    erase
  );
}

function circle(mask, cx, cy, r, erase) {
  shape(mask, (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r, erase);
}

function triangle(mask, p1, p2, p3) {
  const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  shape(
    mask,
    (px, py) => {
      const d1 = sign(px, py, p1[0], p1[1], p2[0], p2[1]);
      const d2 = sign(px, py, p2[0], p2[1], p3[0], p3[1]);
      const d3 = sign(px, py, p3[0], p3[1], p1[0], p1[1]);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(hasNeg && hasPos);
    },
    false
  );
}

/** 头像 + 肩部：胶囊形 */
function capsule(mask, x, y, w, h) {
  rect(mask, x, y, w, h, h / 2, false);
}

function drawHome(mask) {
  triangle(mask, [40.5, 13], [69, 39], [12, 39]);
  rect(mask, 17, 34, 47, 33, 7, false);
  rect(mask, 34, 46, 13, 21, 5, true);
}

function drawRecords(mask) {
  const rows = [25, 39, 53];
  rows.forEach(y => {
    circle(mask, 19, y + 4.5, 4.6, false);
    rect(mask, 30, y, 34, 9, 4.5, false);
  });
}

function drawStats(mask) {
  rect(mask, 14, 41, 14, 26, 5, false);
  rect(mask, 33.5, 22, 14, 45, 5, false);
  rect(mask, 53, 33, 14, 34, 5, false);
}

function drawMine(mask) {
  circle(mask, 40.5, 26, 13, false);
  capsule(mask, 17, 46, 47, 26);
}

function downsample(mask, color) {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let sum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          sum += mask[(y * SS + sy) * W + (x * SS + sx)];
        }
      }
      const alpha = clamp(Math.round((sum / (SS * SS)) * 255), 0, 255);
      const i = (y * SIZE + x) * 4;
      out[i] = color[0];
      out[i + 1] = color[1];
      out[i + 2] = color[2];
      out[i + 3] = alpha;
    }
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba) {
  const stride = SIZE * 4;
  const raw = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const offset = y * (stride + 1);
    raw[offset] = 0;
    rgba.copy(raw, offset + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const ICONS = {
  today: drawHome,
  records: drawRecords,
  stats: drawStats,
  mine: drawMine
};

const outDir = path.resolve(__dirname, '..', 'src', 'static', 'tabbar');
fs.mkdirSync(outDir, { recursive: true });

Object.keys(ICONS).forEach(name => {
  const draw = ICONS[name];
  [
    ['', 'normal'],
    ['-active', 'active']
  ].forEach(([suffix, key]) => {
    const mask = createMask();
    draw(mask);
    const file = path.join(outDir, `${name}${suffix}.png`);
    fs.writeFileSync(file, encodePng(downsample(mask, COLORS[key])));
  });
});

console.log(`[icons] 已生成 ${Object.keys(ICONS).length * 2} 个 tabBar 图标 -> src/static/tabbar`);
