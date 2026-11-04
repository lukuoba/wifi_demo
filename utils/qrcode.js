/**
 * 精简二维码编码器（字节模式，纠错级 M，版本 1-5 自动选择，固定掩码 2）
 * 基于 qrcode-generator（MIT）算法结构裁剪，仅保留小程序邀请码所需能力。
 *
 * 用法：
 *   const { createQRMatrix } = require('../../utils/qrcode.js');
 *   const { size, modules } = createQRMatrix('https://taoyity.cn/g?gameId=123');
 *   // modules: boolean[size][size]，true 为黑点
 */

/* ------------------------------------------------------------------ */
/* GF(256) 伽罗瓦域运算（本原多项式 0x11D）                             */
/* ------------------------------------------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

function gMul(a, b) {
  return a && b ? EXP[LOG[a] + LOG[b]] : 0;
}

/* ------------------------------------------------------------------ */
/* Reed-Solomon 纠错码                                                  */
/* ------------------------------------------------------------------ */

// 生成多项式系数（degree = ecCount）
function rsGeneratorPoly(ecCount) {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// data: 数据码字数组 → 返回 ecCount 个纠错码字
function rsEncode(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  let rem = new Array(ecCount).fill(0);
  for (const d of data) {
    const factor = d ^ rem[0];
    rem = rem.slice(1).concat(0);
    for (let j = 0; j < ecCount; j++) {
      rem[j] ^= gMul(gen[j + 1] || 0, factor);
    }
  }
  return rem;
}

/* ------------------------------------------------------------------ */
/* 版本参数（纠错级 M）：总数据码字 / 分块 / 每块纠错码字 / 校正图形中心      */
/* ------------------------------------------------------------------ */

const VERSIONS = [
  { version: 1, size: 21, dataCount: 16, blocks: 1, dataPerBlock: 16, ecPerBlock: 10, align: [] },
  { version: 2, size: 25, dataCount: 28, blocks: 1, dataPerBlock: 28, ecPerBlock: 16, align: [6, 18] },
  { version: 3, size: 29, dataCount: 44, blocks: 1, dataPerBlock: 44, ecPerBlock: 26, align: [6, 22] },
  { version: 4, size: 33, dataCount: 64, blocks: 2, dataPerBlock: 32, ecPerBlock: 18, align: [6, 24] },
  { version: 5, size: 37, dataCount: 86, blocks: 2, dataPerBlock: 43, ecPerBlock: 24, align: [6, 30] }
];

const EC_LEVEL_BITS = 0; // 纠错级 M 的 3 位标识
const MASK_PATTERN = 2;  // 固定掩码 2：(col % 3 === 0)

const G15 = 0x537;      // BCH 生成多项式 x10+x8+x5+x4+x2+x+1
const G15_MASK = 0x5412;

function bchDigit(value) {
  let digit = 0;
  while (value !== 0) {
    digit++;
    value >>>= 1;
  }
  return digit;
}

// 计算 15 位格式信息（含掩码 XOR）
function bchFormatInfo(data) {
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) {
    d ^= G15 << (bchDigit(d) - bchDigit(G15));
  }
  return ((data << 10) | d) ^ G15_MASK;
}

/* ------------------------------------------------------------------ */
/* 矩阵构造                                                             */
/* ------------------------------------------------------------------ */

function createQRMatrix(text) {
  const bytes = toUtf8Bytes(text);

  // 选择最小可容纳版本
  const spec = VERSIONS.find((v) => 2 + bytes.length <= v.dataCount);
  if (!spec) {
    const max = VERSIONS[VERSIONS.length - 1].dataCount - 2;
    throw new Error(`二维码内容过长（最多 ${max} 字节）`);
  }

  /* 1. 构造最终码字序列（数据 + 纠错，多块时交错） */
  const finalBytes = buildCodewords(bytes, spec);

  /* 2. 初始化模块矩阵（null = 未放置，留给数据区） */
  const size = spec.size;
  const modules = [];
  for (let r = 0; r < size; r++) {
    modules.push(new Array(size).fill(null));
  }

  setupFinderPattern(modules, size);
  setupTimingPattern(modules, size);
  setupAlignmentPattern(modules, size, spec.align);
  setupFormatInfo(modules, size, bchFormatInfo((EC_LEVEL_BITS << 3) | MASK_PATTERN));

  /* 3. 数据 + 掩码 */
  placeData(modules, size, finalBytes);

  /* 4. null 兜底置黑（理论上不应出现） */
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c] === null) modules[r][c] = false;
    }
  }

  return { size, modules };
}

function toUtf8Bytes(text) {
  // 小程序环境没有 TextEncoder，手动 UTF-8 编码
  const out = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      code = 0x10000 + ((code - 0xd800) << 10) + (text.charCodeAt(i + 1) - 0xdc00);
      i++;
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return out;
}

