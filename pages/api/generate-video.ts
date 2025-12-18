import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import fs from 'fs'
import os from 'os'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import sharp from 'sharp'
import { execSync } from 'child_process'
import { getObjectBuffer, uploadToS3 } from '../../lib/s3'
import { getTemplateById } from '../../lib/templates'

// Resolve a usable ffmpeg binary path:
// Priority: FFMPEG_PATH env var -> bundled ffmpeg-static -> system `ffmpeg` on PATH
let ffmpegPath: string | null = process.env.FFMPEG_PATH || (ffmpegStatic || null)
try {
  // If ffmpegStatic points to a file but it may not exist in serverless builds; verify
  if (ffmpegPath && !require('fs').existsSync(ffmpegPath)) {
    ffmpegPath = null
  }
} catch (err) {
  ffmpegPath = null
}
if (!ffmpegPath) {
  try {
    // Use the node 'which' package instead of shelling out to `which` (some hosts don't have it)
    // the package is already a dependency (used by fluent-ffmpeg), so require it safely
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const whichPkg = require('which') as { sync: (name: string) => string }
    const whichPath = whichPkg.sync('ffmpeg')
    if (whichPath) ffmpegPath = whichPath
  } catch (err) {
    ffmpegPath = null
  }
}
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
} else {
  // Not setting ffmpeg path here — handler will return a helpful error if ffmpeg is needed
  console.warn('FFmpeg binary not found. Set FFMPEG_PATH env var, bundle a compatible ffmpeg binary, or install ffmpeg on PATH.')
}

