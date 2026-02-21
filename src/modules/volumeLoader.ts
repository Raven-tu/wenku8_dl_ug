import type { ImageEntry, TextEntry, XhrTask } from '../types'
import { toErrorMessage } from './errorUtils'

interface VolumeData {
  vid: string
  vcssText?: string
  Text: TextEntry
}

export const VolumeLoader = {
  async loadWebVolumeText(xhr: XhrTask) {
    const bookInfo = xhr.bookInfo
    const url = xhr.url
    const VolumeIndex = xhr.VolumeIndex
    if (!bookInfo || !url || typeof VolumeIndex !== 'number')
      return
    const volumeInfo = bookInfo.nav_toc[VolumeIndex]
    const failureMessage = `${volumeInfo.volumeName} 下载失败`

    try {
      const response = await gmXmlHttpRequestAsync<string>({ method: 'GET', url })
      if (response.status === 200) {
        bookInfo.refreshProgress(bookInfo, `${volumeInfo.volumeName} 网页版内容下载完成。`)
        this.dealVolumeText(xhr, response.responseText)
        bookInfo.XHRManager.taskFinished(xhr, false)
      }
      else if (response.status === 404) {
        bookInfo.refreshProgress(bookInfo, `${volumeInfo.volumeName} 网页版404，尝试使用App接口下载...`)
        xhr.dealVolume = this.dealVolumeText.bind(this)
        AppApiService.loadVolumeChapters(xhr)
        bookInfo.XHRManager.taskFinished(xhr, false)
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error: unknown) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${toErrorMessage(error)}`)
      bookInfo.XHRManager.retryTask(xhr, failureMessage)
    }
  },

  async loadBookDescription(xhr: XhrTask) {
    const bookInfo = xhr.bookInfo
    const url = xhr.url
    if (!bookInfo || !url)
      return
    const failureMessage = '内容简介下载失败'

    try {
      const text = await fetchAsText(url, 'gbk')
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'text/html')
      const descSpan = doc.evaluate('//span[@class=\'hottext\' and contains(text(),\'内容简介：\')]/following-sibling::span', doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue
      if (descSpan) {
        bookInfo.description = descSpan.textContent?.trim() ?? ''
      }
      bookInfo.refreshProgress(bookInfo, '内容简介下载完成。')
      bookInfo.XHRManager.taskFinished(xhr, false)
    }
    catch (error: unknown) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${toErrorMessage(error)}`)
      bookInfo.XHRManager.retryTask(xhr, failureMessage)
    }
  },

  async loadImage(xhr: XhrTask) {
    const bookInfo = xhr.bookInfo
    const url = xhr.url
    const imageInfo = xhr.images
    if (!bookInfo || !url || !imageInfo)
      return
    const failureMessage = `${imageInfo.idName} 下载失败`

    try {
      const response = await gmXmlHttpRequestAsync<ArrayBuffer>({ method: 'GET', url, responseType: 'arraybuffer' })
      if (response.status === 200) {
        imageInfo.content = response.response

        if (imageInfo.coverImgChk && !bookInfo.Images.some(i => i.coverImg)) {
          try {
            imageInfo.Blob = new Blob([imageInfo.content], { type: 'image/jpeg' })
            imageInfo.ObjectURL = URL.createObjectURL(imageInfo.Blob)
            const img = new Image()
            img.onload = () => {
              imageInfo.coverImg = (img.naturalHeight / img.naturalWidth > 1)
              if (imageInfo.ObjectURL)
                URL.revokeObjectURL(imageInfo.ObjectURL)
              delete imageInfo.Blob
              delete imageInfo.ObjectURL
              bookInfo.refreshProgress(bookInfo, `${imageInfo.idName} 下载完成${imageInfo.coverImg ? ' (设为封面候选)' : ''}。`)
              bookInfo.XHRManager.taskFinished(xhr, false)
            }
            img.onerror = () => {
              if (imageInfo.ObjectURL)
                URL.revokeObjectURL(imageInfo.ObjectURL)
              delete imageInfo.Blob
              delete imageInfo.ObjectURL
              bookInfo.logger.logError(`${imageInfo.idName} 图片对象加载失败。`)
              bookInfo.XHRManager.taskFinished(xhr, false)
            }
            if (imageInfo.ObjectURL)
              img.src = imageInfo.ObjectURL
          }
          catch (error: unknown) {
            bookInfo.logger.logError(`${imageInfo.idName} 创建Blob/ObjectURL失败: ${toErrorMessage(error)}`)
            bookInfo.XHRManager.taskFinished(xhr, false)
          }
        }
        else {
          bookInfo.refreshProgress(bookInfo, `${imageInfo.idName} 下载完成。`)
          bookInfo.XHRManager.taskFinished(xhr, false)
        }
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error: unknown) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${toErrorMessage(error)}`)
      bookInfo.XHRManager.retryTask(xhr, failureMessage)
    }
  },

  dealVolumeText(xhr: XhrTask, htmlText: string) {
    const bookInfo = xhr.bookInfo
    const VolumeIndex = xhr.VolumeIndex
    const data = xhr.data as VolumeData | undefined
    if (!bookInfo || typeof VolumeIndex !== 'number' || !data)
      return
    const volumeTextData = data.Text
    const navTocEntry = volumeTextData.navToc
    let chapterCounter = 0
    let imageCounter = 0
    let textNodeCounter = 0

    const parser = new DOMParser()
    const tempDoc = parser.parseFromString(
      '<html><head><meta charset="utf-8"/></head><body></body></html>',
      'text/html',
    )
    tempDoc.body.innerHTML = htmlText

    if (typeof unsafeWindow.currentEncoding !== 'undefined'
      && typeof unsafeWindow.targetEncoding !== 'undefined'
      && unsafeWindow.currentEncoding !== unsafeWindow.targetEncoding
      && typeof unsafeWindow.translateBody === 'function') {
      unsafeWindow.translateBody(tempDoc.body)
    }

    const elementsToRemove: Element[] = []
    Array.from(tempDoc.body.children).forEach((child) => {
      if (child.tagName === 'UL' && child.id === 'contentdp') {
        elementsToRemove.push(child)
      }
      else if (child.tagName === 'DIV' && child.className === 'chaptertitle') {
        chapterCounter++
        const chapterTitleText = child.textContent?.trim() ?? ''
        const chapterDivId = `chapter_${chapterCounter}`
        child.innerHTML = `<div id="${chapterDivId}"><h3>${cleanXmlIllegalChars(chapterTitleText)}</h3></div>`

        navTocEntry.chapterArr.push({
          chapterName: chapterTitleText,
          chapterID: chapterDivId,
          chapterHref: `${navTocEntry.volumeHref}#${chapterDivId}`,
        })

        const titleSpan = tempDoc.createElement('span')
        titleSpan.id = `${TEXT_SPAN_PREFIX}_${chapterDivId}`
        titleSpan.className = 'txtDropEnable'
        titleSpan.setAttribute('ondragover', 'return false')
        child.parentElement?.insertBefore(titleSpan, child)
        titleSpan.appendChild(child)
      }
      else if (child.tagName === 'DIV' && child.className === 'chaptercontent') {
        Array.from(child.childNodes).forEach((contentNode) => {
          if (contentNode.nodeType === Node.TEXT_NODE && contentNode.textContent?.trim() !== '') {
            textNodeCounter++
            const textSpan = tempDoc.createElement('span')
            textSpan.id = `${TEXT_SPAN_PREFIX}_${VolumeIndex}_${textNodeCounter}`
            textSpan.className = 'txtDropEnable'
            textSpan.setAttribute('ondragover', 'return false')
            child.insertBefore(textSpan, contentNode)
            textSpan.appendChild(contentNode)
          }
          else if (contentNode instanceof HTMLDivElement && contentNode.className === 'divimage' && contentNode.hasAttribute('title')) {
            const imgSrc = contentNode.getAttribute('title')
            if (imgSrc) {
              const imgUrl = new URL(imgSrc)
              const imgFileName = imgUrl.pathname.split('/').pop() ?? ''
              const imgPathInEpub = `Images${imgUrl.pathname}`

              contentNode.innerHTML = `<img src="../${imgPathInEpub}" alt="${cleanXmlIllegalChars(imgFileName)}"/>`

              imageCounter++
              const imageEntry: ImageEntry = {
                path: imgPathInEpub,
                content: null,
                id: `${IMAGE_FILE_PREFIX}_${VolumeIndex}_${imageCounter}`,
                idName: imgFileName,
                TextId: volumeTextData.id,
                coverImgChk: (VolumeIndex === 0 && imageCounter <= 2),
              }
              if (!bookInfo.Images.some(img => img.path === imageEntry.path)) {
                bookInfo.Images.push(imageEntry)
                bookInfo.XHRManager.add({
                  type: 'image',
                  url: imgSrc,
                  loadFun: async (imgXhr: XhrTask) => VolumeLoader.loadImage(imgXhr),
                  images: imageEntry,
                  bookInfo,
                  isCritical: false,
                })
              }
            }
          }
        })
      }
    })
    elementsToRemove.forEach(el => el.parentElement?.removeChild(el))

    volumeTextData.content = tempDoc.body.innerHTML

    if (VolumeIndex === 0 && !bookInfo.thumbnailImageAdded) {
      const pathParts = CURRENT_URL.pathname.replace('novel', 'image').split('/')
      pathParts.pop()
      const bookNumericId = pathParts.find(p => /^\d+$/.test(p))
      if (bookNumericId) {
        const thumbnailImageId = `${bookNumericId}s`
        const thumbnailSrc = `https://${IMAGE_DOMAIN}${pathParts.join('/')}/${thumbnailImageId}.jpg`
        const thumbnailPathInEpub = `Images/${bookNumericId}/${thumbnailImageId}.jpg`

        const thumbnailEntry: ImageEntry = {
          path: thumbnailPathInEpub,
          content: null,
          id: thumbnailImageId,
          idName: `${thumbnailImageId}.jpg`,
          TextId: '',
          smallCover: true,
          isCritical: false,
        }
        if (!bookInfo.Images.some(img => img.id === thumbnailEntry.id)) {
          bookInfo.Images.push(thumbnailEntry)
          bookInfo.XHRManager.add({
            type: 'image',
            url: thumbnailSrc,
            loadFun: async (thumbXhr: XhrTask) => VolumeLoader.loadImage(thumbXhr),
            images: thumbnailEntry,
            bookInfo,
            isCritical: false,
          })
          bookInfo.thumbnailImageAdded = true
        }
      }
    }

    if (!bookInfo.descriptionXhrInitiated) {
      bookInfo.descriptionXhrInitiated = true
      bookInfo.XHRManager.add({
        type: 'description',
        url: `/book/${bookInfo.aid}.htm`,
        loadFun: async (descXhr: XhrTask) => VolumeLoader.loadBookDescription(descXhr),
        bookInfo,
        isCritical: true,
      })
    }

    bookInfo.tryBuildEpub()
  },
}
