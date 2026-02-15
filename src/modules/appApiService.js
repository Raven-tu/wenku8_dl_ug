export const AppApiService = {
  volumeChapterData: new Map(), // 存储卷的章节列表 { vid: [{cid, cName, content}]}
  chapterListXml: null, // 缓存书籍的章节列表XML Document
  isChapterListLoading: false,
  chapterListTaskAdded: false,
  chapterListWaitQueue: [], // 等待章节列表的请求xhr包装对象
  disableTraditionalChineseRequest: true, // 默认禁用APP接口请求繁体，由前端OpenCC处理

  _getApiLanguageParam(bookInfo) {
    // 使用 bookInfo 中的 targetEncoding，如果不存在则回退到页面全局变量
    const targetEncoding = bookInfo?.targetEncoding || unsafeWindow.targetEncoding
    if (this.disableTraditionalChineseRequest || !targetEncoding) {
      return '0' // 简体
    }
    return targetEncoding === '1' ? '1' : '0' // "1" 繁体, "0" 简体
  },

  _encryptRequestBody(body) {
    // 确保 btoa 可用，在油猴环境中通常是可用的
    return `appver=1.0&timetoken=${Number(new Date())}&request=${btoa(body)}`
  },

  /**
   * 从App接口获取书籍章节列表XML
   * @param {object} xhrTask - 章节目录任务对象
   * @returns {Promise<void>}
   */
  async _fetchChapterList(xhrTask) {
    const { bookInfo } = xhrTask
    if (this.isChapterListLoading)
      return // 避免重复请求

    this.isChapterListLoading = true
    bookInfo.refreshProgress(bookInfo, `下载App章节目录...`)
    const langParam = this._getApiLanguageParam(bookInfo)
    const requestBody = this._encryptRequestBody(`action=book&do=list&aid=${bookInfo.aid}&t=${langParam}`)
    const url = `http://${APP_API_DOMAIN}${APP_API_PATH}`

    try {
      const response = await gmXmlHttpRequestAsync({
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
        // 清理非法XML字符
        this.chapterListXml = parser.parseFromString(cleanXmlIllegalChars(response.responseText), 'application/xml')
        bookInfo.refreshProgress(bookInfo, `App章节目录下载完成。`)
        this.chapterListTaskAdded = false
        bookInfo.XHRManager.taskFinished(xhrTask, false)
        // 处理等待队列
        const waitQueue = this.chapterListWaitQueue.slice()
        this.chapterListWaitQueue = []
        waitQueue.forEach(queuedXhr => this.loadVolumeChapters(queuedXhr))
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error) {
      bookInfo.logger.logError(`App章节目录下载失败: ${error.message}`)
      bookInfo.XHRManager.retryTask(xhrTask, 'App章节目录下载失败，重新下载')
    }
    finally {
      this.isChapterListLoading = false
    }
  },

  /**
   * 加载指定分卷的章节内容 (从App接口)
   * @param {object} xhrVolumeRequest - 卷的XHR任务对象 (由VolumeLoader或Coordinator创建)
   *   - bookInfo: 协调器实例
   *   - data: { vid, vcssText, Text }
   *   - dealVolume: 处理函数 (通常是 VolumeLoader.dealVolumeText)
   */
  async loadVolumeChapters(xhrVolumeRequest) {
    const { bookInfo, data: volumeData } = xhrVolumeRequest

    if (!this.chapterListXml) {
      // 如果章节列表还在加载或未加载，加入等待队列
      if (!this.chapterListWaitQueue.includes(xhrVolumeRequest)) {
        this.chapterListWaitQueue.push(xhrVolumeRequest)
      }
      if (!this.chapterListTaskAdded) {
        this.chapterListTaskAdded = true
        bookInfo.XHRManager.add({
          type: 'appChapterList',
          url: `http://${APP_API_DOMAIN}${APP_API_PATH}`,
          loadFun: xhr => this._fetchChapterList(xhr),
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
      // 标记此任务失败，并通知XHRManager
      bookInfo.XHRManager.taskFinished(xhrVolumeRequest, true)
      return
    }

    const chapters = Array.from(volumeElement.children).map(ch => ({
      cid: ch.getAttribute('cid'),
      cName: ch.textContent,
      content: null, // 稍后填充
    }))
    this.volumeChapterData.set(volumeData.vid, chapters)

    // 为该卷的每个章节创建下载任务
    chapters.forEach((chapter) => {
      const chapterXhr = {
        type: 'appChapter', // 自定义类型
        url: `http://${APP_API_DOMAIN}${APP_API_PATH}`,
        loadFun: xhr => this._fetchChapterContent(xhr), // 指向内部方法
        dealVolume: xhrVolumeRequest.dealVolume, // 传递处理函数
        data: { ...volumeData, cid: chapter.cid, cName: chapter.cName, isAppApi: true },
        bookInfo,
        isCritical: true, // 章节内容是关键任务
      }
      bookInfo.XHRManager.add(chapterXhr)
    })

    // 标记此“加载分卷章节列表”任务完成
    bookInfo.XHRManager.taskFinished(xhrVolumeRequest, false)
  },

  /**
   * 从App接口获取单个章节内容
   * @param {object} xhrChapterRequest - 章节的XHR任务对象
   *   - bookInfo: 协调器实例
   *   - data: { vid, cid, cName, isAppApi, Text }
   *   - dealVolume: 处理函数 (VolumeLoader.dealVolumeText)
   */
  async _fetchChapterContent(xhrChapterRequest) {
    const { bookInfo, data } = xhrChapterRequest
    const langParam = this._getApiLanguageParam(bookInfo)
    const requestBody = this._encryptRequestBody(`action=book&do=text&aid=${bookInfo.aid}&cid=${data.cid}&t=${langParam}`)
    const failureMessage = `${data.cName} 下载失败`

    try {
      const response = await gmXmlHttpRequestAsync({
        method: 'POST',
        url: xhrChapterRequest.url,
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
          'User-Agent': 'Android',
        },
        data: requestBody,
      })

      if (response.status === 200) {
        const chapterVolumeData = this.volumeChapterData.get(data.vid)
        const chapterEntry = chapterVolumeData.find(c => c.cid === data.cid)
        if (chapterEntry) {
          chapterEntry.content = response.responseText
        }
        bookInfo.refreshProgress(bookInfo, `${data.cName} 下载完成。`)

        // 检查该卷所有章节是否都已下载完毕
        if (chapterVolumeData.every(c => c.content !== null)) {
          let combinedVolumeText = ''
          for (const chap of chapterVolumeData) {
            if (!chap.content)
              continue
            let content = chap.content
            // 章节名处理
            content = content.replace(chap.cName, `<div class="chaptertitle"><a name="${chap.cid}">${chap.cName}</a></div><div class="chaptercontent">`)
            content = content.replace(/\r\n/g, '<br />\r\n') // 换行
            // 插图处理
            if (content.includes('<!--image-->http')) {
              content = content.replace(/<!--image-->(http[\w:/.?@#&=%]+)<!--image-->/g, (match, p1) => `<div class="divimage" title="${p1}"></div>`)
            }
            content += `</div>`
            combinedVolumeText += content
          }
          // 调用原有的 dealVolume 处理合并后的文本
          // 传递给 VolumeLoader.dealVolumeText 的 xhr 应该是原始的卷任务对象，或者一个包含必要数据的伪造对象
          // 这里创建一个伪造对象，包含 VolumeLoader.dealVolumeText 需要的数据
          const pseudoVolumeXhr = {
            bookInfo,
            VolumeIndex: bookInfo.Text.findIndex(t => t.vid === data.vid), // 找到对应的卷索引
            data: { ...data, Text: bookInfo.Text.find(t => t.vid === data.vid) }, // 传递卷的Text对象
          }
          xhrChapterRequest.dealVolume(pseudoVolumeXhr, combinedVolumeText) // dealVolume 现在是 VolumeLoader.dealVolumeText
        }
        bookInfo.XHRManager.taskFinished(xhrChapterRequest, false) // 标记章节任务完成
      }
      else {
        throw new Error(`Status ${response.status}`)
      }
    }
    catch (error) {
      bookInfo.logger.logError(`${failureMessage} 错误: ${error.message}`)
      bookInfo.XHRManager.retryTask(xhrChapterRequest, failureMessage) // 使用XHRManager的重试
    }
  },

  /**
   * 对外暴露的接口，用于从App接口加载章节内容（通常用于版权受限页面）
   * @param {object} bookInfo - 包含 aid, logger, refreshProgress 的对象
   * @param {string} chapterId - 章节ID
   * @param {HTMLElement} contentElement - 显示内容的DOM元素
   * @param {Function} translateBodyFunc - 页面提供的翻译函数
   */
  async fetchChapterForReading(bookInfo, chapterId, contentElement, translateBodyFunc) {
    const langParam = this._getApiLanguageParam({ targetEncoding: unsafeWindow.targetEncoding }) // 使用页面全局的 targetEncoding
    const requestBody = this._encryptRequestBody(`action=book&do=text&aid=${bookInfo.aid}&cid=${chapterId}&t=${langParam}`)
    const url = `http://${APP_API_DOMAIN}${APP_API_PATH}`
    contentElement.innerHTML = '正在通过App接口加载内容，请稍候...'

    try {
      const response = await gmXmlHttpRequestAsync({
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
        rawText = rawText.replace(/ {2}\S.*/, '') // 移除末尾可能的垃圾信息
        rawText = rawText.replace(/\r\n/g, '<br />\r\n')
        if (rawText.includes('<!--image-->http')) {
          rawText = rawText.replace(/<!--image-->(http[\w:/.?@#&=%]+)<!--image-->/g, (m, p1) => `<div class="divimage"><a href="${p1}" target="_blank"><img src="${p1}" border="0" class="imagecontent"></a></div>`)
        }
        contentElement.innerHTML = rawText // 不加外层div，假设原逻辑如此
        if (typeof translateBodyFunc === 'function') {
          translateBodyFunc(contentElement) // 调用页面翻译函数
        }
      }
      else {
        contentElement.innerHTML = `通过App接口加载内容失败，状态码: ${response.status}`
      }
    }
    catch (error) {
      contentElement.innerHTML = `通过App接口加载内容失败: ${error.message}`
      console.error('App接口内容加载失败:', error)
    }
  },
}