function buildCodewords(bytes, spec) {
  // 位流：模式指示符 0100 + 8 位长度 + 数据
  const bitBuffer = [];
  pushBits(bitBuffer, 4, 0b0100);
  pushBits(bitBuffer, 8, bytes.length);
  for (const b of bytes) pushBits(bitBuffer, 8, b);

  // 终止符（最多 4 个 0）+ 补齐到字节边界
  const dataTotalBits = spec.dataCount * 8;
  for (let i = 0; i < 4 && bitBuffer.length < dataTotalBits; i++) bitBuffer.push(0);
  while (bitBuffer.length % 8 !== 0) bitBuffer.push(0);

  // 转码字
  const dataCodewords = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bitBuffer[i + j];
    dataCodewords.push(v);
  }

  // 补齐填充 0xEC / 0x11 交替
  const pads = [0xec, 0x11];
  let padIdx = 0;
  while (dataCodewords.length < spec.dataCount) {
    dataCodewords.push(pads[padIdx++ % 2]);
  }

  // 分块计算纠错码
  const blocks = [];
  for (let b = 0; b < spec.blocks; b++) {
    const block = dataCodewords.slice(b * spec.dataPerBlock, (b + 1) * spec.dataPerBlock);
    blocks.push({ data: block, ec: rsEncode(block, spec.ecPerBlock) });
  }

  // 交错合并
  const out = [];
  for (let i = 0; i < spec.dataPerBlock; i++) {
    for (const block of blocks) out.push(block.data[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of blocks) out.push(block.ec[i]);
  }
  return out;
}

function pushBits(buffer, length, value) {
  for (let i = length - 1; i >= 0; i--) {
    buffer.push((value >>> i) & 1);
  }
}

function setupFinderPattern(modules, size) {
  const probes = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7]
  ];
  for (const [row, col] of probes) {
    for (let r = -1; r <= 7; r++) {
      if (row + r < 0 || row + r >= size) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c < 0 || col + c >= size) continue;
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        modules[row + r][col + c] = dark;
      }
    }
  }
}

function setupTimingPattern(modules, size) {
  for (let r = 8; r < size - 8; r++) {
    if (modules[r][6] === null) modules[r][6] = r % 2 === 0;
  }
  for (let c = 8; c < size - 8; c++) {
    if (modules[6][c] === null) modules[6][c] = c % 2 === 0;
  }
}

function setupAlignmentPattern(modules, size, centers) {
  for (const row of centers) {
    for (const col of centers) {
      // 跳过与定位图形重叠的角
      if ((row === 6 && col === 6) || (row === 6 && col === size - 7) || (row === size - 7 && col === 6)) continue;
      if (modules[row][col] !== null) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          modules[row + r][col + c] =
            r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
        }
      }
    }
  }
}

function setupFormatInfo(modules, size, bits) {
  // 副本一（左上）垂直：bit 0-5 → (0..5, 8)，bit 6/7 → (7/8, 8)
  // 副本二（右下）垂直：bit 8-14 → (size-15+i, 8)
  for (let i = 0; i < 15; i++) {
    const mod = ((bits >> i) & 1) === 1;
    if (i < 6) {
      modules[i][8] = mod;
    } else if (i < 8) {
      modules[i + 1][8] = mod;
    } else {
      modules[size - 15 + i][8] = mod;
    }
  }

  // 副本二（右下）水平：bit 0-7 → (8, size-1-i)
  // 副本一（左上）水平：bit 8 → (8, 7)，bit 9-14 → (8, 5..0)
  for (let i = 0; i < 15; i++) {
    const mod = ((bits >> i) & 1) === 1;
    if (i < 8) {
      modules[8][size - 1 - i] = mod;
    } else if (i < 9) {
      modules[8][15 - i] = mod;
    } else {
      modules[8][14 - i] = mod;
    }
  }

  // 固定暗模块
  modules[size - 8][8] = true;
}

function placeData(modules, size, codewords) {
  let inc = -1;
  let row = size - 1;
  let bitIndex = 7;
  let byteIndex = 0;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // 跳过 timing 列
    while (true) {
      for (let c = 0; c < 2; c++) {
        if (modules[row][col - c] === null) {
          let dark = false;
          if (byteIndex < codewords.length) {
            dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
          }
          // 掩码 2（MASK_PATTERN）：(col % 3 === 0) 时反转
          if ((col - c) % 3 === 0) dark = !dark;
          modules[row][col - c] = dark;
          bitIndex--;
          if (bitIndex === -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }
      row += inc;
      if (row < 0 || row >= size) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }
}

module.exports = {
  createQRMatrix
};
