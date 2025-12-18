export type Template = {
  id: string
  name: string
  style: 'zoom' | 'slide'
  musicFile: string // path under /public
  durationSeconds: number
}

export const templates: Template[] = [
  {
    id: 'zoom-ambient',
    name: 'Ambient Zoom',
    style: 'zoom',
    musicFile: '/musics/ambient.mp3',
    durationSeconds: 6
  },
  {
    id: 'slide-funky',
    name: 'Funky Slide',
    style: 'slide',
    musicFile: '/musics/funky.mp3',
    durationSeconds: 6
  }
]

export function getTemplateById(id: string) {
  return templates.find(t => t.id === id)
}
