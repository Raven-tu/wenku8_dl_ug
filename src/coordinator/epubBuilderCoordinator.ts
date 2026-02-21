import type { BookInfoLike, ImageEntry, ImgLocationItem, NavTocEntry, TextEntry, XhrManagerLike, XhrTask } from '../types'

export class EpubBuilderCoordinator {
  aid: string
  title: string
  creator: string
  description: string
  bookUrl: string
  targetEncoding: string
  nav_toc: NavTocEntry[]
  Text: TextEntry[]
  Images: ImageEntry[]
  ImgLocation: ImgLocationItem[]
  ePubEidt: boolean
  ePubEidtDone: boolean
  descriptionXhrInitiated: boolean
  thumbnailImageAdded: boolean
  isDownloadAll: boolean
  XHRManager: XhrManagerLike
  logger: typeof UILogger
  totalTasksAdded: number
  tasksCompletedOrSkipped: number
  XHRFail: boolean
  VOLUME_ID_PREFIX: string
  triggerElement: HTMLElement | null
  _finalized: boolean

  /**
   * @param {boolean} isEditingMode - 是否进入编辑模式
   * @param {boolean} downloadAllVolumes - 是否下载全部分卷
   */
  constructor(isEditingMode = false, downloadAllVolumes = false) {
    // 从页面全局变量获取书籍信息
    this.aid = unsafeWindow.article_id // 书籍ID
    this.title = document.getElementById('title')?.childNodes[0]?.textContent?.trim() || '未知标题'
    this.creator = document.getElementById('info')?.textContent?.trim() || '未知作者'
    this.description = '' // 将由 VolumeLoader.loadBookDescription 填充
    this.bookUrl = CURRENT_URL.href
    this.targetEncoding = unsafeWindow.targetEncoding ?? '' // 页面原始目标编码 "1"繁体 "2"简体

    // 数据存储
    this.nav_toc = [] // 导航菜单 {volumeName, vid, volumeID, volumeHref, chapterArr}
    this.Text = [] // 分卷文本内容 {path, content, id, vid, volumeName, navToc}
    this.Images = [] // 图片资源 {path, content, id, idName, TextId, coverImgChk?, smallCover?}
    this.ImgLocation = []// 编辑器用的图片位置信息 {vid, spanID, imgID}
    // ImgLocationCfgRef 是从评论区加载的配置，存储在 unsafeWindow 中，在初始化时读取

    // 状态标志
    this.ePubEidt = isEditingMode // 是否进入编辑模式
    this.ePubEidtDone = false // 编辑器是否完成编辑
    this.descriptionXhrInitiated = false // 标记简介是否已开始下载，避免重复
    this.thumbnailImageAdded = false // 标记是否已尝试添加缩略图封面
    this.isDownloadAll = downloadAllVolumes

    // 依赖模块实例
    this.XHRManager = Object.create(XHRDownloadManager) // 使用 Object.create 避免直接修改原型
    this.XHRManager.init(this) // 初始化并关联到当前协调器实例
    this.logger = UILogger // UILogger 是单例模式，直接引用

    // 任务计数 (用于进度显示和判断完成)
    this.totalTasksAdded = 0
    this.tasksCompletedOrSkipped = 0
    this.XHRFail = false // 是否有关键XHR失败 (由XHRManager同步)

    // 常量引用
    this.VOLUME_ID_PREFIX = VOLUME_ID_PREFIX
    this.triggerElement = null
    this._finalized = false
  }

