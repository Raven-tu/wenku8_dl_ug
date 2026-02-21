import type { BookInfoLike, TextEntry, XhrTask } from '../types'
import { toErrorMessage } from './errorUtils'

interface AppChapterEntry {
  cid: string
  cName: string
  content: string | null
}

interface VolumeTaskData {
  vid: string
  cName?: string
  cid?: string
  Text?: TextEntry
  isAppApi?: boolean
}

function toVolumeTaskData(input: unknown): VolumeTaskData {
  if (!input || typeof input !== 'object') {
    return { vid: '' }
  }
  return input as VolumeTaskData
}

type ReadingBookInfo = Pick<BookInfoLike, 'aid'>

export const AppApiService = {
  volumeChapterData: new Map<string, AppChapterEntry[]>(),
  chapterListXml: null as Document | null,
  isChapterListLoading: false,
  chapterListTaskAdded: false,
  chapterListWaitQueue: [] as XhrTask[],
  disableTraditionalChineseRequest: true,

  _getApiLanguageParam(bookInfo?: { targetEncoding?: string }) {
    const targetEncoding = bookInfo?.targetEncoding || unsafeWindow.targetEncoding
    if (this.disableTraditionalChineseRequest || !targetEncoding) {
      return '0'
    }
    return targetEncoding === '1' ? '1' : '0'
  },

  _encryptRequestBody(body: string) {
    return `appver=1.0&timetoken=${Date.now()}&request=${btoa(body)}`
  },

  async _fetchChapterList(xhrTask: XhrTask) {
    const bookInfo = xhrTask.bookInfo
    if (!bookInfo)
      return
    if (this.isChapterListLoading)
      return

    this.isChapterListLoading = true
    bookInfo.refreshProgress(bookInfo, '下载App章节目录...')
    const langParam = this._getApiLanguageParam(bookInfo)
    const requestBody = this._encryptRequestBody(`action=book&do=list&aid=${bookInfo.aid}&t=${langParam}`)
    const url = `http://${APP_API_DOMAIN}${APP_API_PATH}`

    try {
      const response = await gmXmlHttpRequestAsync<string>({
        method: 'POST',
        url,
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
          'User-Agent': 'Android',
        },
        data: requestBody,
      })

      if (response.status === 200) {
        const parser = new DOMParser()
        this.chapterListXml = parser.parseFromString(cleanXmlIllegalChars(response.responseText), 'application/xml')
        bookInfo.refreshProgress(bookInfo, 'App章节目录下载完成。')
        this.chapterListTaskAdded = false
        bookInfo.XHRManager.taskFinished(xhrTask, false)
        const waitQueue = this.chapterListWaitQueue.slice()
        this.chapterListWaitQueue = []
        waitQueue.forEach((queuedXhr) => {
          void this.loadVolumeChapters(queuedXhr)
        })
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error: unknown) {
      bookInfo.logger.logError(`App章节目录下载失败: ${toErrorMessage(error)}`)
      bookInfo.XHRManager.retryTask(xhrTask, 'App章节目录下载失败，重新下载')
    }
    finally {
      this.isChapterListLoading = false
    }
  },

  async loadVolumeChapters(xhrVolumeRequest: XhrTask) {
    const bookInfo = xhrVolumeRequest.bookInfo
    if (!bookInfo)
      return
    const volumeData = toVolumeTaskData(xhrVolumeRequest.data)

    if (!this.chapterListXml) {
      if (!this.chapterListWaitQueue.includes(xhrVolumeRequest)) {
        this.chapterListWaitQueue.push(xhrVolumeRequest)
      }
      if (!this.chapterListTaskAdded) {
        this.chapterListTaskAdded = true
        bookInfo.XHRManager.add({
          type: 'appChapterList',
          url: `http://${APP_API_DOMAIN}${APP_API_PATH}`,
          loadFun: async (xhr: XhrTask) => this._fetchChapterList(xhr),
          bookInfo,
          isCritical: true,
        })
      }
      return
    }

    const volumeElement = Array.from(this.chapterListXml.getElementsByTagName('volume'))
      .find(vol => vol.getAttribute('vid') === volumeData.vid)

    if (!volumeElement) {
      bookInfo.refreshProgress(bookInfo, `<span style="color:fuchsia;">App章节目录未找到分卷 ${volumeData.vid}，无法生成ePub。</span>`)
      bookInfo.XHRManager.taskFinished(xhrVolumeRequest, true)
      return
    }

    const chapters = Array.from(volumeElement.children).map(ch => ({
      cid: ch.getAttribute('cid') ?? '',
      cName: ch.textContent ?? '',
      content: null,
    }))
    this.volumeChapterData.set(volumeData.vid, chapters)

    chapters.forEach((chapter) => {
      const chapterXhr: XhrTask = {
        type: 'appChapter',
        url: `http://${APP_API_DOMAIN}${APP_API_PATH}`,
        loadFun: async (xhr: XhrTask) => this._fetchChapterContent(xhr),
        dealVolume: xhrVolumeRequest.dealVolume,
        data: { ...volumeData, cid: chapter.cid, cName: chapter.cName, isAppApi: true },
        bookInfo,
        isCritical: true,
      }
      bookInfo.XHRManager.add(chapterXhr)
    })

    bookInfo.XHRManager.taskFinished(xhrVolumeRequest, false)
  },

  async _fetchChapterContent(xhrChapterRequest: XhrTask) {
    const bookInfo = xhrChapterRequest.bookInfo
    if (!bookInfo)
      return
    const data = toVolumeTaskData(xhrChapterRequest.data)
    const langParam = this._getApiLanguageParam(bookInfo)
    const requestBody = this._encryptRequestBody(`action=book&do=text&aid=${bookInfo.aid}&cid=${data.cid}&t=${langParam}`)
    const failureMessage = `${data.cName} 下载失败`

    try {
      const response = await gmXmlHttpRequestAsync<string>({
        method: 'POST',
        url: String(xhrChapterRequest.url),
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
          'User-Agent': 'Android',
        },
        data: requestBody,
      })

      if (response.status === 200) {
        const chapterVolumeData = this.volumeChapterData.get(data.vid)
        const chapterEntry = chapterVolumeData?.find(c => c.cid === data.cid)
        if (chapterEntry) {
          chapterEntry.content = response.responseText
        }
        bookInfo.refreshProgress(bookInfo, `${data.cName} 下载完成。`)

        if (chapterVolumeData && chapterVolumeData.every(c => c.content !== null)) {
          let combinedVolumeText = ''
          for (const chap of chapterVolumeData) {
            if (!chap.content)
              continue
            let content = chap.content
            content = content.replace(chap.cName, `<div class="chaptertitle"><a name="${chap.cid}">${chap.cName}</a></div><div class="chaptercontent">`)
            content = content.replace(/\r\n/g, '<br />\r\n')
            if (content.includes('<!--image-->http')) {
              content = content.replace(/<!--image-->(http[\w:/.?@#&=%]+)<!--image-->/g, (_match, p1) => `<div class="divimage" title="${p1}"></div>`)
            }
            content += '</div>'
            combinedVolumeText += content
          }
          const pseudoVolumeXhr: XhrTask = {
            bookInfo,
            VolumeIndex: bookInfo.Text.findIndex(t => t.vid === data.vid),
            data: { ...data, Text: bookInfo.Text.find(t => t.vid === data.vid) },
          }
          const dealVolume = xhrChapterRequest.dealVolume as ((xhr: XhrTask, text: string) => void) | undefined
          dealVolume?.(pseudoVolumeXhr, combinedVolumeText)
        }
        bookInfo.XHRManager.taskFinished(xhrChapterRequest, false)
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error: unknown) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${toErrorMessage(error)}`)
      bookInfo.XHRManager.retryTask(xhrChapterRequest, failureMessage)
    }
  },

  async fetchChapterForReading(
    bookInfo: ReadingBookInfo,
    chapterId: string,
    contentElement: HTMLElement,
    translateBodyFunc?: (node?: Node | Element) => void,
  ) {
    const langParam = this._getApiLanguageParam({ targetEncoding: unsafeWindow.targetEncoding })
    const requestBody = this._encryptRequestBody(`action=book&do=text&aid=${bookInfo.aid}&cid=${chapterId}&t=${langParam}`)
    const url = `http://${APP_API_DOMAIN}${APP_API_PATH}`
    contentElement.innerHTML = '正在通过App接口加载内容，请稍候...'

    try {
      const response = await gmXmlHttpRequestAsync<string>({
        method: 'POST',
        url,
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
          'User-Agent': 'Android',
        },
        data: requestBody,
      })

      if (response.status === 200) {
        let rawText = response.responseText
        rawText = rawText.replace(/ {2}\S.*/, '')
        rawText = rawText.replace(/\r\n/g, '<br />\r\n')
        if (rawText.includes('<!--image-->http')) {
          rawText = rawText.replace(/<!--image-->(http[\w:/.?@#&=%]+)<!--image-->/g, (_m, p1) => `<div class="divimage"><a href="${p1}" target="_blank"><img src="${p1}" border="0" class="imagecontent"></a></div>`)
        }
        contentElement.innerHTML = rawText
        if (typeof translateBodyFunc === 'function') {
          translateBodyFunc(contentElement)
        }
      }
      else {
        contentElement.innerHTML = `通过App接口加载内容失败，状态码: ${response.status}`
      }
    }
    catch (error: unknown) {
      contentElement.innerHTML = `通过App接口加载内容失败: ${toErrorMessage(error)}`
      console.error('App接口内容加载失败:', error)
    }
  },
}
