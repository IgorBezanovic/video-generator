import type { NextApiRequest, NextApiResponse } from 'next'
import ffmpegStatic from 'ffmpeg-static'
import { execSync } from 'child_process'

function detectFfmpeg(): string | null {
  let ffmpegPath: string | null = process.env.FFMPEG_PATH || (ffmpegStatic || null)
  try {
    if (ffmpegPath && !require('fs').existsSync(ffmpegPath)) ffmpegPath = null
  } catch (err) {
    ffmpegPath = null
  }
  if (!ffmpegPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const which = require('which') as { sync: (name: string) => string }
      const whichPath = which.sync('ffmpeg')
      if (whichPath) ffmpegPath = whichPath
    } catch (err) {
      ffmpegPath = null
    }
  }
  return ffmpegPath
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ffmpegPath = detectFfmpeg()
  let ffmpegVersion: string | null = null
  if (ffmpegPath) {
    try {
      const out = execSync(`${ffmpegPath} -version`, { encoding: 'utf8', timeout: 2000 })
      ffmpegVersion = out.split('\n')[0]
    } catch (err) {
      ffmpegVersion = 'unknown'
    }
  }

  const awsRegion = process.env.AWS_REGION ?? null
  const s3Bucket = process.env.S3_BUCKET_NAME ?? null
  const s3PublicUrl = process.env.S3_PUBLIC_URL ?? null

  return res.status(200).json({
    ffmpeg: {
      available: !!ffmpegPath,
      path: ffmpegPath ?? null,
      version: ffmpegVersion
    },
    s3: {
      configured: !!(awsRegion && s3Bucket),
      region: awsRegion,
      bucket: s3Bucket,
      publicUrl: s3PublicUrl
    },
    node: process.version
  })
}
