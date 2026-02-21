// @ts-nocheck
// ==UserScript==
// @name         轻小说文库下载 (优化版)
// @namespace    wenku8HaoaWRefactored
// @author       HaoaW (Original), raventu (Refactor)
// @match        *://www.wenku8.net/*
// @match        *://www.wenku8.cc/*
// @require      https://cdn.jsdelivr.net/npm/jszip@2.6.1/dist/jszip.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.js
// @icon         https://www.wenku8.net/favicon.ico
// ==/UserScript==

import { SUB_VOLUME_DELAY_DEFAULT_MS, SUB_VOLUME_TIMEOUT_DEFAULT_MS } from './constants'

const SUB_EPUB_CFG_KEY = 'WK8SubEpubBatchCfg'
const SUB_EPUB_CFG_STORAGE_KEY = 'wk8:sub-epub-batch-cfg:v1'

function loadSubEpubBatchConfigFromStorage() {
  try {
    const raw = localStorage.getItem(SUB_EPUB_CFG_STORAGE_KEY)
    if (!raw)
      return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object')
      return null

    const delayMs = Number(parsed.delayMs)
    const timeoutMs = Number(parsed.timeoutMs)

    return {
      delayMs: Number.isFinite(delayMs) && delayMs > 0 ? Math.floor(delayMs) : SUB_VOLUME_DELAY_DEFAULT_MS,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : SUB_VOLUME_TIMEOUT_DEFAULT_MS,
    }
  }
  catch {
    return null
  }
}

function saveSubEpubBatchConfigToStorage(cfg) {
  try {
    localStorage.setItem(SUB_EPUB_CFG_STORAGE_KEY, JSON.stringify({
      delayMs: cfg.delayMs,
      timeoutMs: cfg.timeoutMs,
    }))
  }
  catch {
    // 忽略存储失败（如无痕模式限制）
  }
}

function getSubEpubBatchConfig() {
  const currentCfg = unsafeWindow[SUB_EPUB_CFG_KEY]
  if (!currentCfg || typeof currentCfg !== 'object') {
    const savedCfg = loadSubEpubBatchConfigFromStorage()
    unsafeWindow[SUB_EPUB_CFG_KEY] = {
      delayMs: savedCfg?.delayMs ?? SUB_VOLUME_DELAY_DEFAULT_MS,
      timeoutMs: savedCfg?.timeoutMs ?? SUB_VOLUME_TIMEOUT_DEFAULT_MS,
    }
  }
  return unsafeWindow[SUB_EPUB_CFG_KEY]
}

function createSubEpubBatchConfigControls() {
  const cfg = getSubEpubBatchConfig()
  const wrapper = document.createElement('span')
  wrapper.id = 'wk8SubEpubConfig'
  wrapper.style.display = 'inline-flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.gap = '6px'
  wrapper.style.marginLeft = '8px'
  wrapper.style.fontSize = '12px'

  const delayLabel = document.createElement('span')
  delayLabel.textContent = '间隔(秒)'

  const delayInput = document.createElement('input')
  delayInput.type = 'number'
  delayInput.min = '1'
  delayInput.step = '1'
  delayInput.value = String(Math.max(1, Math.floor((Number(cfg.delayMs) || SUB_VOLUME_DELAY_DEFAULT_MS) / 1000)))
  delayInput.style.width = '56px'

  const timeoutLabel = document.createElement('span')
  timeoutLabel.textContent = '超时(分钟)'

  const timeoutInput = document.createElement('input')
  timeoutInput.type = 'number'
  timeoutInput.min = '1'
  timeoutInput.step = '1'
  timeoutInput.value = String(Math.max(1, Math.floor((Number(cfg.timeoutMs) || SUB_VOLUME_TIMEOUT_DEFAULT_MS) / 60000)))
  timeoutInput.style.width = '64px'

  const applyButton = document.createElement('button')
  applyButton.type = 'button'
  applyButton.textContent = '应用'
  applyButton.style.cursor = 'pointer'

  const applyConfig = () => {
    const delaySeconds = Number(delayInput.value)
    const timeoutMinutes = Number(timeoutInput.value)

    cfg.delayMs = Number.isFinite(delaySeconds) && delaySeconds > 0
      ? Math.floor(delaySeconds * 1000)
      : SUB_VOLUME_DELAY_DEFAULT_MS
    cfg.timeoutMs = Number.isFinite(timeoutMinutes) && timeoutMinutes > 0
      ? Math.floor(timeoutMinutes * 60 * 1000)
      : SUB_VOLUME_TIMEOUT_DEFAULT_MS

    saveSubEpubBatchConfigToStorage(cfg)

    delayInput.value = String(Math.floor(cfg.delayMs / 1000))
    timeoutInput.value = String(Math.floor(cfg.timeoutMs / 60000))

    UILogger.logInfo(`分卷批量配置已更新：间隔 ${delayInput.value}s，单卷超时 ${timeoutInput.value}min。`)
  }

  applyButton.addEventListener('click', applyConfig)
  delayInput.addEventListener('change', applyConfig)
  timeoutInput.addEventListener('change', applyConfig)

  wrapper.appendChild(delayLabel)
  wrapper.appendChild(delayInput)
  wrapper.appendChild(timeoutLabel)
  wrapper.appendChild(timeoutInput)
  wrapper.appendChild(applyButton)

  return wrapper
}

