import React, { useState } from 'react'
import { templates } from '../lib/templates'

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null)
  const [templateId, setTemplateId] = useState(templates[0].id)
  const [productName, setProductName] = useState('Awesome Product')
  const [includeText, setIncludeText] = useState(true)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function uploadImage(): Promise<{ key: string; url: string } | null> {
    if (!file) return null
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Upload failed')
    return json
  }

  async function onGenerate() {
    setMessage('')
    setVideoUrl(null)
    setLoading(true)
    try {
      const upload = await uploadImage()
      if (!upload) throw new Error('No file uploaded')
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageKey: upload.key, templateId, productName, includeText })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setVideoUrl(json.videoUrl)
    } catch (err: any) {
      console.error(err)
      setMessage(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-root">
      <div className="card full">
        <header className="header">
          <h1 className="title">Short Video Generator</h1>
          <p className="subtitle">Create short product videos with a single image — choose a style and download</p>
        </header>

        <div className="content">
          <aside className="sidebar">
            <label className={`drop-zone ${file ? 'has-file' : ''}`}>
              <input
                className="file-input"
                type="file"
                accept="image/*"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="drop-inner">
                <div className="drop-title">{file ? 'Image selected' : 'Drop or choose an image'}</div>
                <div className="file-name">{file ? file.name : 'No file selected'}</div>
                <button type="button" className="file-btn">Choose Image</button>
              </div>
            </label>

            <div className="field">
              <label className="label">Product name</label>
              <input className="text-input" value={productName} onChange={e => setProductName(e.target.value)} disabled={!includeText} />
            </div>

            <div className="field">
              <label className="label">
                <input type="checkbox" checked={includeText} onChange={e => setIncludeText(e.target.checked)} /> Include product name in video
              </label>
            </div>

            <div className="field">
              <label className="label">Template</label>
              <div className="templates-grid">
                {templates.map(t => (
                  <button
                    key={t.id}
                    className={`template-card ${templateId === t.id ? 'selected' : ''}`}
                    onClick={() => setTemplateId(t.id)}
                    aria-pressed={templateId === t.id}
                  >
                    <div className="template-thumb" />
                    <div className="template-body">
                      <div className="template-name">{t.name}</div>
                      <div className="template-meta">{t.style} • {t.durationSeconds}s</div>
                    </div>
                    {templateId === t.id && <div className="template-badge">✓</div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="actions">
              <button
                className={`generate-btn ${loading ? 'loading' : ''}`}
                onClick={onGenerate}
                disabled={!file || loading}
                aria-busy={loading}
                aria-disabled={!file || loading}
              >
                {loading && <span className="spinner" aria-hidden />}
                <span className="btn-text">{loading ? 'Generating...' : 'Generate Video'}</span>
              </button>
              <button className="clear-btn" onClick={() => { setFile(null); setVideoUrl(null); setMessage(''); setIncludeText(true) }}>
                Reset
              </button>
            </div>

            {message && <div className="message error">{message}</div>}
            {videoUrl && <div className="message success">Video ready!</div>}
          </aside>

          <section className="preview">
            {!videoUrl ? (
              <div className="preview-empty">No video yet — previews appear here</div>
            ) : (
              <>
                <video src={videoUrl} controls className="video-player" />
                <div className="preview-actions">
                  <a className="download-btn" href={videoUrl} target="_blank" rel="noreferrer" download>
                    ⤓ Download
                  </a>
                  <a className="open-btn" href={videoUrl} target="_blank" rel="noreferrer">
                    🔗 Open
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        :root {
          --bg1: #fbf8ff;
          --card-bg: linear-gradient(180deg,#ffffff,#fffefc);
          --accent: #7fb6ff;
          --accent-2: #ffd6e8;
          --muted: #667085;
        }
        .page-root {
          min-height: 100vh;
          display: flex;
          align-items: stretch;
          justify-content: center;
          background: linear-gradient(180deg, var(--bg1) 0%, #fff8fb 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
          padding: 24px;
        }
        .card.full {
          width: 100%;
          max-width: 1200px;
          height: calc(100vh - 48px);
          border-radius: 14px;
          background: var(--card-bg);
          padding: 22px;
          box-shadow: 0 20px 60px rgba(20,30,60,0.08), inset 0 1px 0 rgba(255,255,255,0.6);
          border: 1px solid rgba(230,235,245,0.7);
          display: flex;
          flex-direction: column;
        }
        .header { display:flex; flex-direction:column; gap:6px; margin-bottom:6px }
        .title { margin:0; font-size:24px; color:#102a43 }
        .subtitle { margin:0; color:var(--muted); font-size:13px }

        .content { display:grid; grid-template-columns: 420px 1fr; gap:18px; align-items:start; height:100%; }
        .sidebar { background: linear-gradient(180deg,#ffffff,#fcfdff); padding:16px; border-radius:12px; border:1px solid rgba(220,230,245,0.6); box-shadow: 0 8px 30px rgba(80,120,200,0.04); height:100%; overflow:auto }

        .drop-zone { display:block; border-radius:12px; padding:18px; border:2px dashed rgba(180,190,210,0.35); text-align:center; cursor:pointer; background:linear-gradient(180deg,#fff,#fbfbff); margin-bottom:12px }
        .drop-zone.has-file { border-style:solid; border-color: rgba(120,180,255,0.45); box-shadow: 0 8px 20px rgba(120,180,255,0.06); }
        .drop-inner { display:flex; flex-direction:column; gap:8px; align-items:center }
        .drop-title { font-weight:700; color:#2b3a4a }
        .file-name { color:var(--muted); font-size:12px }
        .file-btn { padding:8px 12px; border-radius:10px; background:var(--accent-2); border:none; cursor:pointer; color:#6b084e; font-weight:700 }

        .label { display:block; font-weight:700; margin-bottom:6px }
        .field { margin-bottom:12px }
        .text-input { width:100%; padding:10px; border-radius:10px; border:1px solid rgba(150,160,180,0.12) }

        .templates-grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px }
        .template-card { display:flex; position:relative; gap:12px; align-items:center; padding:12px; border-radius:12px; cursor:pointer; border:1px solid rgba(200,210,230,0.6); background:linear-gradient(180deg,#f8fbff,#f9fff8); box-shadow:0 8px 24px rgba(110,150,240,0.06); transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease }
        .template-card:hover { transform:translateY(-6px); box-shadow:0 18px 40px rgba(90,140,230,0.12) }
        .template-card.selected { border-color: rgba(80,140,255,0.9); box-shadow: 0 20px 60px rgba(80,140,255,0.14); background: linear-gradient(180deg,#eaf4ff,#e8f4ff) }
        .template-thumb { width:64px; height:48px; background:linear-gradient(90deg,#fff,#f0f7ff); border-radius:8px; border:1px solid rgba(210,220,240,0.7) }
        .template-body { display:flex; flex-direction:column }
        .template-badge { position:absolute; right:8px; top:8px; background:var(--accent); color:white; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700 }

        .actions { display:flex; gap:10px; margin-top:6px; align-items:center }
        .generate-btn { display:inline-flex; align-items:center; gap:10px; background: linear-gradient(180deg,#1e6fff,#0b4fd6); border-radius: 12px; padding:10px 16px; border:none; cursor:pointer; font-weight:700; color:white; box-shadow: 0 12px 30px rgba(20,80,200,0.22); transition:transform .12s ease, box-shadow .12s ease }
        .generate-btn:hover:not([disabled]) { transform: translateY(-2px); box-shadow: 0 18px 40px rgba(20,80,200,0.28) }
        .generate-btn.loading { opacity: 0.9; cursor: progress }
        .generate-btn[disabled] { opacity: 0.55; cursor: not-allowed }
        .generate-btn .spinner { width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,0.25); border-top-color: #fff; animation: spin 1s linear infinite; display:inline-block }
        .btn-text { display:inline-block }
        @keyframes spin { to { transform: rotate(360deg) } }

        .clear-btn { background: transparent; border:none; color:var(--muted); cursor:pointer }

        .message { margin-top:8px; padding:8px 10px; border-radius:8px }
        .message.error { background:#ffefef; color:#6a1313 }
        .message.success { background:#f0fff4; color:#0a6b2f }

        .preview { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; background: linear-gradient(180deg,#fff,#fbfdff); border-radius:12px; padding:18px; border:1px solid rgba(230,235,245,0.6); position:relative }
        .preview-empty { color:var(--muted); border-radius:10px; padding:28px; background:linear-gradient(180deg,#fbfbff,#fff); border:1px dashed rgba(180,190,210,0.25) }
        .video-player { width:100%; max-width:820px; border-radius: 12px; box-shadow: 0 20px 60px rgba(60,80,120,0.12) }
        .preview-actions { display:flex; gap:10px }
        .download-btn { padding:10px 14px; border-radius:12px; background:linear-gradient(180deg,#ffd6e8,#ffc6d6); color:#6b084e; text-decoration:none; font-weight:700 }
        .open-btn { padding:10px 14px; border-radius:12px; background:#fff; border:1px solid rgba(200,210,230,0.6); text-decoration:none; color:#245 }

        /* Full-screen loading overlay */
        .loading-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, rgba(255,255,255,0.6), rgba(250,250,255,0.6)); border-radius:12px }
        .loading-card { padding:20px 24px; background:white; border-radius:12px; box-shadow: 0 8px 30px rgba(30,40,60,0.08); display:flex; gap:12px; align-items:center }
        .loading-card .spinner { width:22px; height:22px; border-width:3px }
        .loading-text { font-weight:700; color:#16325c }

        @media (max-width: 980px) {
          .content { grid-template-columns: 1fr; }
          .preview { order: 2 }
        }

        /* Mobile-friendly and small-mobile tweaks */
        @media (max-width: 640px) {
          .page-root { padding: 12px; }
          .card.full { padding: 12px; height: auto; max-height: none; }
          .header { gap:4px; margin-bottom:4px }
          .title { font-size:20px }
          .subtitle { font-size:12px }
          .content { gap:12px; }
          .sidebar { padding:12px; }
          .drop-zone { padding:12px }
          .drop-title { font-size:14px }
          .file-name { font-size:11px }
          .file-btn { padding:8px 10px; border-radius:8px }
          .text-input { padding:8px }
          .templates-grid { grid-template-columns: 1fr; }
          .template-card { padding:10px; gap:8px; }
          .template-thumb { width:56px; height:40px }
          .actions { flex-direction: column; align-items:stretch; gap:8px; }
          .generate-btn, .clear-btn { width:100%; padding:12px 14px; border-radius:10px; justify-content:center }
          .preview { padding:12px; }
          .video-player { max-width:100%; height:auto }
          .preview-actions { flex-direction:column; gap:8px }
        }

        @media (max-width: 420px) {
          .page-root { padding:8px; }
          .card.full { padding:10px; border-radius:10px; height:auto }
          .title { font-size:18px }
          .subtitle { font-size:11px }
          .drop-zone { padding:10px }
          .drop-title { font-size:13px }
          .file-btn { padding:8px 10px; font-size:13px }
          .template-thumb { width:48px; height:36px }
          .generate-btn .spinner { width:14px; height:14px }
        }
      `}</style>
    </main>
  )
}