  /**
   * 启动下载和构建流程
   * @param {HTMLElement} eventTarget - 触发下载的DOM元素 (用于单卷下载时定位)
   */
  start(eventTarget: HTMLElement) {
    this.triggerElement = eventTarget || null
    unsafeWindow._isUnderConstruction = true
    this.logger.clearLog() // 开始时清空日志
    this.refreshProgress(this, '开始处理书籍...')

    // 1. 加载从评论区读取的图片位置配置 (如果之前已加载)
    this._loadExternalImageConfigs()

    // 2. 确定要下载的卷
    const rawVolumeElements = this.isDownloadAll
      ? Array.from(document.querySelectorAll('.vcss'))
      : [eventTarget.closest('td.vcss')] // 假设按钮在td.vcss内部或就是它

    const volumeElements = rawVolumeElements.filter((element): element is Element => Boolean(element))

    if (rawVolumeElements.some(el => !el)) {
      this.logger.logError('未能确定下载目标分卷，请检查页面结构。')
      // 重新启用生成按钮 (如果存在)
      const buildBtn = document.getElementById('EidterBuildBtn') as HTMLButtonElement | null
      if (buildBtn)
        buildBtn.disabled = false
      this.finalizeRun(false)
      return
    }

    // 3. 为每个选定的卷创建下载任务
    volumeElements.forEach((vcss, index) => {
      const volumeName = vcss.childNodes[0]?.textContent?.trim()
      const volumePageId = vcss.getAttribute('vid') // 页面上的卷ID，可能用于pack.php
      // 查找第一个章节链接，获取其href，用于构建pack.php URL
      const firstChapterLink = vcss.parentElement?.nextElementSibling?.querySelector('a[href*=".htm"]')
      const firstChapterHref = firstChapterLink?.getAttribute('href')
      const firstChapterId = firstChapterHref ? firstChapterHref.split('.')[0] : null // 用于pack.php的vid

      if (!volumeName || !volumePageId || !firstChapterId) {
        this.logger.logWarn(`分卷 ${index + 1} 信息不完整 (名称: ${volumeName}, 页面ID: ${volumePageId}, 首章ID: ${firstChapterId})，跳过此卷。`)
        return
      }

      const volumeDomId = `${this.VOLUME_ID_PREFIX}_${index}`
      const volumeHref = `${volumeDomId}.xhtml`

      const navTocEntry = {
        volumeName,
        vid: volumePageId, // 实际的卷标识，用于ImgLocation等
        volumeID: volumeDomId,
        volumeHref,
        chapterArr: [], // 章节列表稍后填充
      }
      this.nav_toc.push(navTocEntry)

      const textEntry = {
        path: `Text/${volumeHref}`,
        content: '', // 稍后填充
        id: volumeDomId,
        vid: volumePageId, // 关联到实际卷标识
        volumeName,
        navToc: navTocEntry, // 引用，方便处理
      }
      this.Text.push(textEntry)

      // pack.php 的 vid 参数是第一个章节的 ID，而不是卷的 vid
      const downloadUrl = `https://${DOWNLOAD_DOMAIN}/pack.php?aid=${this.aid}&vid=${firstChapterId}`
      this.XHRManager.add({
        type: 'webVolume', // 自定义类型
        url: downloadUrl,
        loadFun: async (xhr: XhrTask) => VolumeLoader.loadWebVolumeText(xhr), // 使用VolumeLoader的方法
        VolumeIndex: index, // 用于在回调中定位nav_toc和Text中的条目
        data: { vid: volumePageId, vcssText: volumeName, Text: textEntry }, // 传递给处理函数的信息
        bookInfo: this, // 传递EpubBuilderCoordinator实例
        isCritical: true, // 卷内容是关键任务
      })
    })

    if (this.Text.length === 0) {
      this.refreshProgress(this, '没有有效的分卷被添加到下载队列。')
      // 重新启用生成按钮 (如果存在)
      const buildBtn = document.getElementById('EidterBuildBtn') as HTMLButtonElement | null
      if (buildBtn)
        buildBtn.disabled = false
      this.finalizeRun(false)
      return
    }

    // 4. 尝试构建 (如果所有任务一开始就完成了，例如无下载内容)
    this.tryBuildEpub()
  }

  /**
   * 通知协调器一个任务已完成 (由 XHRManager 调用)
   */
  handleTaskCompletion() {
    // XHRManager.taskFinished 会更新 tasksCompletedOrSkipped 并调用 tryBuildEpub
    // 这个方法可能不再需要，或者仅用于调试
    // this.tasksCompletedOrSkipped++;
    // this.tryBuildEpub();
    new Promise<void>((resolve) => {
      // 延迟 1 秒，便于观察进度
      setTimeout(() => {
        resolve()
      }, 1000)
    })
      .then(() => {
        unsafeWindow._isUnderConstruction = false // 结束时清除标志
      })
  }