/**
 * 初始化用户脚本功能
 */
function initializeUserScript() {
  // 页面变量检查 (这些变量由wenku8页面自身定义)
  if (typeof unsafeWindow.article_id === 'undefined') {
    console.log('非书籍或目录页面，脚本主要功能不激活。')
    // 但评论区功能仍然可能需要激活
    initializeReviewPageFeatures()
    return
  }

  // 初始化日志区域，即使不下载ePub，其他功能（如App接口阅读）也可能需要
  UILogger.init()

  if (typeof unsafeWindow.chapter_id === 'undefined' || unsafeWindow.chapter_id === null || unsafeWindow.chapter_id === '0') {
    // 可能是目录页 (chapter_id === '0') 或其他未知页面类型但有 article_id
    // 尝试激活目录页功能，如果选择器能找到元素
    if (document.querySelector('#title') && document.querySelectorAll('.vcss').length > 0) {
      addDownloadButtonsToCatalogPage()
    }
    else {
      console.log('页面缺少chapter_id，且不像是标准目录页，脚本核心功能不激活。')
    }
  }
  else { // 内容阅读页面 (chapter_id > 0)
    handleContentPage()
  }

  // 评论区功能也需要初始化
  initializeReviewPageFeatures()
  // 处理从URL读取配置的逻辑 (需要在初始化其他功能之后，因为它可能触发下载)
  loadConfigFromUrlIfPresent()
}

/**
 * 在目录页面添加下载按钮
 */
function addDownloadButtonsToCatalogPage() {
  const titleElement = document.getElementById('title')
  if (!titleElement)
    return

  const bookTitle = titleElement.textContent.trim()
  // 根据页面 targetEncoding 确定下载编码
  const targetCharset = (unsafeWindow.targetEncoding === '1' ? 'big5' : 'utf8') // 假设 targetEncoding "1"是繁体

  // 全本下载链接 (网站自带功能)
  const txtHref = `https://${DOWNLOAD_DOMAIN}/down.php?type=${targetCharset}&id=${unsafeWindow.article_id}&fname=${encodeURIComponent(bookTitle)}`
  const txtTitle = `全本文本下载(${targetCharset})`
  const allTxtLink = createTxtDownloadButton(txtTitle, txtHref)

  titleElement.appendChild(allTxtLink)

  // 全本ePub下载按钮
  const epubAllButton = createDownloadButton(' ePub下载(全本)', false, true)
  const epubAllEditButton = createDownloadButton(' (调整插图)', true, true)
  titleElement.appendChild(epubAllButton)
  titleElement.appendChild(epubAllEditButton)

  // 全本 分卷 ePub下载按钮
  const aEleSubEpub = createTxtDownloadButton(' 分卷ePub下载(全本)', 'javascript:void(0);', true)
  aEleSubEpub.className = 'DownloadAllSub'
  aEleSubEpub.addEventListener('click', e => loopDownloadSub())
  titleElement.append(aEleSubEpub)

  if (!document.getElementById('wk8SubEpubConfig')) {
    titleElement.append(createSubEpubBatchConfigControls())
  }

  // 分卷下载链接和按钮
  document.querySelectorAll('td.vcss').forEach((vcssCell) => { // 修改选择器为 td.vcss
    const volumeName = vcssCell.childNodes[0]?.textContent?.trim()
    const volumeId = vcssCell.getAttribute('vid') // 页面上的卷ID
    if (!volumeName || !volumeId)
      return

    // 分卷文本下载链接 (网站自带功能)
    const txtHref = `https://${DOWNLOAD_DOMAIN}/packtxt.php?aid=${unsafeWindow.article_id}&vid=${volumeId}&aname=${encodeURIComponent(bookTitle)}&vname=${encodeURIComponent(volumeName)}&charset=${targetCharset.replace('utf8', 'utf-8')}`
    const txtTitle = ` 文本下载(${targetCharset.replace('utf8', 'utf-8')})`
    const volTxtLink = createTxtDownloadButton(txtTitle, txtHref)

    vcssCell.appendChild(volTxtLink)

    // 分卷ePub下载按钮
    const epubVolButton = createDownloadButton(' ePub下载(本卷)', false, false)
    const epubVolEditButton = createDownloadButton(' (调整插图)', true, false)
    vcssCell.appendChild(epubVolButton)
    vcssCell.appendChild(epubVolEditButton)
  })
}

