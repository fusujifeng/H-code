#!/usr/bin/env node
/**
 * Generate platform icons from src/renderer/assets/appIcon.png
 * Outputs to resources/icon.ico (Windows), resources/icon.png (Linux/macOS)
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const srcPng = path.join(root, 'src/renderer/assets/appIcon.png')
const outDir = path.join(root, 'resources')

if (!fs.existsSync(srcPng)) {
  console.error('Source icon not found:', srcPng)
  process.exit(1)
}

const pngBuffer = fs.readFileSync(srcPng)
console.log('Source:', srcPng, `(${pngBuffer.length} bytes)`)

// Ensure output directory exists
fs.mkdirSync(outDir, { recursive: true })

// ── Linux/macOS: copy PNG directly ────────────────────────────
const iconPngPath = path.join(outDir, 'icon.png')
fs.writeFileSync(iconPngPath, pngBuffer)
console.log('Created:', iconPngPath)

// ── Windows: create ICO with embedded PNG ──────────────────────
function createIco(pngData) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // ICO type
  header.writeUInt16LE(1, 4) // 1 image

  const entry = Buffer.alloc(16)
  const w = Math.min(pngData.readUInt32BE(16), 256)
  const h = Math.min(pngData.readUInt32BE(20), 256)
  entry.writeUInt8(w >= 256 ? 0 : w, 0) // 0 = 256
  entry.writeUInt8(h >= 256 ? 0 : h, 1)
  entry.writeUInt8(0, 2) // no palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bpp
  entry.writeUInt32LE(pngData.length, 8) // image size
  entry.writeUInt32LE(22, 12) // offset from file start

  return Buffer.concat([header, entry, pngData])
}

const icoPath = path.join(outDir, 'icon.ico')
fs.writeFileSync(icoPath, createIco(pngBuffer))
console.log('Created:', icoPath)

console.log('Done.')
