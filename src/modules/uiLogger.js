export const UILogger = {
  _progressElements: null, // DOM elements for progress display

  init() {
    if (this._progressElements)
      return // Prevent re-initialization

    this._progressElements = {
      text: document.createElement('span'),
      image: document.createElement('span'), // Not directly used in main display but useful to hold counts
      error: document.createElement('div'), // Use a div to hold log entries
      main: document.createElement('div'), // Main container div
    }
    this._progressElements.main.id = 'epubDownloaderProgress'
    this._progressElements.main.style.cssText = 'position: fixed; bottom: 0; left: 0; width: 100%; background-color: #f0f0f0; border-top: 1px solid #ccc; padding: 5px; z-index: 9999; font-size: 12px; color: #333; font-family: sans-serif;'
    this._progressElements.error.style.cssText = 'max-height: 100px; overflow-y: auto; margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 5px;'

    // Find a good place to insert the progress bar, perhaps after the title
    const titleElement = document.getElementById('title')
    if (titleElement && titleElement.parentElement) {
      titleElement.parentElement.insertBefore(this._progressElements.main, titleElement.nextSibling)
    }
    else {
      document.body.appendChild(this._progressElements.main) // Fallback
      console.warn('[UILogger] Could not find #title element for progress bar insertion.')
    }

    this.clearLog() // Initial state
    this.updateProgress({ Text: [], Images: [], totalTasksAdded: 0, tasksCompletedOrSkipped: 0 }, 'ePub下载器就绪...') // Initial status
  },

  _ensureInitialized() {
    if (!this._progressElements || !document.getElementById('epubDownloaderProgress')) {
      this.init()
    }
  },

  // updateProgress needs access to the bookInfo instance for counts
  updateProgress(bookInfoInstance, message) {
    this._ensureInitialized()

    // Add new message as a log entry
    if (message) {
      const time = new Date().toLocaleTimeString()
      const logEntry = document.createElement('div')
      logEntry.className = 'epub-log-entry'
      logEntry.innerHTML = `[${time}] ${message}` // Allow HTML in message
      this._progressElements.error.insertBefore(logEntry, this._progressElements.error.firstChild) // Newest on top
      // Limit number of log entries
      while (this._progressElements.error.children.length > 50) {
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

    // Update the main div, but keep the log area separate
    this._progressElements.main.innerHTML = progressHtml
    // Append the first log entry (newest) or a placeholder
    if (this._progressElements.error.firstChild) {
      // Clone and append the newest log entry for the "Latest Log" line
      const latestLogClone = this._progressElements.error.firstChild.cloneNode(true)
      latestLogClone.style.display = 'inline' // Display inline with the text
      latestLogClone.style.fontWeight = 'bold' // Make it stand out
      this._progressElements.main.appendChild(latestLogClone)
    }
    else {
      this._progressElements.main.appendChild(document.createTextNode('无'))
    }
    // Append the separate scrollable log area below
    // Check if it's already a child to avoid adding multiple times
    if (!this._progressElements.main.contains(this._progressElements.error)) {
      this._progressElements.main.appendChild(this._progressElements.error)
    }

    // Optional: Scroll log area to top to see newest messages
    // this._progressElements.error.scrollTop = 0; // This scrolls to top, maybe not desired
  },

  logError(message) {
    this._ensureInitialized()
    console.error(`[UILogger] ${message}`) // Also log to console
    // Need a dummy bookInfo or pass counts as arguments if bookInfo isn't always available
    // For simplicity now, pass a minimal object, but bookInfoInstance is expected by updateProgress
    this.updateProgress(this.getMinimalBookInfo(), `<span style="color:red;">错误: ${message}</span>`)
  },
  logWarn(message) {
    this._ensureInitialized()
    console.warn(`[UILogger] ${message}`)
    this.updateProgress(this.getMinimalBookInfo(), `<span style="color:orange;">警告: ${message}</span>`)
  },
  logInfo(message) {
    this._ensureInitialized()
    console.log(`[UILogger] ${message}`)
    this.updateProgress(this.getMinimalBookInfo(), `<span style="color:green;">${message}</span>`) // Use green for general info? Or default color.
  },
  clearLog() {
    this._ensureInitialized()
    this._progressElements.error.innerHTML = '' // Clear error/log area
    // Reset counts in the main display
    this._progressElements.text.textContent = '0/0'
    this._progressElements.image.textContent = '0/0'
    this._progressElements.main.innerHTML = 'ePub生成进度: 文本 0/0；图片 0/0；任务 0/0；<br>最新日志: 无'
    // Need to re-append the error div after clearing innerHTML
    if (!this._progressElements.main.contains(this._progressElements.error)) {
      this._progressElements.main.appendChild(this._progressElements.error)
    }
  },

  // Helper to provide minimal data structure if bookInfoInstance isn't fully available
  getMinimalBookInfo() {
    // If called before bookInfoInstance is set or if it's needed in a context
    // where the full bookInfo isn't passed, use default/current values.
    // However, updateProgress *expects* a bookInfoInstance for counts.
    // So it's best to ensure updateProgress is always called WITH bookInfoInstance.
    // This minimal version is just a placeholder concept.
    return this._bookInfoInstance || {
      Text: [],
      Images: [],
      totalTasksAdded: 0,
      tasksCompletedOrSkipped: 0,
    }
  },
}
