import type { BookInfoLike, ImageEntry, TextEntry } from '../types'

interface ProgressElements {
  text: HTMLSpanElement
  image: HTMLSpanElement
  error: HTMLDivElement
  main: HTMLDivElement
  controls: HTMLDivElement
}

export const UILogger = {
  _progressElements: null as ProgressElements | null, // DOM elements for progress display
  _showButton: null as HTMLButtonElement | null, // Button to show the progress bar after closing
  _bookInfoInstance: null as BookInfoLike | null,

  init() {
    if (this._progressElements)
      return // Prevent re-initialization

    this._progressElements = {
      text: document.createElement('span'),
      image: document.createElement('span'), // Not directly used in main display but useful to hold counts
      error: document.createElement('div'), // Use a div to hold log entries
      main: document.createElement('div'), // Main container div
      controls: document.createElement('div'), // Container for control buttons
    }

    // Initialize the main progress container
    this._progressElements.main.id = 'epubDownloaderProgress'
    this._progressElements.main.style.cssText = 'position: fixed; bottom: 0; left: 0; width: 100%; background-color: #f0f0f0; border-top: 1px solid #ccc; padding: 5px; z-index: 9999; font-size: 12px; color: #333; font-family: sans-serif;'
    this._progressElements.error.style.cssText = 'max-height: 100px; overflow-y: auto; margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 5px;'

    // Initialize the control buttons container
    this._progressElements.controls.style.cssText = 'position: absolute;right: 15px;top: 5px;display: flex;justify-content: flex-end;gap: 5px;margin-bottom: 5px;'

    const closeButton = document.createElement('button')
    closeButton.textContent = '-'
    closeButton.id = 'closeProgress'
    this._progressElements.controls.appendChild(closeButton)

    this._showButton = document.createElement('button')
    this._showButton.textContent = '+'
    this._showButton.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 9999; display: none;'
    this._showButton.id = 'showProgressButton'

    // Append controls to the main container
    this._progressElements.main.appendChild(this._progressElements.controls)

    // Find a good place to insert the progress bar, perhaps after the title
    const titleElement = document.getElementById('title')
    if (titleElement && titleElement.parentElement) {
      titleElement.parentElement.insertBefore(this._progressElements.main, titleElement.nextSibling)
    }
    else {
      document.body.appendChild(this._progressElements.main) // Fallback
      console.warn('[UILogger] Could not find #title element for progress bar insertion.')
    }

    // Append the "Show Progress" button to the body
    document.body.appendChild(this._showButton)

    // Set up event listeners
    closeButton.addEventListener('click', () => this.closeProgress())
    this._showButton.addEventListener('click', () => this.showProgress())

    this.clearLog() // Initial state
    this.updateProgress(this.getMinimalBookInfo(), 'ePub下载器就绪...') // Initial status
  },

  _ensureInitialized() {
    if (!this._progressElements || !document.getElementById('epubDownloaderProgress')) {
      this.init()
    }
  },

  closeProgress() {
    if (!this._progressElements || !this._showButton)
      return
    this._progressElements.main.style.display = 'none'
    this._showButton.style.display = 'block'
  },

  showProgress() {
    if (!this._progressElements || !this._showButton)
      return
    this._progressElements.main.style.display = 'block'
    this._showButton.style.display = 'none'
  },

  // updateProgress needs access to the bookInfo instance for counts
  updateProgress(bookInfoInstance: BookInfoLike, message?: string) {
    this._ensureInitialized()
    if (!this._progressElements)
      return

    // Add new message as a log entry
    if (message) {
      const time = new Date().toLocaleTimeString()
      const logEntry = document.createElement('div')
      logEntry.className = 'epub-log-entry'
      logEntry.innerHTML = `[${time}] ${message}` // Allow HTML in message
      this._progressElements.error.insertBefore(logEntry, this._progressElements.error.firstChild) // Newest on top
      // Limit number of log entries
      while (this._progressElements.error.children.length > 300 && this._progressElements.error.lastChild) {
        this._progressElements.error.removeChild(this._progressElements.error.lastChild)
      }
    }

    // Get counts from the bookInfo instance
    const textDownloaded = bookInfoInstance.Text.filter(t => t.content).length
    const totalTexts = bookInfoInstance.Text.length
    const imagesDownloaded = bookInfoInstance.Images.filter(img => img.content).length
    const totalImages = bookInfoInstance.Images.length // Total images found so far

    const totalTasks = bookInfoInstance.totalTasksAdded
    const completedTasks = bookInfoInstance.tasksCompletedOrSkipped

    // Update main display content
    const progressHtml = `
            ePub生成进度:
            文本 ${textDownloaded}/${totalTexts}；
            图片 ${imagesDownloaded}/${totalImages}；
            任务 ${completedTasks}/${totalTasks}；
            <br>最新日志:
        ` // Combine status fields

    this._progressElements.main.innerHTML = progressHtml
    this._progressElements.main.appendChild(this._progressElements.controls) // Re-append controls

    if (this._progressElements.error.firstChild) {
      const latestLogClone = this._progressElements.error.firstChild.cloneNode(true) as HTMLElement
      latestLogClone.style.display = 'inline' // Display inline with the text
      latestLogClone.style.fontWeight = 'bold' // Make it stand out
      this._progressElements.main.appendChild(latestLogClone)
    }
    else {
      this._progressElements.main.appendChild(document.createTextNode('无'))
    }
    if (!this._progressElements.main.contains(this._progressElements.error)) {
      this._progressElements.main.appendChild(this._progressElements.error)
    }
  },

  logError(message: string) {
    this._ensureInitialized()
    console.error(`[UILogger] ${message}`) // Also log to console
    this.updateProgress(this.getMinimalBookInfo(), `<span style="color:red;">错误: ${message}</span>`)
  },

  logWarn(message: string) {
    this._ensureInitialized()
    console.warn(`[UILogger] ${message}`)
    this.updateProgress(this.getMinimalBookInfo(), `<span style="color:orange;">警告: ${message}</span>`)
  },

  logInfo(message: string, ...extra: unknown[]) {
    this._ensureInitialized()
    console.log(`[UILogger] ${message}`, ...extra)
    this.updateProgress(this.getMinimalBookInfo(), `<span style="color:green;">${message}</span>`) // Use green for general info
  },

  clearLog() {
    this._ensureInitialized()
    if (!this._progressElements)
      return
    this._progressElements.error.innerHTML = '' // Clear error/log area
    // Reset counts in the main display
    this._progressElements.main.innerHTML = 'ePub生成进度: 文本 0/0；图片 0/0；任务 0/0；<br>最新日志: 无'
    this._progressElements.main.appendChild(this._progressElements.controls) // Re-append controls
    if (!this._progressElements.main.contains(this._progressElements.error)) {
      this._progressElements.main.appendChild(this._progressElements.error)
    }
  },

  getMinimalBookInfo(): BookInfoLike {
    return this._bookInfoInstance || {
      aid: '',
      title: '',
      creator: '',
      description: '',
      targetEncoding: '',
      nav_toc: [],
      Text: [] as TextEntry[],
      Images: [] as ImageEntry[],
      ImgLocation: [],
      logger: this,
      XHRManager: {
        init: () => {},
        hasCriticalFailure: false,
        taskFinished: () => {},
        retryTask: () => {},
        add: () => {},
        areAllTasksDone: () => true,
      },
      totalTasksAdded: 0,
      tasksCompletedOrSkipped: 0,
      XHRFail: false,
      refreshProgress: () => {},
      tryBuildEpub: () => {},
    }
  },
}
