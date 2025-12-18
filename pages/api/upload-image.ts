import type { NextApiRequest, NextApiResponse } from 'next'
import formidable, { File } from 'formidable'
import fs from 'fs'
import { uploadToS3 } from '../../lib/s3'

export const config = {
  api: { bodyParser: false }
}

// API route to accept multipart/form-data file upload and send to S3
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Wrap formidable.parse in a promise to use async/await and ensure a response
  const parseForm = (req: NextApiRequest) =>
    new Promise<{ files: formidable.Files; fields: formidable.Fields }>((resolve, reject) => {
      const form = new formidable.IncomingForm()
      form.on('error', err => reject(err))
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err)
        resolve({ fields, files })
      })
    })

  try {
    const { files } = await parseForm(req)
    const file = files.file as File
    if (!file) return res.status(400).json({ error: 'No file provided' })

    const data = fs.readFileSync(file.filepath)
    const key = `uploads/${Date.now()}-${file.originalFilename ?? 'image'}`
    try {
      const url = await uploadToS3(key, data, file.mimetype || 'application/octet-stream')
      return res.status(200).json({ key, url })
    } catch (e: any) {
      console.error('s3 upload error', e)
      return res.status(500).json({ error: e.message ?? 'S3 upload failed' })
    }
  } catch (err: any) {
    console.error('form parse error', err)
    if (!res.headersSent) {
      return res.status(400).json({ error: err.message ?? 'Upload error' })
    }
  }
}
