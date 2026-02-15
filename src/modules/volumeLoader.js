export const VolumeLoader = {
  /**
   * 加载网页版分卷文本内容
   * @param {object} xhr - XHR任务对象
   *   - bookInfo: 协调器实例
   *   - url: 下载URL
   *   - VolumeIndex: 卷在 bookInfo.nav_toc 和 bookInfo.Text 中的索引
   *   - data: { vid, vcssText, Text }
   */
  async loadWebVolumeText(xhr) {
    const { bookInfo, url, VolumeIndex, data } = xhr
    const volumeInfo = bookInfo.nav_toc[VolumeIndex]
    const failureMessage = `${volumeInfo.volumeName} 下载失败`

    try {
      const response = await gmXmlHttpRequestAsync({ method: 'GET', url })
      if (response.status === 200) {
        bookInfo.refreshProgress(bookInfo, `${volumeInfo.volumeName} 网页版内容下载完成。`)
        this.dealVolumeText(xhr, response.responseText) // 处理文本
        bookInfo.XHRManager.taskFinished(xhr, false) // 标记任务完成
      }
      else if (response.status === 404) {
        bookInfo.refreshProgress(bookInfo, `${volumeInfo.volumeName} 网页版404，尝试使用App接口下载...`)
        // 转交给AppApiService处理整个卷的章节下载
        // AppApiService.loadVolumeChapters 会为每个章节添加新任务，并在所有章节下载并合并后调用 dealVolumeText
        // 这里的 xhr 任务本身标记为完成（因为它成功触发了App下载流程）
        xhr.dealVolume = this.dealVolumeText.bind(this) // 确保App下载完成后也调用此处理函数，并绑定this
        AppApiService.loadVolumeChapters(xhr)
        bookInfo.XHRManager.taskFinished(xhr, false) // 标记当前任务完成
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${error.message}`)
      bookInfo.XHRManager.retryTask(xhr, failureMessage) // 使用XHRManager的重试
    }
  },

  /**
   * 加载书籍内容简介
   * @param {object} xhr - XHR任务对象
   *   - bookInfo: 协调器实例
   *   - url: 下载URL
   */
  async loadBookDescription(xhr) {
    const { bookInfo, url } = xhr
    const failureMessage = `内容简介下载失败`

    try {
      const text = await fetchAsText(url, 'gbk') // 使用封装的fetch
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'text/html')
      // 使用 XPath 查找内容简介
      const descSpan = doc.evaluate('//span[@class=\'hottext\' and contains(text(),\'内容简介：\')]/following-sibling::span', doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue
      if (descSpan) {
        bookInfo.description = descSpan.textContent.trim()
      }
      bookInfo.refreshProgress(bookInfo, `内容简介下载完成。`)
      bookInfo.XHRManager.taskFinished(xhr, false) // 标记任务完成
    }
    catch (error) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${error.message}`)
      bookInfo.XHRManager.retryTask(xhr, failureMessage)
    }
  },

  /**
   * 加载图片资源
   * @param {object} xhr - XHR任务对象
   *   - bookInfo: 协调器实例
   *   - url: 图片URL
   *   - images: 图片条目信息 {path, content, id, idName, TextId, coverImgChk?, smallCover?}
   */
  async loadImage(xhr) {
    const { bookInfo, url, images: imageInfo } = xhr
    const failureMessage = `${imageInfo.idName} 下载失败`

    try {
      const response = await gmXmlHttpRequestAsync({ method: 'GET', url, responseType: 'arraybuffer' })
      if (response.status === 200) {
        imageInfo.content = response.response

        // 封面图片检查逻辑 (仅对封面候选图片执行)
        if (imageInfo.coverImgChk && !bookInfo.Images.some(i => i.coverImg)) {
          try {
            imageInfo.Blob = new Blob([imageInfo.content], { type: 'image/jpeg' }) // 假设都是jpeg
            imageInfo.ObjectURL = URL.createObjectURL(imageInfo.Blob)
            const img = new Image()
            img.onload = () => {
              imageInfo.coverImg = (img.naturalHeight / img.naturalWidth > 1) // 封面高宽比检查
              URL.revokeObjectURL(imageInfo.ObjectURL) // 释放
              delete imageInfo.Blob // 清理
              delete imageInfo.ObjectURL
              bookInfo.refreshProgress(bookInfo, `${imageInfo.idName} 下载完成${imageInfo.coverImg ? ' (设为封面候选)' : ''}。`)
              bookInfo.XHRManager.taskFinished(xhr, false) // 标记任务完成
            }
            img.onerror = () => {
              URL.revokeObjectURL(imageInfo.ObjectURL)
              delete imageInfo.Blob
              delete imageInfo.ObjectURL
              bookInfo.logger.logError(`${imageInfo.idName} 图片对象加载失败。`)
              bookInfo.XHRManager.taskFinished(xhr, false) // 即使图片加载失败，也标记XHR完成
            }
            img.src = imageInfo.ObjectURL
            // 等待 img.onload 或 onerror 回调
          }
          catch (e) {
            bookInfo.logger.logError(`${imageInfo.idName} 创建Blob/ObjectURL失败: ${e.message}`)
            bookInfo.XHRManager.taskFinished(xhr, false) // 标记任务完成
          }
        }
        else {
          // 非封面候选图片或已有封面，直接标记完成
          bookInfo.refreshProgress(bookInfo, `${imageInfo.idName} 下载完成。`)
          bookInfo.XHRManager.taskFinished(xhr, false) // 标记任务完成
        }
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${error.message}`)
      bookInfo.XHRManager.retryTask(xhr, failureMessage)
    }
  },

  /**
   * 处理下载到的分卷文本内容 (网页版或App版合并后的)
   * @param {object} xhr - 原始的卷XHR任务对象 (或AppService伪造的对象)
   *   - bookInfo: 协调器实例
   *   - VolumeIndex: 卷在 bookInfo.nav_toc 和 bookInfo.Text 中的索引
   *   - data: { vid, vcssText, Text }
   * @param {string} htmlText - 下载到的HTML或合并后的章节文本
   */
  dealVolumeText(xhr, htmlText) {
    const { bookInfo, VolumeIndex, data } = xhr
    const volumeTextData = data.Text // {path, content, id, vid, volumeName, navToc}
    const navTocEntry = volumeTextData.navToc
    let chapterCounter = 0
    let imageCounter = 0
    let textNodeCounter = 0

    const parser = new DOMParser()
    // 创建一个临时的DOM文档来处理HTML片段
    const tempDoc = parser.parseFromString(
      `<html><head><meta charset="utf-8"/></head><body></body></html>`,
      'text/html',
    )
    tempDoc.body.innerHTML = htmlText // 将下载的HTML片段放入body

    // 简繁转换 (依赖页面环境的 currentEncoding, targetEncoding, translateBody)
    // 这里的转换是针对下载到的HTML片段，而不是整个页面
    // 需要确保 unsafeWindow.translateBody 函数能处理DOM节点
    if (typeof unsafeWindow.currentEncoding !== 'undefined'
      && typeof unsafeWindow.targetEncoding !== 'undefined'
      && unsafeWindow.currentEncoding !== unsafeWindow.targetEncoding // 使用全局的 targetEncoding
      && typeof unsafeWindow.translateBody === 'function') {
      unsafeWindow.translateBody(tempDoc.body)
    }

    const elementsToRemove = []
    Array.from(tempDoc.body.children).forEach((child) => {
      if (child.tagName === 'UL' && child.id === 'contentdp') {
        elementsToRemove.push(child)
      }
      else if (child.tagName === 'DIV' && child.className === 'chaptertitle') {
        chapterCounter++
        const chapterTitleText = child.textContent.trim()
        const chapterDivId = `chapter_${chapterCounter}`
        // 替换为ePub内部结构，并添加锚点
        child.innerHTML = `<div id="${chapterDivId}"><h3>${cleanXmlIllegalChars(chapterTitleText)}</h3></div>`

        if (navTocEntry) {
          navTocEntry.chapterArr.push({
            chapterName: chapterTitleText,
            chapterID: chapterDivId,
            chapterHref: `${navTocEntry.volumeHref}#${chapterDivId}`,
          })
        }
        // 为章节名包裹可拖放span (用于编辑器)
        const titleSpan = tempDoc.createElement('span')
        titleSpan.id = `${TEXT_SPAN_PREFIX}_${chapterDivId}` // ID格式调整
        titleSpan.className = 'txtDropEnable'
        titleSpan.setAttribute('ondragover', 'return false')
        child.parentElement.insertBefore(titleSpan, child)
        titleSpan.appendChild(child)
      }
      else if (child.tagName === 'DIV' && child.className === 'chaptercontent') {
        Array.from(child.childNodes).forEach((contentNode) => {
          // 处理文本节点
          if (contentNode.nodeType === Node.TEXT_NODE && contentNode.textContent.trim() !== '') {
            textNodeCounter++
            const textSpan = tempDoc.createElement('span')
            textSpan.id = `${TEXT_SPAN_PREFIX}_${VolumeIndex}_${textNodeCounter}`
            textSpan.className = 'txtDropEnable'
            textSpan.setAttribute('ondragover', 'return false')
            child.insertBefore(textSpan, contentNode)
            textSpan.appendChild(contentNode)
          }
          // 处理图片占位符 (App接口下载的HTML)
          else if (contentNode.tagName === 'DIV' && contentNode.className === 'divimage' && contentNode.hasAttribute('title')) {
            const imgSrc = contentNode.getAttribute('title') // app接口下载的html里是title属性
            if (imgSrc) {
              const imgUrl = new URL(imgSrc)
              const imgFileName = imgUrl.pathname.split('/').pop()
              // 构建ePub内部图片路径，保持目录结构
              const imgPathInEpub = `Images${imgUrl.pathname}`

              // 替换占位符为ePub内部img标签
              contentNode.innerHTML = `<img src="../${imgPathInEpub}" alt="${cleanXmlIllegalChars(imgFileName)}"/>` // 放入相对路径

              imageCounter++
              const imageId = `${IMAGE_FILE_PREFIX}_${VolumeIndex}_${imageCounter}`
              const imageEntry = {
                path: imgPathInEpub,
                content: null, // 稍后下载
                id: imageId,
                idName: imgFileName, // 文件名作为标识
                TextId: volumeTextData.id, // 关联到分卷ID
                coverImgChk: (VolumeIndex === 0 && imageCounter <= 2), // 前两张图作为封面候选
              }
              // 避免重复添加相同的图片URL
              if (!bookInfo.Images.some(img => img.path === imageEntry.path)) {
                bookInfo.Images.push(imageEntry)
                bookInfo.XHRManager.add({
                  type: 'image',
                  url: imgSrc,
                  loadFun: imgXhr => VolumeLoader.loadImage(imgXhr), // 静态方法调用
                  images: imageEntry, // 传递图片条目信息
                  bookInfo,
                  isCritical: false, // 图片不是关键任务
                })
              }
            }
          }
        })
      }
    })
    elementsToRemove.forEach(el => el.parentElement.removeChild(el))

    // 将处理后的body内容保存到 Text 条目中
    volumeTextData.content = tempDoc.body.innerHTML

    // 如果处理完一卷没有图片，尝试添加书籍缩略图作为封面 (仅对第一卷执行一次)
    if (VolumeIndex === 0 && !bookInfo.thumbnailImageAdded) {
      const pathParts = CURRENT_URL.pathname.replace('novel', 'image').split('/')
      pathParts.pop() // 移除文件名部分
      const bookNumericId = pathParts.find(p => /^\d+$/.test(p)) // 找到书籍数字ID
      if (bookNumericId) {
        const thumbnailImageId = `${bookNumericId}s` // 如 1234s
        const thumbnailSrc = `https://${IMAGE_DOMAIN}${pathParts.join('/')}/${thumbnailImageId}.jpg`
        const thumbnailPathInEpub = `Images/${bookNumericId}/${thumbnailImageId}.jpg`

        const thumbnailEntry = {
          path: thumbnailPathInEpub,
          content: null,
          id: thumbnailImageId, // 使用图片本身的ID
          idName: `${thumbnailImageId}.jpg`,
          TextId: '', // 不关联特定卷，作为通用封面候选
          smallCover: true, // 标记为缩略图封面候选
          isCritical: false, // 缩略图不是关键任务
        }
        // 避免重复添加
        if (!bookInfo.Images.some(img => img.id === thumbnailEntry.id)) {
          bookInfo.Images.push(thumbnailEntry)
          bookInfo.XHRManager.add({
            type: 'image',
            url: thumbnailSrc,
            loadFun: thumbXhr => VolumeLoader.loadImage(thumbXhr),
            images: thumbnailEntry,
            bookInfo,
            isCritical: false,
          })
          bookInfo.thumbnailImageAdded = true // 标记已尝试添加缩略图
        }
      }
    }

    // 触发内容简介下载 (如果尚未开始)
    if (!bookInfo.descriptionXhrInitiated) {
      bookInfo.descriptionXhrInitiated = true
      bookInfo.XHRManager.add({
        type: 'description',
        url: `/book/${bookInfo.aid}.htm`, // 相对路径
        loadFun: descXhr => VolumeLoader.loadBookDescription(descXhr),
        bookInfo,
        isCritical: true, // 简介是关键任务
      })
    }

    // 文本处理完成后，尝试构建ePub
    bookInfo.tryBuildEpub()
  },
}
