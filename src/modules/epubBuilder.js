import { saveAs } from 'file-saver'
import JSZip from 'jszip'

export const EpubFileBuilder = {
  MIMETYPE: 'application/epub+zip',
  CONTAINER_XML: `<?xml version="1.0" ?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" /></rootfiles></container>`,
  DEFAULT_CSS: {
    content: `nav#landmarks, nav#page-list { display:none; } ol { list-style-type: none; } .volumetitle, .chaptertitle { text-align: center; } .divimage { text-align: center; margin-top: 0.5em; margin-bottom: 0.5em; } .divimage img { max-width: 100%; height: auto; vertical-align: middle; }`,
    id: 'default_css_id',
    path: 'Styles/default.css',
  },
  NAV_XHTML_TEMPLATE: {
    content: `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN" xml:lang="zh-CN"><head><title>目录</title><meta charset="utf-8"/><link href="../Styles/default.css" rel="stylesheet" type="text/css"/></head><body epub:type="frontmatter"><nav epub:type="toc" id="toc" role="doc-toc"><h2><a href="#toc">目录</a></h2></nav></body></html>`,
    path: `Text/nav.xhtml`,
    id: `nav_xhtml_id`,
  },

  /**
   * 构建并生成ePub文件
   * @param {EpubBuilderCoordinator} bookInfo - 协调器实例
   */
  async build(bookInfo) {
    // 检查是否有关键下载失败
    if (bookInfo.XHRManager.hasCriticalFailure) {
      bookInfo.refreshProgress(bookInfo, `<span style="color:red;">关键文件下载失败，无法生成ePub。</span>`)
      // 重新启用生成按钮 (如果存在)
      const buildBtn = document.getElementById('EidterBuildBtn')
      if (buildBtn)
        buildBtn.disabled = false
      return
    }
    // 检查所有任务是否完成
    if (!bookInfo.XHRManager.areAllTasksDone()) {
      bookInfo.refreshProgress(bookInfo, `等待下载任务完成... (${bookInfo.tasksCompletedOrSkipped}/${bookInfo.totalTasksAdded})`)
      return // 还有任务在进行
    }

    // 如果处于编辑模式且用户尚未点击“生成ePub”
    if (bookInfo.ePubEidt && !bookInfo.ePubEidtDone) {
      bookInfo.refreshProgress(bookInfo, `等待用户编辑插图位置...`)
      // 初始化编辑器 (如果尚未初始化)
      if (!EpubEditor.editorRootElement) {
        EpubEditor.init(bookInfo)
      }
      return
    }

    bookInfo.refreshProgress(bookInfo, `开始生成ePub文件...`)
    const zip = new JSZip()
    zip.file('mimetype', this.MIMETYPE, { compression: 'STORE' })
    zip.file('META-INF/container.xml', this.CONTAINER_XML)

    const oebpsFolder = zip.folder('OEBPS')
    const contentOpfDoc = this._createContentOpfDocument(bookInfo)
    const manifest = contentOpfDoc.querySelector('manifest')
    const spine = contentOpfDoc.querySelector('spine')

    // 1. CSS
    this._addManifestItem(manifest, this.DEFAULT_CSS.id, this.DEFAULT_CSS.path, 'text/css')
    oebpsFolder.file(this.DEFAULT_CSS.path, this.DEFAULT_CSS.content)

    // 2. Nav XHTML
    const navXhtmlContent = this._generateNavXhtml(bookInfo.nav_toc)
    const navItem = this._addManifestItem(manifest, this.NAV_XHTML_TEMPLATE.id, this.NAV_XHTML_TEMPLATE.path, 'application/xhtml+xml')
    navItem.setAttribute('properties', 'nav')
    this._addSpineItem(spine, this.NAV_XHTML_TEMPLATE.id, 'no') // linear="no" for nav
    oebpsFolder.file(this.NAV_XHTML_TEMPLATE.path, navXhtmlContent)

    // 3. 分卷内容 XHTML
    bookInfo.Text.forEach((textEntry) => { // {path, content, id, vid, volumeName, navToc}
      this._addManifestItem(manifest, textEntry.id, textEntry.path, 'application/xhtml+xml')
      this._addSpineItem(spine, textEntry.id)
      const finalHtml = this._processAndCleanVolumeHtml(textEntry, bookInfo)
      oebpsFolder.file(textEntry.path, finalHtml)
    })

    // 4. 图片
    let coverImageId = null
    // 优先顺序：用户指定的封面 > 高宽比合适的封面候选 > 缩略图封面候选
    const userCover = bookInfo.ImgLocation.find(loc => loc.isCover) // 假设ImgLocation可以标记封面
    if (userCover) {
      const imgEntry = bookInfo.Images.find(img => img.idName === userCover.imgID)
      if (imgEntry)
        coverImageId = imgEntry.id
    }
    if (!coverImageId) {
      const coverImage = bookInfo.Images.find(img => img.coverImg) || bookInfo.Images.find(img => img.coverImgChk) || bookInfo.Images.find(img => img.smallCover)
      if (coverImage)
        coverImageId = coverImage.id
    }

    bookInfo.Images.forEach((imgEntry) => { // {path, content, id, idName, TextId, ...}
      if (imgEntry.content) { // 确保图片内容已下载
        const item = this._addManifestItem(manifest, imgEntry.id, imgEntry.path, 'image/jpeg') // 假设都是jpeg
        if (imgEntry.id === coverImageId) {
          item.setAttribute('properties', 'cover-image')
        }
        oebpsFolder.file(imgEntry.path, imgEntry.content, { binary: true })
      }
      else {
        bookInfo.logger.logWarn(`图片 ${imgEntry.idName} 内容为空，未打包进ePub。`)
      }
    })

    // 5. 编辑器配置 (如果存在)
    if (bookInfo.ImgLocation && bookInfo.ImgLocation.length > 0) {
      const editorCfg = {
        UID: EPUB_EDITOR_CONFIG_UID,
        aid: bookInfo.aid,
        pathname: CURRENT_URL.pathname,
        ImgLocation: bookInfo.ImgLocation,
      }
      const cfgJson = JSON.stringify(editorCfg, null, '  ')
      oebpsFolder.file('Other/ePubEditorCfg.json', cfgJson)
      this._addManifestItem(manifest, 'editor_cfg_json', 'Other/ePubEditorCfg.json', 'application/json')
      bookInfo.logger.logInfo('编辑器配置已保存到ePub。')
    }

    // 最后填充 metadata 并序列化 content.opf
    this._populateMetadata(contentOpfDoc, bookInfo, coverImageId)
    const serializer = new XMLSerializer()
    let contentOpfString = serializer.serializeToString(contentOpfDoc)

    // 移除 serializer 可能添加的 xmlns="" 属性
    contentOpfString = contentOpfString.replace(/ xmlns=""/g, '')

    // 添加 XML declaration 和 DOCTYPE
    const content_opf_final = `${contentOpfString}`

    oebpsFolder.file('content.opf', content_opf_final)

    // 生成文件名
    let epubFileName = `${bookInfo.title}.${bookInfo.nav_toc[0].volumeName}`
    if (bookInfo.nav_toc.length > 1) {
      epubFileName += `-${bookInfo.nav_toc[bookInfo.nav_toc.length - 1].volumeName}`
    }
    epubFileName = epubFileName.replace(/[\\/:*?"<>|]/g, '_') // 清理文件名

    try {
      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' })
      saveAs(blob, `${epubFileName}.epub`)
      bookInfo.refreshProgress(bookInfo, `<span style="color:green;">ePub生成完成, 文件名：${epubFileName}.epub</span>`)
    }
    catch (err) {
      bookInfo.logger.logError(`ePub压缩或保存失败: ${err.message}`)
      bookInfo.refreshProgress(bookInfo, `<span style="color:red;">ePub生成失败: ${err.message}</span>`)
    }
    finally {
      // 重新启用生成按钮 (如果存在)
      const buildBtn = document.getElementById('EidterBuildBtn')
      if (buildBtn)
        buildBtn.disabled = false
    }

    // 如果是通过编辑器构建且勾选了关闭，则销毁编辑器
    if (bookInfo.ePubEidtDone && EpubEditor.editorRootElement && document.getElementById('ePubEditerClose')?.checked) {
      // 延迟销毁，给用户看一眼结果
      setTimeout(() => EpubEditor.destroy(), 1000)
    }
  },

  /**
   * 创建 content.opf 的 DOM 文档
   * @param {EpubBuilderCoordinator} bookInfo - 协调器实例
   * @returns {Document} OPF DOM 文档
   */
  _createContentOpfDocument(bookInfo) {
    const parser = new DOMParser()
    // Minimal valid OPF structure
    const opfString = `<?xml version="1.0" encoding="utf-8"?>
                <package version="3.0" unique-identifier="BookId" xmlns="http://www.idpf.org/2007/opf">
                    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
                        <dc:language>zh-CN</dc:language>
                        <dc:title>${cleanXmlIllegalChars(bookInfo.title)}.${cleanXmlIllegalChars(bookInfo.nav_toc[0].volumeName)}</dc:title>
                        <dc:identifier id="BookId">urn:uuid:${globalThis.crypto.randomUUID()}</dc:identifier>
                        <dc:creator>${cleanXmlIllegalChars(bookInfo.creator || '未知作者')}</dc:creator>
                        <meta property="dcterms:modified">${`${new Date().toISOString().split('.')[0]}Z`}</meta>
                        ${bookInfo.description ? `<dc:description>${cleanXmlIllegalChars(bookInfo.description)}</dc:description>` : ''}
                    </metadata>
                    <manifest></manifest>
                    <spine></spine>
                </package>`
    const doc = parser.parseFromString(opfString, 'text/xml')
    // 检查解析错误
    const parseError = doc.getElementsByTagName('parsererror')
    if (parseError.length > 0) {
      console.error('解析OPF XML时出错:', parseError[0].textContent)
      bookInfo.logger.logError('内部错误：创建OPF文档失败。')
      throw new Error('Failed to create OPF document due to parser error.')
    }
    return doc
  },

  /**
   * 填充 metadata 元素
   * @param {Element} metadata - metadata DOM 元素
   * @param {EpubBuilderCoordinator} bookInfo - 协调器实例
   * @param {string} coverImageId - 封面图片的 manifest ID
   */
  _populateMetadata(metadata, bookInfo, coverImageId) {
    const _metadata = metadata.querySelector('metadata')
    if (coverImageId) {
      const coverMeta = metadata.createElement('meta')
      coverMeta.setAttribute('name', 'cover')
      coverMeta.setAttribute('content', coverImageId)
      coverMeta.removeAttribute('xmlns') // 移除可能由 serializer 添加的 xmlns=""
      _metadata.appendChild(coverMeta)
    }
  },

  /**
   * 向 manifest 添加 item
   * @param {Element} manifestElement - manifest DOM 元素
   * @param {string} id - item ID
   * @param {string} href - item 路径
   * @param {string} mediaType - item MIME 类型
   * @returns {Element} 创建的 item 元素
   */
  _addManifestItem(manifestElement, id, href, mediaType) {
    const item = manifestElement.ownerDocument.createElement('item')
    item.setAttribute('id', id)
    item.setAttribute('href', href)
    item.setAttribute('media-type', mediaType)
    // item.removeAttribute('xmlns'); // 移除可能由 serializer 添加的 xmlns=""
    manifestElement.appendChild(item)
    return item
  },

  /**
   * 向 spine 添加 itemref
   * @param {Element} spineElement - spine DOM 元素
   * @param {string} idref - 关联的 manifest item ID
   * @param {string} [linear] - 是否线性阅读
   * @returns {Element} 创建的 itemref 元素
   */
  _addSpineItem(spineElement, idref, linear = 'yes') {
    const itemref = spineElement.ownerDocument.createElement('itemref')
    itemref.setAttribute('idref', idref)
    if (linear === 'no') {
      itemref.setAttribute('linear', 'no')
    }
    // itemref.removeAttribute('xmlns'); // 移除可能由 serializer 添加的 xmlns=""
    spineElement.appendChild(itemref)
    return itemref
  },

  /**
   * 生成导航文件 (nav.xhtml) 的内容
   * @param {Array<object>} navTocEntries - 导航目录数据 (bookInfo.nav_toc)
   * @returns {string} nav.xhtml 内容字符串
   */
  _generateNavXhtml(navTocEntries) {
    const parser = new DOMParser()
    // 使用 cleanXmlIllegalChars 清理模板字符串
    const doc = parser.parseFromString(cleanXmlIllegalChars(this.NAV_XHTML_TEMPLATE.content), 'application/xhtml+xml')
    const tocNavElement = doc.getElementById('toc')
    const ol = doc.createElement('ol')

    navTocEntries.forEach((volumeToc) => { // {volumeName, vid, volumeID, volumeHref, chapterArr}
      const vLi = doc.createElement('li')
      const vA = doc.createElement('a')
      vA.href = volumeToc.volumeHref
      vA.textContent = volumeToc.volumeName
      vLi.appendChild(vA)

      if (volumeToc.chapterArr && volumeToc.chapterArr.length > 0) {
        const cOl = doc.createElement('ol')
        volumeToc.chapterArr.forEach((chapterToc) => { // {chapterName, chapterID, chapterHref}
          const cLi = doc.createElement('li')
          const cA = doc.createElement('a')
          cA.href = chapterToc.chapterHref
          cA.textContent = chapterToc.chapterName
          cLi.appendChild(cA)
          cOl.appendChild(cLi)
        })
        vLi.appendChild(cOl)
      }
      ol.appendChild(vLi)
    })
    tocNavElement.appendChild(ol)

    const serializer = new XMLSerializer()
    let xhtmlString = serializer.serializeToString(doc.documentElement)

    // 移除 serializer 可能添加的 xmlns="" 属性
    xhtmlString = xhtmlString.replace(/ xmlns=""/g, '')

    // 添加 XML declaration 和 DOCTYPE
    return `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n${xhtmlString}`
  },

  /**
   * 处理并清理分卷HTML内容，插入图片等
   * @param {object} textEntry - 当前卷的文本数据 {path, content, id, vid, ...}
   * @param {EpubBuilderCoordinator} bookInfo - 协调器实例
   * @returns {string} 处理后的 XHTML 字符串
   */
  _processAndCleanVolumeHtml(textEntry, bookInfo) {
    const parser = new DOMParser()
    // 必须创建完整的HTML文档结构才能正确解析和序列化为XHTML
    // 使用 cleanXmlIllegalChars 清理标题和内容
    const initialHtml = `<?xml version="1.0" encoding="utf-8"?>
                <!DOCTYPE html>
                <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN" xml:lang="zh-CN">
                <head>
                    <meta charset="utf-8"/>
                    <title>${cleanXmlIllegalChars(textEntry.volumeName)}</title>
                    <link href="../Styles/default.css" rel="stylesheet" type="text/css"/>
                </head>
                <body>
                   <div class="volumetitle"><h2>${cleanXmlIllegalChars(textEntry.volumeName)}</h2></div><br />
                   ${textEntry.content}
                </body>
                </html>`

    const doc = parser.parseFromString(cleanXmlIllegalChars(initialHtml), 'text/html')
    const body = doc.body

    // 处理编辑器放置的图片
    const volumeSpecificLocations = bookInfo.ImgLocation.filter(loc => loc.vid === textEntry.vid) // 注意 vid 比较
    const volumeImages = bookInfo.Images.filter(img => img.TextId === textEntry.id || img.smallCover) // 包括通用小封面

    // 移除编辑器用的 .txtDropEnable span，并将内容（通常是章节标题div或文本节点）直接放回原位
    // 同时在其之前插入图片（如果配置了）
    Array.from(body.querySelectorAll('.txtDropEnable')).forEach((span) => {
      const spanId = span.id
      const childNodes = Array.from(span.childNodes) // 复制子节点列表

      // 检查此span是否有对应的图片配置，并插入图片
      volumeSpecificLocations.filter(loc => loc.spanID === spanId).forEach((loc) => {
        const imgEntry = volumeImages.find(img => img.idName === loc.imgID && img.content) // 必须有内容
        if (imgEntry) {
          const divImage = doc.createElement('div')
          divImage.setAttribute('class', 'divimage') // ePub内标准图片容器类
          const imgTag = doc.createElement('img')
          imgTag.setAttribute('src', `../${imgEntry.path}`) // 相对路径
          imgTag.setAttribute('alt', cleanXmlIllegalChars(imgEntry.idName))
          imgTag.setAttribute('loading', 'lazy')
          divImage.appendChild(imgTag)
          span.parentNode.insertBefore(divImage, span) // 在span之前插入图片
        }
        else {
          bookInfo.logger.logWarn(`配置的图片 ${loc.imgID} 在卷 ${textEntry.volumeName} (span: ${loc.spanID}) 未找到或未下载，未插入。`)
        }
      })

      // 将span的子节点移到span之前，然后移除span
      childNodes.forEach((node) => {
        span.parentNode.insertBefore(node, span)
      })
      span.parentNode.removeChild(span)
    })

    // 移除空的p标签和仅包含空白的p标签（常见于转换后）
    Array.from(body.getElementsByTagName('p')).forEach((p) => {
      if (p.innerHTML.trim() === '' || p.innerHTML.trim() === '&nbsp;') {
        p.parentNode.removeChild(p)
      }
    })
    // 确保所有img标签都在一个div.divimage内，以符合样式预期
    Array.from(body.getElementsByTagName('img')).forEach((img) => {
      if (!img.closest('div.divimage')) {
        const wrapper = doc.createElement('div')
        wrapper.className = 'divimage'
        img.parentNode.insertBefore(wrapper, img)
        wrapper.appendChild(img)
      }
    })

    const serializer = new XMLSerializer()
    let xhtmlString = serializer.serializeToString(doc.documentElement)

    // 移除 serializer 可能添加的 xmlns="" 属性
    xhtmlString = xhtmlString.replace(/ xmlns=""/g, '')

    // 返回完整的 XHTML 字符串
    return `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n${xhtmlString}`
  },
}
