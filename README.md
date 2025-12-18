# Next.js Short Video Generator

This project demonstrates a simple Next.js (Pages router) app that:

- Uploads an image to AWS S3
- Generates a short MP4 video using ffmpeg with overlay text and simple animations (zoom or slide)
- Lets you choose a template that picks an animation and background music
- Uses TypeScript throughout and is ready for local development

## Setup

1. Copy the project files into a folder (you already have them here).
2. Create a `.env.local` based on `.env.example` and set your AWS credentials and S3 bucket name.

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=your-bucket
```

3. Install dependencies:

```
npm install
```

A `postinstall` script decodes the placeholder base64 music files into `public/musics/*.mp3`.

4. Run the dev server:

```
npm run dev
```

5. Visit `http://localhost:3000` to use the UI.

## Notes & Deployment

- The ffmpeg binary is provided by `ffmpeg-static` and should work locally on macOS. On Vercel or serverless platforms, running ffmpeg may not be supported in the default runtime; consider using a serverful deployment or an external service for production video processing.

- `uploadToS3` currently sets `ACL: 'public-read'` so uploaded files are publicly accessible; change permissions if you require private uploads.

- Templates are defined in `lib/templates.ts`. Add or modify templates to change duration, style, or background music.

- If your S3 endpoint or domain differs, set `S3_PUBLIC_URL` in `.env.local` to construct public URLs returned by the API.

## Files of interest

- `lib/s3.ts` – S3 helper (upload/download)
- `lib/templates.ts` – Template definitions
- `pages/api/upload-image.ts` – Accepts multipart upload and sends image to S3
- `pages/api/generate-video.ts` – Downloads image, runs ffmpeg, uploads resulting mp4 to S3
- `pages/index.tsx` – Frontend UI

If you want, I can add more templates, include a bundled font for `drawtext`, or switch to presigned uploads for better security.
