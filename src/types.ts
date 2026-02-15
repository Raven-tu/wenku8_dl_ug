export interface ChapterTocEntry {
  chapterName: string
  chapterID: string
  chapterHref: string
}

export interface NavTocEntry {
  volumeName: string
  vid: string
  volumeID: string
  volumeHref: string
  chapterArr: ChapterTocEntry[]
}

export interface TextEntry {
  path: string
  content: string
  id: string
  vid: string
  volumeName: string
  navToc: NavTocEntry
}

export interface ImageEntry {
  path: string
  content: ArrayBuffer | null
  id: string
  idName: string
  TextId: string
  coverImgChk?: boolean
  coverImg?: boolean
  smallCover?: boolean
  Blob?: Blob
  ObjectURL?: string
  isCritical?: boolean
}

export interface ImgLocationItem {
  vid: string
  spanID: string
  imgID: string
  isCover?: boolean
}

export interface LoggerLike {
  updateProgress: (bookInfo: BookInfoLike, message?: string) => void
  clearLog: () => void
  logError: (message: string) => void
  logWarn: (message: string) => void
  logInfo: (message: string, ...extra: unknown[]) => void
}

export interface XhrTask {
  url?: string
  type?: string
  loadFun?: (task: XhrTask) => void | Promise<void>
  done?: boolean
  start?: boolean
  XHRRetryCount?: number
  isCritical?: boolean
  _finished?: boolean
  bookInfo?: BookInfoLike
  data?: unknown
  VolumeIndex?: number
  images?: ImageEntry
  dealVolume?: (task: XhrTask, htmlText: string) => void
  [key: string]: unknown
}

export interface XhrManagerLike {
  init: (bookInfo: BookInfoLike) => void
  hasCriticalFailure: boolean
  taskFinished: (task: XhrTask, isFinalFailure?: boolean) => void
  retryTask: (task: XhrTask, message: string) => void
  add: (task: XhrTask) => void
  areAllTasksDone: () => boolean
}

export interface BookInfoLike {
  aid: string
  title: string
  creator: string
  description: string
  targetEncoding: string
  nav_toc: NavTocEntry[]
  Text: TextEntry[]
  Images: ImageEntry[]
  ImgLocation: ImgLocationItem[]
  logger: LoggerLike
  XHRManager: XhrManagerLike
  totalTasksAdded: number
  tasksCompletedOrSkipped: number
  XHRFail: boolean
  descriptionXhrInitiated?: boolean
  thumbnailImageAdded?: boolean
  refreshProgress: (instance: BookInfoLike, message?: string) => void
  tryBuildEpub: () => void
}