/**
 * 创建文本下载按钮
 * @param {string} title - 按钮文本
 * @param {string} href - 按钮链接
 * @returns {HTMLElement} 创建的按钮元素
 */
function createTxtDownloadButton(title, href, otherType = false) {
  const button = document.createElement('a')
  button.href = href
  button.textContent = title
  button.style.marginLeft = '5px'
  button.style.display = 'inline-block' // 使元素可以设置 padding 和 border
  button.style.padding = '5px 10px' // 内边距
  button.style.textDecoration = 'none' // 移除下划线
  button.style.borderRadius = '3px' // 圆角
  button.style.cursor = 'pointer' // 鼠标悬停时显示手型
  button.style.marginLeft = '5px' // 保留原有外边距
  button.style.fontSize = '14px' // 设置一个基础字体大小
  button.style.lineHeight = 'normal' // 确保行高正常

  if (otherType) {
    button.style.borderColor = '#ffe0b2' // 柔和的橙色边框
    button.style.backgroundColor = '#fff8e1' // 非常浅的橙色背景
    button.style.color = '#fb602d' // 柔和的黄色文字
  }
  else {
    button.style.borderColor = '#00bcd4' // 下载全部：青色边框
    button.style.backgroundColor = '#b2ebf2' // 下载全部：浅青色背景
    button.style.color = '#0047a7' // 下载全部：深青色文字
  }

  return button
}

/**
 * 创建下载ePub的按钮
 * @param {string} text - 按钮文本
 * @param {boolean} isEditMode - 是否进入编辑模式
 * @param {boolean} isDownloadAll - 是否下载全部分卷
 * @returns {HTMLElement} 创建的按钮元素
 */
