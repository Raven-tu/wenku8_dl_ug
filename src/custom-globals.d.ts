import type { ImgLocationItem } from './types'

declare global {
  interface Window {
    article_id: string
    chapter_id?: string | null
    targetEncoding?: string
    currentEncoding?: string
    translateButtonId?: string
    Simplized?: ((text: string) => string) | undefined
    Traditionalized?: ((text: string) => string) | undefined
    OpenCC?: {
      Converter: (options: { from: 'cn' | 'tw', to: 'cn' | 'tw' }) => (input: string) => string
    }
    translateBody?: ((node?: Node | Element) => void) | undefined
    setCookie?: ((name: string, value: string, days: number) => void) | undefined
    getCookie?: ((name: string) => string | null) | undefined
    _isUnderConstruction?: boolean
    ImgLocationCfgRef?: Array<{
      UID: string
      aid: string
      pathname?: string
      ImgLocation?: ImgLocationItem[]
      ImgLocationBase64?: string
    }>
  }
}

export {}
