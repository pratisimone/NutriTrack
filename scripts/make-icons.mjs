// Genera le icone PNG della PWA (anello "progresso" su sfondo scuro) senza dipendenze.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function render(size) {
  const bg = [11, 15, 20]
  const track = [36, 48, 65]
  const g1 = [52, 211, 153]
  const g2 = [96, 165, 250]
  const cx = size / 2
  const R = size * 0.3
  const half = size * 0.065
  const aa = 1.2
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const progress = 0.72
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cx
      const d = Math.hypot(dx, dy)
      const ringCov = 1 - smooth(half - aa, half + aa, Math.abs(d - R))
      // angolo 0 = ore 12, senso orario
      let ang = Math.atan2(dx, -dy)
      if (ang < 0) ang += Math.PI * 2
      const frac = ang / (Math.PI * 2)
      const col = frac <= progress ? mix(g1, g2, frac / progress) : track
      let px = mix(bg, col, ringCov)
      // pallino centrale
      const dot = 1 - smooth(size * 0.06 - aa, size * 0.06 + aa, d)
      px = mix(px, g1, dot)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = px[0]
      raw[o + 1] = px[1]
      raw[o + 2] = px[2]
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/pwa-192.png', render(192))
writeFileSync('public/pwa-512.png', render(512))
writeFileSync('public/apple-touch-icon.png', render(180))
console.log('icone generate')