function createDownloadButton(text, isEditMode, isDownloadAll) {
  const button = document.createElement('a')
  button.href = 'javascript:void(0);'
  button.textContent = text

  // 添加模拟按钮的边框
  button.style.display = 'inline-block' // 使元素可以设置 padding 和 border
  button.style.padding = '5px 10px' // 内边距
  button.style.border = '1px solid #ccc' // 边框样式
  button.style.backgroundColor = '#f0f0f0' // 背景色
  button.style.color = '#333' // 文字颜色
  button.style.textDecoration = 'none' // 移除下划线
  button.style.borderRadius = '3px' // 圆角
  button.style.cursor = 'pointer' // 鼠标悬停时显示手型
  button.style.marginLeft = '5px' // 保留原有外边距
  button.style.fontSize = '14px' // 设置一个基础字体大小
  button.style.lineHeight = 'normal' // 确保行高正常

  // 根据 different parameters 区分样式
  if (isEditMode) {
    button.style.borderColor = '#ff9800' // 例如，编辑模式使用橙色边框
    button.style.backgroundColor = '#fff3e0' // 浅橙色背景
    button.style.color = '#e65100' // 深橙色文字
    button.className = '' // 清空原有 class
    button.classList.add('EditMode') // 添加 EditMode class
  }
  else if (isDownloadAll) { // 假设 isEditMode 和 isDownloadAll 样式不同
    button.style.borderColor = '#4caf50' // 例如，下载全部使用绿色边框
    button.style.backgroundColor = '#e8f5e9' // 浅绿色背景
    button.style.color = '#1b5e20' // 深绿色文字
    button.className = '' // 清空原有 class
    button.classList.add('DownloadAll') // 添加 DownloadAll class
  }
  else {
    // 默认样式，如果前面条件都不满足，保留初始设置的边框样式
    button.className = 'ePubSub' // 保留原有 class
  }

  button.addEventListener('click', (event) => {
    const targetEl = event.currentTarget as HTMLElement
    // 禁用按钮，避免重复点击，并改变样式
    targetEl.style.pointerEvents = 'none'
    targetEl.style.opacity = '0.6' // 降低不透明度表示禁用
    targetEl.style.color = '#aaa' // 禁用时文字颜色变浅
    // 可以选择改变边框和背景色
    // event.target.style.borderColor = '#ddd';
    // event.target.style.backgroundColor = '#eee';

    const coordinator = new EpubBuilderCoordinator(isEditMode, isDownloadAll)
    coordinator.start(targetEl) // 传递事件目标，用于单卷下载时定位

    // 按钮在协调器完成或失败后重新启用 (由 EpubFileBuilder.build 处理)
    // 注意：这里的代码块只负责禁用按钮的样式，实际的 re-enabling 逻辑需要在 EpubBuilderCoordinator 或其调用的方法中实现
  })

  return button
}
/**
 * 循环下载分卷ePub (全本)
 *
 * 此函数会检查每个分卷的构建状态，并在不处于构建状态时点击下载链接。
 * 如果处于构建状态，则会等待一段时间后再次检查。
 * 如果等待时间超过设定的超时时间，则跳过当前元素。
 *
 * @returns {void}
 */
function loopDownloadSub() {
  const elements = document.querySelectorAll('a.ePubSub')
  const linksArray = Array.from(elements)
  const cfg = getSubEpubBatchConfig()
  const delayBetweenVolumesMs = Math.max(1000, Number(cfg.delayMs) || SUB_VOLUME_DELAY_DEFAULT_MS)
  const singleVolumeTimeoutMs = Math.max(60 * 1000, Number(cfg.timeoutMs) || SUB_VOLUME_TIMEOUT_DEFAULT_MS)
  const DOWNLOAD_FINISHED_EVENT = 'wk8:epub-download-finished'

  UILogger.logInfo(`循环下载分卷ePub(全本)...（间隔 ${Math.floor(delayBetweenVolumesMs / 1000)}s，超时 ${Math.floor(singleVolumeTimeoutMs / 60000)}min）`)

  if (linksArray.length === 0) {
    UILogger.logWarn('未找到可下载的分卷按钮。')
    return
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const waitForVolumeFinished = (triggerElement, timeoutMs) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener(DOWNLOAD_FINISHED_EVENT, onFinished)
        reject(new Error(`等待分卷完成超时(${Math.floor(timeoutMs / 1000)}s)`))
      }, timeoutMs)

      const onFinished = (event) => {
        const detail = event?.detail
        if (!detail || detail.triggerElement !== triggerElement)
          return

        clearTimeout(timeoutId)
        window.removeEventListener(DOWNLOAD_FINISHED_EVENT, onFinished)
        resolve(detail)
      }

      window.addEventListener(DOWNLOAD_FINISHED_EVENT, onFinished)
    })
  }

  const runSequential = async () => {
    for (let index = 0; index < linksArray.length; index++) {
      const currentLink = linksArray[index]
      UILogger.logInfo(`开始处理第 ${index + 1}/${linksArray.length} 个分卷。`)

      currentLink.click()

      try {
        await waitForVolumeFinished(currentLink, singleVolumeTimeoutMs)
      }
      catch (error) {
        UILogger.logError(`第 ${index + 1} 个分卷处理失败或超时：${error?.message || error}`)
      }

      if (index < linksArray.length - 1) {
        UILogger.logInfo(`为避免请求过密，等待 ${Math.floor(delayBetweenVolumesMs / 1000)} 秒后继续下一个分卷...`)
        await sleep(delayBetweenVolumesMs)
      }
    }

    UILogger.logInfo('所有分卷下载任务处理完毕。')
  }

  runSequential().catch((error) => {
    UILogger.logError(`分卷循环下载中断：${error?.message || error}`)
  })
}