type Body = {
  imageKey: string
  templateId: string
  productName?: string
  includeText?: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageKey, templateId, productName, includeText } = req.body as Body
  if (!imageKey || !templateId) return res.status(400).json({ error: 'Missing params' })

  const template = getTemplateById(templateId)
  if (!template) return res.status(400).json({ error: 'Invalid template' })

  // Ensure ffmpeg is available before proceeding — provide an actionable error rather than a cryptic ENOENT
  if (!ffmpegPath) {
    return res.status(500).json({ error: 'FFmpeg binary not found. Set FFMPEG_PATH, install ffmpeg on PATH, or include a compatible ffmpeg binary for your host.' })
  }

  try {
    // Download image from S3
    const imageBuffer = await getObjectBuffer(imageKey)
    const tmpDir = os.tmpdir()
    const inputImagePath = path.join(tmpDir, `input-${Date.now()}.jpg`)
    const outputVideoPath = path.join(tmpDir, `output-${Date.now()}.mp4`)
    fs.writeFileSync(inputImagePath, imageBuffer)

    // Music file from public folder
    const musicFullPath = path.join(process.cwd(), 'public', template.musicFile)
    let audioFileAvailable = false
    try {
      const stat = fs.statSync(musicFullPath)
      audioFileAvailable = stat.size > 1024
    } catch (e: any) {
      audioFileAvailable = false
    }

    // Decide whether we should render text
    const showText = includeText !== false && !!productName && productName.trim().length > 0

    const fps = 25
    const frames = template.durationSeconds * fps
    const zoomFactor = 0.6

    if (template.style === 'zoom') {
      // Generate frames with Sharp
      const framesDir = path.join(tmpDir, `frames-${Date.now()}`)
      fs.mkdirSync(framesDir, { recursive: true })

      const metadata = await sharp(imageBuffer).metadata()
      const iw = metadata.width || 1280
      const ih = metadata.height || 720
      const minFactor = Math.max(1280 / iw, 720 / ih)

      // Use smooth ease-in-out timing for zoom to avoid a robotic, linear feel.
      const easeInOutSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2

      for (let i = 0; i < frames; i++) {
        const t = frames === 1 ? 1 : i / (frames - 1)
        const et = easeInOutSine(t) // eased time between 0..1
        let factor = 1 + zoomFactor * et
        factor = Math.max(factor, minFactor)

        // Use float scale to compute center offsets, round only where required to reduce stepping artifacts
        const floatScaledW = iw * factor
        const floatScaledH = ih * factor
        const scaledW = Math.round(floatScaledW)
        const scaledH = Math.round(floatScaledH)
        const left = Math.max(0, Math.round((floatScaledW - 1280) / 2))
        const top = Math.max(0, Math.round((floatScaledH - 720) / 2))

        const outPath = path.join(framesDir, `frame-${String(i).padStart(4, '0')}.png`)
        // Resize then extract center crop. If showText is enabled, render it as SVG and composite
        let pipeline = sharp(imageBuffer).resize(scaledW, scaledH, { kernel: sharp.kernel.lanczos3 }).extract({ left, top, width: Math.min(1280, scaledW), height: Math.min(720, scaledH) })
        if (showText) {
          const escapeXml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;')
          const text = escapeXml(productName!.trim())
          const fontSize = Math.max(28, Math.round(Math.min(scaledW, scaledH) / 24))
          const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">\n  <style>\n    .title { fill: white; font-size: ${fontSize}px; font-weight: 700; font-family: Arial, Helvetica, sans-serif; text-anchor: middle; }\n    .shadow { fill: black; opacity: 0.6; font-size: ${fontSize}px; font-weight:700; font-family: Arial, Helvetica, sans-serif; text-anchor: middle; }\n  </style>\n  <g>\n    <text x="50%" y="88%" class="shadow" dy="2">${text}</text>\n    <text x="50%" y="86%" class="title">${text}</text>\n  </g>\n</svg>`
          pipeline = pipeline.composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
        }
        await pipeline.png().toFile(outPath)
      }

      // Frames already have the product name composited (if provided), so no drawtext filter is needed here.
      // Assemble frames into video
      await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg()
          .input(path.join(framesDir, 'frame-%04d.png'))
          .inputOptions(['-framerate', String(fps)])

        if (audioFileAvailable) {
          cmd.input(musicFullPath)
        } else {
          cmd.input('anullsrc=channel_layout=stereo:sample_rate=44100').inputOptions(['-f', 'lavfi'])
        }

        cmd
          .outputOptions(['-y', `-t ${template.durationSeconds}`, '-c:v libx264', '-pix_fmt yuv420p', '-c:a aac', '-shortest'])
          .on('start', (line) => console.log('FFmpeg start:', line))
          .on('stderr', (line) => console.warn('FFmpeg stderr:', line))
          .on('error', (err) => reject(err))
          .on('end', () => resolve())
          .save(outputVideoPath)
      })

      // Cleanup frames
      fs.rmSync(framesDir, { recursive: true, force: true })

    } else {
      // slide style: pre-composite product name onto the input image (so we avoid drawtext filter)
      let slideInput = inputImagePath
      if (showText) {
        try {
          const meta = await sharp(inputImagePath).metadata()
          const w = meta.width || 1280
          const h = meta.height || 720
          const fontSize = Math.max(28, Math.round(w / 24))
          const escapeXml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
          const text = escapeXml(productName!.trim())
          const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">\n  <style>\n    .title { fill: white; font-size: ${fontSize}px; font-weight: 700; font-family: Arial, Helvetica, sans-serif; text-anchor: middle; }\n    .shadow { fill: black; opacity: 0.6; font-size: ${fontSize}px; font-weight:700; font-family: Arial, Helvetica, sans-serif; text-anchor: middle; }\n  </style>\n  <g>\n    <text x="50%" y="88%" class="shadow" dy="2">${text}</text>\n    <text x="50%" y="86%" class="title">${text}</text>\n  </g>\n</svg>`
          const withTextPath = path.join(tmpDir, `slide-input-${Date.now()}.png`)
          await sharp(inputImagePath).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(withTextPath)
          slideInput = withTextPath
        } catch (e: any) {
          console.warn('Failed to composite text onto slide image; proceeding without text', e?.message)
        }
      }

      const slideFps = fps
      const slideFrames = template.durationSeconds * slideFps
      const filters = [
        `fps=${slideFps},scale=1280:-1`,
        `crop=1280:720:x='min(max(0,(iw-1280)*n/${slideFrames}),iw-1280)':y=0`
      ]

      await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg()
          .input(slideInput)
          .inputOptions(['-loop', '1'])
        if (audioFileAvailable) {
          cmd.input(musicFullPath)
        } else {
          cmd.input('anullsrc=channel_layout=stereo:sample_rate=44100').inputOptions(['-f', 'lavfi'])
        }

        cmd
          .videoFilters(filters.join(','))
          .outputOptions(['-y', `-t ${template.durationSeconds}`, '-c:v libx264', '-pix_fmt yuv420p', '-c:a aac', '-shortest'])
          .on('start', (line) => console.log('FFmpeg start slide:', line))
          .on('stderr', (line) => console.warn('FFmpeg stderr slide:', line))
          .on('error', (err) => reject(err))
          .on('end', () => resolve())
          .save(outputVideoPath)
      })

      // Cleanup slide temp image if created
      try { if (typeof slideInput !== 'undefined' && slideInput !== inputImagePath) fs.unlinkSync(slideInput) } catch (e: any) {}
    }

    // Upload video to S3
    const videoBuffer = fs.readFileSync(outputVideoPath)
    const key = `videos/${Date.now()}-${path.basename(outputVideoPath)}.mp4`
    const videoUrl = await uploadToS3(key, videoBuffer, 'video/mp4')

    // Cleanup
    fs.unlinkSync(inputImagePath)
    fs.unlinkSync(outputVideoPath)

    return res.status(200).json({ videoUrl })
  } catch (e: any) {
    console.error('Video generation failed', e)
    return res.status(500).json({ error: e.message || 'Video generation failed' })
  }
}
