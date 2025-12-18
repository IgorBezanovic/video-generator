// Decode any .b64 files under public/musics into binary .mp3 files
const fs = require('fs')
const path = require('path')

const musicsDir = path.join(process.cwd(), 'public', 'musics')
if (!fs.existsSync(musicsDir)) fs.mkdirSync(musicsDir, { recursive: true })

const files = fs.readdirSync(musicsDir).filter(f => f.endsWith('.b64'))
for (const f of files) {
  try {
    const base64 = fs.readFileSync(path.join(musicsDir, f), 'utf8').trim()
    if (!base64) continue
    const buf = Buffer.from(base64, 'base64')
    const out = f.replace(/\.b64$/, '')
    fs.writeFileSync(path.join(musicsDir, out), buf)
    console.log(`Decoded ${f} -> ${out}`)
  } catch (err) {
    console.warn('Failed to decode', f, err)
  }
}