/**
 * 处理内容阅读页面 (版权限制等)
 */
function handleContentPage() {
  const contentMain = document.getElementById('contentmain')
  const contentDiv = document.getElementById('content') // 通常是 #content

  if (!contentMain || !contentDiv)
    return

  // 检查是否为版权限制页面 (旧逻辑：首子元素为'null'的span)
  // 更稳健的检查可能是看内容是否为空或包含特定的版权提示文本
  const isCopyrightRestricted = contentMain.firstElementChild
    && contentMain.firstElementChild.tagName === 'SPAN'
    && contentMain.firstElementChild.textContent.trim().toLowerCase() === 'null'

  if (isCopyrightRestricted && typeof unsafeWindow.chapter_id !== 'undefined' && unsafeWindow.chapter_id !== null && unsafeWindow.chapter_id !== '0') {
    UILogger.logInfo('检测到版权限制页面，尝试通过App接口加载内容...')
    const bookInfoForReading = {
      aid: unsafeWindow.article_id,
      targetEncoding: unsafeWindow.targetEncoding, // 传递页面当前目标编码
      logger: UILogger, // 传递日志记录器
      refreshProgress: (info, msg) => UILogger.updateProgress(info, msg), // 适配旧的refreshProgress
    }
    // 调用AppApiService的方法加载当前章节内容
    AppApiService.fetchChapterForReading(bookInfoForReading, unsafeWindow.chapter_id, contentDiv, unsafeWindow.translateBody)
  }
}

/**
 * 初始化书评区功能 (加载配置链接)
 */
function initializeReviewPageFeatures() {
  // 仅在书评相关页面激活
  if (!CURRENT_URL.pathname.includes('/modules/article/'))
    return

  // 查找所有代码块
  document.querySelectorAll('.jieqiCode').forEach((codeElement) => {
    // 查找代码块所属的书评的锚点 (yid)
    const yidAnchor = codeElement.closest('table')?.querySelector('a[name^="y"]')
    const yid = yidAnchor?.getAttribute('name')

    // 查找书评的rid (从URL获取)
    const reviewId = CURRENT_URL.searchParams.get('rid')
    const pageNum = CURRENT_URL.searchParams.get('page') || '1'

    if (reviewId && yid) { // 必须同时有 reviewId 和 yid
      try {
        const configText = codeElement.textContent // 获取原始文本进行解析
        // 尝试宽松解析，移除空白和可能的BOM
        const parsedConfig = JSON.parse(configText.replace(/\s/g, '').replace(/^\uFEFF/, ''))

        // 检查配置是否符合预期格式
        if (parsedConfig && parsedConfig.UID === EPUB_EDITOR_CONFIG_UID && parsedConfig.aid && parsedConfig.pathname
          && (parsedConfig.ImgLocationBase64 || (Array.isArray(parsedConfig.ImgLocation) && parsedConfig.ImgLocation.length > 0))) {
          // 定位到书评标题所在的div
          const titleDiv = yidAnchor.closest('tr')?.querySelector('td > div')
          if (titleDiv) {
            const useConfigLink = document.createElement('a')
            useConfigLink.textContent = '[使用此插图配置生成ePub]'
            useConfigLink.style.color = 'fuchsia'
            useConfigLink.style.marginRight = '10px'
            // 构建带参数的URL，指向书籍目录页，并带上配置引用信息
            useConfigLink.href = `${CURRENT_URL.origin}${parsedConfig.pathname}?rid=${reviewId}&page=${pageNum}&yid=${yid}&CfgRef=1#title` // 添加锚点跳转到标题
            titleDiv.insertBefore(useConfigLink, titleDiv.firstChild)
          }
        }
      }
      catch (e) {
        // JSON解析失败或配置不符合预期，静默处理或打印日志
        // console.warn("解析书评区代码块配置失败:", e, codeElement. textContent);
      }
    }
  })
}

// 全局变量 ImgLocationCfgRef 用于存储从URL加载的配置，供 EpubBuilderCoordinator 读取
unsafeWindow.ImgLocationCfgRef = unsafeWindow.ImgLocationCfgRef || []

