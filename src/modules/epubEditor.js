export const EpubEditor = {
  novelTableElement: null,
  config: {
    UID: EPUB_EDITOR_CONFIG_UID,
    aid: unsafeWindow.article_id, // 来自页面全局变量
    pathname: CURRENT_URL.pathname,
    ImgLocation: [],
  },
  imgLocationRegex: [/img/i, /插图/, /插圖/, /\.jpg/i, /\.png/i],
  styleLinks: [],
  editorRootElement: null,
  lastClickedVolumeLI: null,
  _bookInfoInstance: null, // 保存EpubBuilder实例引用
  _currentVolumeImageMap: new Map(), // 当前卷可用的图片映射 {idName: imgElement}

  /**
   * 初始化ePub编辑器
   * @param {EpubBuilderCoordinator} bookInfoInstance - 协调器实例
   */
  init(bookInfoInstance) {
    this._bookInfoInstance = bookInfoInstance
    // 隐藏目录下载链接
    document.querySelectorAll('.DownloadAll').forEach(el => el.style.pointerEvents = 'none')
    this.novelTableElement = document.body.getElementsByTagName('table')[0]
    if (this.novelTableElement)
      this.novelTableElement.style.display = 'none'

    // 加载编辑器CSS
    const editorCss = document.createElement('link')
    editorCss.type = 'text/css'
    editorCss.rel = 'stylesheet'
    editorCss.href = '/themes/wenku8/style.css' // 假设路径正确
    document.head.appendChild(editorCss)
    this.styleLinks.push(editorCss)

    this.editorRootElement = document.createElement('div')
    this.editorRootElement.id = 'ePubEidter'
    this.editorRootElement.style.display = 'none' // 初始隐藏，等待CSS加载
    editorCss.onload = () => {
      this.editorRootElement.style.display = ''
    }
    this.editorRootElement.innerHTML = this._getEditorHtmlTemplate()

    if (this.novelTableElement && this.novelTableElement.parentElement) {
      this.novelTableElement.parentElement.insertBefore(this.editorRootElement, this.novelTableElement)
    }
    else {
      document.body.appendChild(this.editorRootElement) // Fallback
      console.warn('未能找到合适的编辑器挂载点，编辑器已追加到body。')
    }

    // 绑定事件监听器
    document.getElementById('EidterBuildBtn').addEventListener('click', event => this.handleBuildEpubClick(event))
    document.getElementById('EidterImportBtn').addEventListener('click', event => this.handleImportConfigClick(event))
    document.getElementById('VolumeImg').addEventListener('drop', event => this.handleImageDeleteDrop(event)) // 用于删除已放置图片
    document.getElementById('VolumeImg').addEventListener('dragover', event => event.preventDefault()) // 允许拖放

    // 初始化配置文本框
    this.config.ImgLocation = bookInfoInstance.ImgLocation // 从EpubBuilder同步初始位置
    document.getElementById('CfgArea').value = JSON.stringify(this.config, null, '  ')

    this._populateVolumeList()
  },

  /**
   * 销毁编辑器DOM和事件监听器
   */
  destroy() {
    if (this.editorRootElement && this.editorRootElement.parentElement) {
      // 移除事件监听器 (简单起见，直接移除DOM，大部分事件监听器会随之消失)
      // 更严谨的做法是保存监听器引用并在destroy时移除
      this.editorRootElement.parentElement.removeChild(this.editorRootElement)
    }
    this.styleLinks.forEach(link => link.parentElement && link.parentElement.removeChild(link))
    if (this.novelTableElement)
      this.novelTableElement.style.display = ''
    document.querySelectorAll('.DownloadAll').forEach(el => el.style.pointerEvents = 'auto')
    this.editorRootElement = null
    this._bookInfoInstance = null // 清除引用
    this._currentVolumeImageMap.clear()
  },

  /**
   * 填充分卷列表
   */
  _populateVolumeList() {
    const volumeUl = document.getElementById('VolumeUL')
    if (!volumeUl)
      return
    volumeUl.innerHTML = ''
    let firstLi = null
    this._bookInfoInstance.Text.forEach((textEntry) => { // Text 来自 EpubBuilder实例
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.href = 'javascript:void(0);'
      a.id = textEntry.id // 分卷DOM ID
      a.textContent = textEntry.volumeName
      li.appendChild(a)
      li.addEventListener('click', event => this.handleVolumeClick(event, textEntry))
      volumeUl.appendChild(li)
      if (!firstLi)
        firstLi = li
    })
    if (firstLi)
      firstLi.click() // 默认加载第一卷
  },

  /**
   * 处理分卷列表点击事件
   * @param {MouseEvent} event
   * @param {object} textEntry - 当前卷的文本数据 {path, content, id, vid, volumeName, navToc}
   */
  handleVolumeClick(event, textEntry) {
    if (this.lastClickedVolumeLI) {
      this.lastClickedVolumeLI.firstElementChild.style.color = ''
    }
    this.lastClickedVolumeLI = event.currentTarget
    this.lastClickedVolumeLI.firstElementChild.style.color = 'fuchsia'

    const volumeTextDiv = document.getElementById('VolumeText')
    if (!volumeTextDiv)
      return

    volumeTextDiv.style.display = 'none' // 先隐藏再填充，避免闪烁
    volumeTextDiv.innerHTML = textEntry.content // textEntry.content 是已处理的HTML

    this._populateImageListForVolume(textEntry)
    this._populateGuessedImageLocations(textEntry)
    this._populateChapterNavForVolume(textEntry)

    volumeTextDiv.style.display = ''
    volumeTextDiv.scrollTop = 0
    const volumeImgDiv = document.getElementById('VolumeImg')
    if (volumeImgDiv)
      volumeImgDiv.scrollTop = 0
  },

  /**
   * 填充当前卷可用的图片列表
   * @param {object} textEntry - 当前卷的文本数据
   */
  _populateImageListForVolume(textEntry) {
    const volumeImgDiv = document.getElementById('VolumeImg')
    if (!volumeImgDiv)
      return
    volumeImgDiv.innerHTML = ''
    this._currentVolumeImageMap.clear() // 清空旧的映射

    this._bookInfoInstance.Images
      .filter(img => img.TextId === textEntry.id || img.smallCover) // 显示当前卷的图片和通用小封面
      .forEach((imageInfo) => {
        // 确保图片内容已下载且可以创建ObjectURL
        if (!imageInfo.ObjectURL && imageInfo.content) {
          try {
            imageInfo.Blob = new Blob([imageInfo.content], { type: 'image/jpeg' }) // 假设jpeg
            imageInfo.ObjectURL = URL.createObjectURL(imageInfo.Blob)
          }
          catch (e) {
            console.error(`创建图片Blob失败 for ${imageInfo.idName}:`, e)
            return // 跳过此图片
          }
        }
        else if (!imageInfo.ObjectURL && !imageInfo.content) {
          console.warn(`图片 ${imageInfo.idName} 既无ObjectURL也无content，无法显示。`)
          return
        }

        const div = document.createElement('div')
        div.className = 'editor-image-item' // 自定义类名方便样式
        const img = document.createElement('img')
        img.setAttribute('imgID', imageInfo.idName) // 使用原始文件名作为拖拽数据
        img.src = imageInfo.ObjectURL
        img.height = 127
        img.draggable = true // 使图片可拖动
        img.addEventListener('dragstart', event => this.handleImageDragStart(event, imageInfo))

        this._currentVolumeImageMap.set(imageInfo.idName, img) // 存入map
        div.appendChild(img)
        div.appendChild(document.createElement('br'))
        div.appendChild(document.createTextNode(imageInfo.id)) // 显示内部ID
        volumeImgDiv.appendChild(div)
      })
  },

  /**
   * 填充推测的插图位置列表并在文本中标记
   * @param {object} textEntry - 当前卷的文本数据
   */
  _populateGuessedImageLocations(textEntry) {
    const imgUl = document.getElementById('ImgUL')
    if (!imgUl)
      return
    imgUl.innerHTML = ''
    const currentVolumeLocations = this._bookInfoInstance.ImgLocation.filter(loc => loc.vid === textEntry.vid)

    document.querySelectorAll('#VolumeText .txtDropEnable').forEach((dropTargetSpan) => {
      // 移除旧的事件监听器，避免重复绑定 (如果handleVolumeClick被多次调用)
      // 简单起见，这里依赖于DOM元素的移除和重新创建
      // 绑定新的事件监听器
      dropTargetSpan.addEventListener('drop', event => this.handleTextDrop(event, textEntry))
      dropTargetSpan.addEventListener('dragover', event => event.preventDefault()) // 必须阻止默认行为

      // 加载已配置的图片 (在文本中显示)
      currentVolumeLocations.filter(loc => loc.spanID === dropTargetSpan.id).forEach((loc) => {
        const draggedImgElement = this._currentVolumeImageMap.get(loc.imgID)
        if (draggedImgElement) {
          const divImage = document.createElement('div')
          divImage.className = 'divimageM' // 编辑器内显示样式
          divImage.innerHTML = draggedImgElement.outerHTML // 复制img标签
          const actualImgInDiv = divImage.firstElementChild
          actualImgInDiv.id = `${loc.spanID}_${loc.imgID}` // 唯一ID
          actualImgInDiv.draggable = true
          actualImgInDiv.addEventListener('dragstart', ev => this.handlePlacedImageDragStart(ev, loc))
          dropTargetSpan.parentNode.insertBefore(divImage, dropTargetSpan)
        }
      })

      // 推测插图位置并添加到列表中
      // 仅对非章节标题的span进行推测
      if (!dropTargetSpan.firstElementChild || dropTargetSpan.firstElementChild.className !== 'chaptertitle') {
        for (const regex of this.imgLocationRegex) {
          if (regex.test(dropTargetSpan.textContent)) {
            const li = document.createElement('li')
            const a = document.createElement('a')
            a.href = 'javascript:void(0);'
            a.setAttribute('SpanID', dropTargetSpan.id)
            a.textContent = `${dropTargetSpan.textContent.replace(/\s/g, '').substring(0, 12)}...` // 截断显示
            li.appendChild(a)
            li.addEventListener('click', () => this.handleGuessedLocationClick(dropTargetSpan))
            imgUl.appendChild(li)
            dropTargetSpan.style.color = 'fuchsia' // 标记推测位置
            break // 找到一个匹配就够了
          }
        }
      }
    })
  },

  /**
   * 填充章节导航列表
   * @param {object} textEntry - 当前卷的文本数据
   */
  _populateChapterNavForVolume(textEntry) {
    const chapterUl = document.getElementById('ChapterUL')
    if (!chapterUl)
      return
    chapterUl.innerHTML = ''
    const tocEntry = this._bookInfoInstance.nav_toc.find(toc => toc.volumeID === textEntry.id)
    if (tocEntry && tocEntry.chapterArr) {
      tocEntry.chapterArr.forEach((chapter) => {
        const li = document.createElement('li')
        const a = document.createElement('a')
        a.href = 'javascript:void(0);'
        a.setAttribute('chapterID', chapter.chapterID)
        a.textContent = chapter.chapterName
        li.appendChild(a)
        li.addEventListener('click', () => this.handleChapterNavClick(chapter.chapterID))
        chapterUl.appendChild(li)
      })
    }
  },

  /**
   * 处理从图片列表拖动图片开始事件
   * @param {DragEvent} event
   * @param {object} imageInfo - 图片条目信息
   */
  handleImageDragStart(event, imageInfo) {
    // 从图片列表拖出时，只传递图片ID (idName)
    event.dataTransfer.setData('text/plain', imageInfo.idName) // 使用 idName (文件名)
    event.dataTransfer.setData('sourceType', 'newImage')
  },

  /**
   * 处理从文本中拖动已放置图片开始事件
   * @param {DragEvent} event
   * @param {object} imgLocation - 图片位置配置 {vid, spanID, imgID}
   */
  handlePlacedImageDragStart(event, imgLocation) {
    // 从文本中已放置的图片拖出时 (用于删除或移动)
    event.dataTransfer.setData('text/plain', JSON.stringify(imgLocation))
    event.dataTransfer.setData('sourceType', 'placedImage')
    event.dataTransfer.setData('elementId', event.target.id) // 拖动的img元素的ID
  },

  /**
   * 处理拖动图片到文本区域的放置事件
   * @param {DragEvent} event
   * @param {object} textEntry - 当前卷的文本数据
   */
  handleTextDrop(event, textEntry) {
    event.preventDefault()
    const sourceType = event.dataTransfer.getData('sourceType')

    if (sourceType === 'newImage') { // 从图片列表拖入
      const imgIdName = event.dataTransfer.getData('text/plain') // 这是图片的 idName (文件名)
      const dropTargetSpan = event.currentTarget // .txtDropEnable span

      const newLocation = {
        vid: textEntry.vid,
        spanID: dropTargetSpan.id,
        imgID: imgIdName,
      }

      // 检查是否已存在相同的配置
      if (this._bookInfoInstance.ImgLocation.some(loc =>
        loc.vid === newLocation.vid && loc.spanID === newLocation.spanID && loc.imgID === newLocation.imgID)) {
        // console.error("此位置已存在相同的图片。"); // 避免频繁弹窗
        this._bookInfoInstance.logger.logWarn(`尝试在 ${newLocation.spanID} 放置重复图片 ${newLocation.imgID}。`)
        return
      }

      this._bookInfoInstance.ImgLocation.push(newLocation)

      const draggedImgElement = this._currentVolumeImageMap.get(imgIdName)
      if (draggedImgElement) {
        const divImage = document.createElement('div')
        divImage.className = 'divimageM'
        divImage.innerHTML = draggedImgElement.outerHTML // 复制img
        const actualImgInDiv = divImage.firstElementChild
        actualImgInDiv.id = `${newLocation.spanID}_${newLocation.imgID}` // 唯一ID
        actualImgInDiv.draggable = true
        actualImgInDiv.addEventListener('dragstart', ev => this.handlePlacedImageDragStart(ev, newLocation))
        dropTargetSpan.parentNode.insertBefore(divImage, dropTargetSpan)
      }
      this._updateConfigTextarea()
    }
    // 如果是从文本中拖动已放置图片到另一个文本位置 (移动)，则忽略，只处理删除
  },

  /**
   * 处理拖动已放置图片到删除区域的放置事件
   * @param {DragEvent} event
   */
  handleImageDeleteDrop(event) { // 拖放到“回收站”区域
    event.preventDefault()
    const sourceType = event.dataTransfer.getData('sourceType')
    if (sourceType === 'placedImage') {
      const imgLocationJson = event.dataTransfer.getData('text/plain')
      const elementIdToRemove = event.dataTransfer.getData('elementId')
      try {
        const locToRemove = JSON.parse(imgLocationJson)
        // 从配置数组中移除对应的项
        this._bookInfoInstance.ImgLocation = this._bookInfoInstance.ImgLocation.filter(loc =>
          !(loc.vid === locToRemove.vid && loc.spanID === locToRemove.spanID && loc.imgID === locToRemove.imgID),
        )

        // 从DOM中移除图片元素
        const domElementToRemove = document.getElementById(elementIdToRemove)
        if (domElementToRemove && domElementToRemove.parentElement.className === 'divimageM') {
          domElementToRemove.parentElement.remove()
        }
        this._updateConfigTextarea()
        this._bookInfoInstance.logger.logInfo(`已移除图片 ${locToRemove.imgID} 在 ${locToRemove.spanID} 的位置配置。`)
      }
      catch (e) {
        console.error('解析拖放数据失败:', e)
        this._bookInfoInstance.logger.logError('删除图片配置失败。')
      }
    }
  },

  /**
   * 处理推测插图位置列表点击事件 (滚动到文本位置)
   * @param {HTMLElement} dropTargetSpan - 对应的文本span元素
   */
  handleGuessedLocationClick(dropTargetSpan) {
    const volumeTextDiv = document.getElementById('VolumeText')
    if (volumeTextDiv && dropTargetSpan) {
      // 滚动到元素位置，留出一些偏移
      volumeTextDiv.scroll({ top: dropTargetSpan.offsetTop - 130, behavior: 'smooth' })
    }
  },

  /**
   * 处理章节导航列表点击事件 (滚动到章节位置)
   * @param {string} chapterDomId - 章节对应的DOM ID
   */
  handleChapterNavClick(chapterDomId) {
    const targetElement = document.getElementById(chapterDomId)
    if (targetElement) {
      const volumeTextDiv = document.getElementById('VolumeText')
      if (volumeTextDiv) {
        volumeTextDiv.scroll({ top: targetElement.offsetTop, behavior: 'smooth' })
      }
    }
  },

  /**
   * 处理“生成ePub”按钮点击事件
   * @param {MouseEvent} event
   */
  handleBuildEpubClick(event) {
    event.currentTarget.disabled = true
    this._bookInfoInstance.ePubEidtDone = true // 标记编辑完成
    this._bookInfoInstance.tryBuildEpub() // 通知EpubBuilder构建

    if (document.getElementById('SendArticle')?.checked && this._bookInfoInstance.ImgLocation.length > 0) {
      this._sendConfigToServer()
    }

    // 按钮在构建完成后或失败后才重新启用
    // event.currentTarget.disabled = false; // 不在这里立即启用，由构建流程结束时处理

    // 自动关闭编辑器 (如果勾选)
    if (document.getElementById('ePubEditerClose')?.checked) {
      // 延迟销毁，给用户看一眼进度或错误
      setTimeout(() => {
        if (this._bookInfoInstance && this._bookInfoInstance.XHRManager.areAllTasksDone()) {
          this.destroy()
        }
        else {
          // 如果构建失败或未完成，不自动关闭
          this._bookInfoInstance.logger.logInfo('ePub生成未完成或失败，编辑器未自动关闭。')
        }
      }, 3000) // 延迟3秒
    }
  },

  /**
   * 处理“导入配置”按钮点击事件
   * @param {MouseEvent} event
   */
  handleImportConfigClick(event) {
    event.currentTarget.disabled = true
    const cfgArea = document.getElementById('CfgArea')
    if (!cfgArea) {
      event.currentTarget.disabled = false
      return
    }
    try {
      const importedCfg = JSON.parse(cfgArea.value)
      if (importedCfg && importedCfg.UID === this.config.UID
        && importedCfg.aid === this.config.aid // 使用 === 因为页面aid可能是字符串
        && Array.isArray(importedCfg.ImgLocation) && importedCfg.ImgLocation.length > 0) {
        let importedCount = 0
        importedCfg.ImgLocation.forEach((iCfg) => {
          // 校验导入的配置项是否有效
          if (!this._bookInfoInstance.Text.some(t => t.vid === iCfg.vid)) {
            console.warn(`导入配置跳过无效卷ID: ${iCfg.vid}`)
            return // 必须是当前书籍存在的卷
          }
          if (!iCfg.spanID || !iCfg.imgID) {
            console.warn(`导入配置跳过无效项: ${JSON.stringify(iCfg)}`)
            return // 必须包含spanID和imgID
          }

          // 避免重复添加
          if (!this._bookInfoInstance.ImgLocation.some(loc =>
            loc.vid === iCfg.vid && loc.spanID === iCfg.spanID && loc.imgID === iCfg.imgID,
          )) {
            this._bookInfoInstance.ImgLocation.push({
              vid: String(iCfg.vid), // 确保vid是字符串，与内部存储一致
              spanID: String(iCfg.spanID),
              imgID: String(iCfg.imgID),
            })
            importedCount++
          }
        })
        this._updateConfigTextarea() // 使用最新的 ImgLocation 更新
        this._bookInfoInstance.logger.logInfo(`成功导入 ${importedCount} 条插图位置配置。`)
        if (this.lastClickedVolumeLI)
          this.lastClickedVolumeLI.click() // 刷新当前卷视图
      }
      else {
        console.error('导入的配置格式不正确或与当前书籍不匹配。')
      }
    }
    catch (e) {
      console.error('导入配置失败：JSON格式错误。')
      console.error('导入配置解析错误:', e)
    }
    event.currentTarget.disabled = false
  },

  /**
   * 更新配置文本框内容
   */
  _updateConfigTextarea() {
    this.config.ImgLocation = this._bookInfoInstance.ImgLocation // 同步回编辑器内部config
    const cfgArea = document.getElementById('CfgArea')
    if (cfgArea)
      cfgArea.value = JSON.stringify(this.config, null, '  ')
  },

  /**
   * 将配置发送到书评区
   */
  _sendConfigToServer() {
    const cfgToSend = { ...this.config } // 浅拷贝
    const imgLocJson = JSON.stringify(this._bookInfoInstance.ImgLocation)

    const zip = new JSZip()
    zip.file(IMG_LOCATION_FILENAME, imgLocJson, {
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })

    zip.generateAsync({ type: 'base64', mimeType: 'application/zip' })
      .then((base64Data) => {
        cfgToSend.ImgLocationBase64 = base64Data
        delete cfgToSend.ImgLocation // 移除原始数组

        const uniqueVolumeNames = [...new Set(
          this._bookInfoInstance.ImgLocation
            .map(loc => this._bookInfoInstance.nav_toc.find(toc => toc.vid === loc.vid))
            .filter(Boolean)
            .map(toc => toc.volumeName),
        )]

        const postContent = `包含分卷列表：${uniqueVolumeNames.join(', ')}\n[code]${JSON.stringify(cfgToSend)}[/code]`
        const postData = new Map([
          ['ptitle', 'ePub插图位置 (优化版脚本)'],
          ['pcontent', postContent],
        ])
        const postUrl = `/modules/article/reviews.php?aid=${this._bookInfoInstance.aid}`

        // 使用 iframe post 提交 (简单实现，不处理响应)
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        document.body.appendChild(iframe)
        const iframeDoc = iframe.contentWindow.document
        const form = iframeDoc.createElement('form')
        form.acceptCharset = 'gbk' // 网站编码
        form.method = 'POST'
        form.action = postUrl
        postData.forEach((value, key) => {
          const input = iframeDoc.createElement('input')
          input.type = 'hidden' // 或 "text"
          input.name = key
          input.value = value
          form.appendChild(input)
        })
        iframeDoc.body.appendChild(form)
        form.submit()
        setTimeout(() => iframe.remove(), 5000) // 5秒后移除iframe
        this._bookInfoInstance.logger.logInfo('插图配置已尝试发送到书评区。')
      })
      .catch((err) => {
        this._bookInfoInstance.logger.logError(`压缩配置失败，无法发送到书评区: ${err.message}`)
        console.error('Zip config error:', err)
      })
  },

  /**
   * 获取编辑器HTML模板字符串
   * @returns {string} HTML模板
   */
  _getEditorHtmlTemplate() {
    // 模板字符串保持不变，注意其中的CSS类名和ID需要与JS代码对应
    return `
            <style>
                .editor-image-item { float: left; text-align: center; height: 155px; overflow: hidden; margin: 0 2px; border: 1px solid #ccc; padding: 2px; }
                .editor-image-item img { cursor: grab; }
                #VolumeImg[ondragover="return false"] { border: 2px dashed #ccc; padding: 5px; background-color: #f0f0f0; min-height: 160px;}
                .divimageM { border: 1px dotted blue; padding: 2px; margin: 2px 0; display: inline-block; }
                .divimageM img { display: block; max-width: 100%; }
                #ePubEidter .main { width: 1200px; margin: 0 auto; } /* 居中 */
                #ePubEidter #left { float: left; width: 200px; margin-right: 10px; }
                #ePubEidter #centerm { overflow: hidden; } /* 占据剩余空间 */
                #ePubEidter .block { border: 1px solid #ccc; margin-bottom: 10px; }
                #ePubEidter .blocktitle { background-color: #eee; padding: 5px; font-weight: bold; }
                #ePubEidter .blockcontent { padding: 5px; }
                #ePubEidter .ulrow { list-style: none; padding: 0; margin: 0; }
                #ePubEidter .ulrow li { margin-bottom: 5px; }
                #ePubEidter .ulrow a { text-decoration: none; color: #333; }
                #ePubEidter .ulrow a:hover { text-decoration: underline; }
                #ePubEidter .cb { clear: both; }
                #ePubEidter .textarea { width: 95%; }
                #ePubEidter .button { margin-right: 5px; }
                #ePubEidter .grid { border-collapse: collapse; width: 100%; }
                #ePubEidter .grid td { border: 1px solid #ccc; padding: 5px; vertical-align: top; }
                #ePubEidter .grid caption { font-weight: bold; margin-bottom: 5px; }
                #ePubEidter #VolumeText { height:500px; overflow: hidden scroll ;max-width: 900px; } /* 限制宽度 */
            </style>
            <div class="main">
                <!--左 章节-->
                <div id="left">
                    <div class="block" style="min-height: 230px;">
                        <div class="blocktitle"><span class="txt">操作设置</span><span class="txtr"></span></div>
                        <div class="blockcontent"><div style="padding-left:10px">
                            <ul class="ulrow">
                                <li><label for="SendArticle">将配置发送到书评：</label><input type="checkbox" id="SendArticle" /></li>
                                <li><label for="ePubEditerClose">生成后自动关闭：</label><input type="checkbox" id="ePubEditerClose" checked="true" /></li>
                                <li>配置内容：</li>
                                <li><textarea id="CfgArea" class="textarea" style="height:100px;"></textarea></li>
                                <li><input type="button" id="EidterImportBtn" class="button" value="导入配置" /></li>
                                <li><input type="button" id="EidterBuildBtn" class="button" value="生成ePub" /></li>
                            </ul><div class="cb"></div>
                        </div></div>
                    </div>
                    <div class="block" style="min-height: 230px;">
                        <div class="blocktitle"><span class="txt">分卷</span><span class="txtr"></span></div>
                        <div class="blockcontent"><div style="padding-left:10px">
                            <ul id="VolumeUL" class="ulrow"></ul><div class="cb"></div>
                        </div></div>
                    </div>
                </div>
                <!--左 章节-->
                <div id="left">
                    <div class="block" style="min-height: 230px;">
                        <div class="blocktitle"><span class="txt">推测插图位置</span><span class="txtr"></span></div>
                        <div class="blockcontent"><div style="padding-left:10px">
                            <ul id="ImgUL" class="ulrow" style="max-height: 200px; overflow-y: auto;"></ul><div class="cb"></div>
                        </div></div>
                    </div>
                    <div class="block" style="min-height: 230px;">
                        <div class="blocktitle"><span class="txt">章节</span><span class="txtr"></span></div>
                        <div class="blockcontent"><div style="padding-left:10px">
                            <ul id="ChapterUL" class="ulrow" style="max-height: 200px; overflow-y: auto;"></ul><div class="cb"></div>
                        </div></div>
                    </div>
                </div>
                <!--右 内容-->
                <div id="centerm">
                    <div id="content">
                        <table class="grid" width="100%" align="center"><tbody>
                            <tr>
                                <td width="4%" align="center"><span style="font-size:16px;">分<br>卷<br>插<br>图<br><br>(可拖拽图片到下方文本)<br><br>(将已放置图片拖到此处可删除)</span></td>
                                <td><div ondragover="return false" id="VolumeImg" style="height:155px;overflow:auto"></div></td>
                            </tr>
                        </tbody></table>
                        <table class="grid" width="100%" align="center">
                            <caption>分卷内容 (可拖入图片)</caption><tbody>
                                <tr><td><div id="VolumeText" style="height:500px;overflow: hidden scroll ;max-width: 900px;"></div></td></tr>
                            </tbody></table>
                    </div>
                </div>
            </div>`
  },
}
