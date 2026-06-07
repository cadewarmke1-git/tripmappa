/** One-off: gold star on dark background PNG icons for PWA manifest. */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BG = [0x0d, 0x0a, 0x1a, 0xff];
const GOLD = [0xff, 0xd2, 0x8c, 0xff];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function inStar(x, y, cx, cy, outerR, innerR, points = 5) {
  const dx = x - cx;
  const dy = y - cy;
  const angle = Math.atan2(dy, dx) + Math.PI / 2;
  const dist = Math.hypot(dx, dy);
  const sector = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const step = (2 * Math.PI) / points;
  const local = sector % step;
  const t = local / step;
  const r = t < 0.5
    ? outerR - (outerR - innerR) * (t * 2)
    : innerR + (outerR - innerR) * ((t - 0.5) * 2);
  return dist <= r;
}

function createIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.34;
  const innerR = size * 0.14;
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const star = inStar(x + 0.5, y + 0.5, cx, cy, outerR, innerR);
      const color = star ? GOLD : BG;
      raw[offset++] = color[0];
      raw[offset++] = color[1];
      raw[offset++] = color[2];
      raw[offset++] = color[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const out = resolve(__dirname, "..", "public", `icon-${size}.png`);
  writeFileSync(out, createIcon(size));
  console.log("Wrote", out);
}
