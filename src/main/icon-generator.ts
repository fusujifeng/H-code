import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { dirname } from 'path'
import { deflateSync } from 'zlib'

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** 预计算 CRC32 查找表 */
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    t[i] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, 'ascii')
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  const l = Buffer.alloc(4)
  l.writeUInt32BE(data.length, 0)
  return Buffer.concat([l, t, data, c])
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b
}

/** 判断点是否在四角星（Sparkle）内 */
function pointInSparkle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  maxDist: number
): boolean {
  const dx = px - cx
  const dy = py - cy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // 中心圆
  if (dist <= maxDist * 0.22) return true
  if (dist > maxDist) return false

  const angle = Math.atan2(dy, dx)
  const normalized = Math.abs(mod(angle + Math.PI / 4, Math.PI / 2) - Math.PI / 4)

  // 臂宽随距离增加而变窄
  const maxWidth = 0.35 - 0.18 * (dist / maxDist)
  return normalized < maxWidth
}

/**
 * 生成托盘 / 任务栏图标：白色圆形背景 + 金黄色四角星。
 * 若文件已存在则先删除再重写，保证样式更新。
 */
export function generateStarIcon(path: string, size = 32): void {
  if (existsSync(path)) {
    try { unlinkSync(path) } catch { /* ignore */ }
  }
  mkdirSync(dirname(path), { recursive: true })

  const cx = size / 2
  const cy = size / 2
  const circleR = size * 0.46
  const starMaxDist = size * 0.4

  const rowSize = 1 + size * 4
  const raw = Buffer.alloc(size * rowSize)

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0 // filter byte: none
    for (let x = 0; x < size; x++) {
      const off = y * rowSize + 1 + x * 4
      const dist = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)

      if (dist <= circleR) {
        // 白色圆形背景
        raw[off] = 255
        raw[off + 1] = 255
        raw[off + 2] = 255
        raw[off + 3] = 255
      }

      if (pointInSparkle(x + 0.5, y + 0.5, cx, cy, starMaxDist)) {
        // 金黄色星星覆盖
        raw[off] = 245
        raw[off + 1] = 166
        raw[off + 2] = 35
        raw[off + 3] = 255
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type: RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter method
  ihdr[12] = 0  // interlace

  const png = Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])

  writeFileSync(path, png)
}