/**
 * 检查URL中是否有配置引用参数，并尝试加载配置
 */
async function loadConfigFromUrlIfPresent() {
  const urlParams = CURRENT_URL.searchParams
  if (urlParams.get('CfgRef') !== '1')
    return

  const rid = urlParams.get('rid')
  const page = urlParams.get('page')
  const yidToLoad = urlParams.get('yid')

  if (!rid || !yidToLoad)
    return

  const reviewPageUrl = `${CURRENT_URL.origin}/modules/article/reviewshow.php?rid=${rid}&page=${page || 1}`
  UILogger.init() // 确保日志初始化
  UILogger.logInfo(`尝试从书评页加载插图配置...`)

  try {
    const response = await gmXmlHttpRequestAsync({ method: 'GET', url: reviewPageUrl, timeout: XHR_TIMEOUT_MS })
    if (response.status === 200) {
      const parser = new DOMParser()
      // 清理非法XML字符，并解析为HTML文档
      const doc = parser.parseFromString(cleanXmlIllegalChars(response.responseText), 'text/html')
      // 查找对应的书评锚点和代码块
      const targetAnchor = doc.querySelector(`a[name="${yidToLoad}"]`)
      const codeElement = targetAnchor?.closest('table')?.querySelector('.jieqiCode')

      if (codeElement) {
        const configText = codeElement.textContent
        const parsedConfig = JSON.parse(configText.replace(/\s/g, '').replace(/^\uFEFF/, '')) // 移除空白和BOM

        // 如果配置是Base64压缩的，则解压
        if (parsedConfig.ImgLocationBase64) {
          try {
            const zip = new JSZip()
            if (typeof zip.loadAsync === 'function') {
              await zip.loadAsync(parsedConfig.ImgLocationBase64, { base64: true })
            }
            else {
              await zip.load(parsedConfig.ImgLocationBase64, { base64: true })
            }
            const imgLocFile = zip.file(IMG_LOCATION_FILENAME)
            if (imgLocFile) {
              const imgLocJson = await imgLocFile.async('string')
              parsedConfig.ImgLocation = JSON.parse(imgLocJson)
              delete parsedConfig.ImgLocationBase64 // 清理Base64字段
            }
            else {
              throw new Error(`压缩包中未找到 ${IMG_LOCATION_FILENAME} 文件。`)
            }
          }
          catch (zipErr) {
            throw new Error(`解压或解析配置压缩包失败: ${zipErr.message}`)
          }
        }

        // 最终校验解析出的配置
        if (parsedConfig && parsedConfig.UID === EPUB_EDITOR_CONFIG_UID && parsedConfig.aid
          && Array.isArray(parsedConfig.ImgLocation) && parsedConfig.ImgLocation.length > 0) {
          // 将加载到的配置添加到 unsafeWindow.ImgLocationCfgRef 中，供 EpubBuilderCoordinator 读取
          unsafeWindow.ImgLocationCfgRef.push(parsedConfig)
          UILogger.logInfo(`成功加载来自书评的 ${parsedConfig.ImgLocation.length} 条插图位置配置。现在可以点击下载按钮了。`)
          // 提示用户可以操作了
          const titleElem = document.getElementById('title')
          if (titleElem) {
            const notice = document.createElement('p')
            notice.style.color = 'green'
            notice.textContent = `提示：来自书评的插图配置已加载，请点击相应的“ePub下载(调整插图)”按钮开始。`
            titleElem.parentNode.insertBefore(notice, titleElem.nextSibling)
          }
        }
        else {
          UILogger.logError(`书评中的配置无效或不完整。`)
        }
      }
      else {
        UILogger.logError(`在书评页未能找到对应的配置代码块。`)
      }
    }
    else {
      UILogger.logError(`下载书评配置失败，状态码: ${response.status}`)
    }
  }
  catch (error) {
    UILogger.logError(`加载或解析书评配置时出错: ${error.message}`)
    console.error('加载书评配置错误:', error)
  }
}

// --- 脚本启动 ---
// DOMContentLoaded确保页面基本结构加载完毕，但某些动态内容可能还未就绪
// 对于油猴脚本，通常直接执行即可，因为@match保证了执行时机
// 使用 readystatechange 兼容性更好
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUserScript)
}
else {
  initializeUserScript()
}