  /**
   * 尝试触发ePub构建流程
   * 只有当所有下载任务完成且没有关键失败时才会真正构建
   */
  tryBuildEpub() {
    // EpubFileBuilder.build 内部会检查 XHRManager 的状态
    EpubFileBuilder.build(this)
      .then((result: unknown) => {
        // 构建遇到问题或没有准备好则跳过
        if (result && !this.XHRFail) {
          this.refreshProgress(this, 'ePub文件已成功生成。')
          this.logger.logInfo('ePub文件已成功生成。', result)
          // 重新启用生成按钮 (如果存在)
          const buildBtn = document.getElementById('EidterBuildBtn') as HTMLButtonElement | null
          if (buildBtn)
            buildBtn.disabled = false
          this.finalizeRun(true)
          return
        }

        // 仅当进入终态时再结束流程：关键失败，或任务全部完成但未构建成功
        const allDone = this.XHRManager.areAllTasksDone()
        if (this.XHRManager.hasCriticalFailure || (allDone && !this.ePubEidt)) {
          this.finalizeRun(false)
        }
      })
      .catch((error: unknown) => {
        this.logger.logError(`构建流程异常: ${error instanceof Error ? error.message : String(error)}`)
        this.finalizeRun(false)
      })
  }

  finalizeRun(success: boolean) {
    if (this._finalized)
      return

    this._finalized = true
    unsafeWindow._isUnderConstruction = false
    window.dispatchEvent(new CustomEvent('wk8:epub-download-finished', {
      detail: {
        success,
        triggerElement: this.triggerElement,
        aid: this.aid,
        isDownloadAll: this.isDownloadAll,
      },
    }))
  }

  /**
   * 更新进度显示和日志 (适配旧的调用方式)
   * @param {EpubBuilderCoordinator} instance - 协调器实例 (通常是 this)
   * @param {string} [message] - 日志消息
   */
  refreshProgress(instance: BookInfoLike, message?: string) {
    this.logger.updateProgress(instance, message)
  }

  /**
   * 从 unsafeWindow.ImgLocationCfgRef 加载外部图片配置
   */
  _loadExternalImageConfigs() {
    // ImgLocationCfgRef 是脚本顶层加载的变量 (由 loadConfigFromUrlIfPresent 填充)
    if (Array.isArray(unsafeWindow.ImgLocationCfgRef) && unsafeWindow.ImgLocationCfgRef.length > 0) {
      let loadedCount = 0
      unsafeWindow.ImgLocationCfgRef.forEach((cfg) => {
        if (cfg.UID === EPUB_EDITOR_CONFIG_UID
          && cfg.aid === this.aid // 比较时注意类型
          && Array.isArray(cfg.ImgLocation) && cfg.ImgLocation.length > 0) {
          cfg.ImgLocation.forEach((loc: ImgLocationItem) => {
            // 简单校验，确保vid, spanID, imgID都存在
            if (loc.vid && loc.spanID && loc.imgID) {
              // 避免重复添加
              if (!this.ImgLocation.some((existing: ImgLocationItem) =>
                existing.vid === loc.vid && existing.spanID === loc.spanID && existing.imgID === loc.imgID,
              )) {
                this.ImgLocation.push({
                  vid: String(loc.vid), // 确保类型一致
                  spanID: String(loc.spanID),
                  imgID: String(loc.imgID),
                })
                loadedCount++
              }
            }
          })
        }
      })
      if (loadedCount > 0) {
        this.refreshProgress(this, `已加载 ${loadedCount} 条来自书评的插图位置配置。`)
      }
      // 清空 unsafeWindow 中的引用，避免影响后续操作
      unsafeWindow.ImgLocationCfgRef = []
    }
  }
}
