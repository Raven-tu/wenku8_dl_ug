export const XHRDownloadManager = {
  _queue: [],
  _activeDownloads: 0,
  _maxConcurrentDownloads: 4, // 并发下载数控制
  _bookInfoInstance: null, // 关联的EpubBuilder实例
  hasCriticalFailure: false, // 标记是否有关键下载失败

  init(bookInfoInstance) {
    this._bookInfoInstance = bookInfoInstance
    this._queue = []
    this._activeDownloads = 0
    this.hasCriticalFailure = false
  },

  /**
   * 添加一个下载任务到队列
   * @param {object} xhrTask - 任务对象 {url, loadFun, data?, type?, isCritical?}
   *   - url: 请求URL (可选，对于非URL任务如appChapterList)
   *   - loadFun: 实际执行下载的异步函数 (接收 xhrTask 作为参数)
   *   - data: 任务相关数据
   *   - type: 任务类型 (用于日志和判断关键性)
   *   - isCritical: 是否为关键任务 (默认为true，图片等非关键任务可设为false)
   */
  add(xhrTask) {
    if (this.hasCriticalFailure) {
      this._bookInfoInstance.logger.logWarn(`关键下载已失败，新任务 ${xhrTask.type || xhrTask.url} 被跳过。`)
      // 标记任务为“完成”（实际上是跳过）以允许流程继续判断
      this._bookInfoInstance.totalTasksAdded++
      this._bookInfoInstance.tasksCompletedOrSkipped++
      this._bookInfoInstance.tryBuildEpub() // 尝试推进构建流程
      return
    }
    xhrTask.XHRRetryCount = 0
    xhrTask.isCritical = xhrTask.isCritical !== undefined ? xhrTask.isCritical : true // 默认是关键任务
    this._queue.push(xhrTask)
    this._bookInfoInstance.totalTasksAdded++
    this._processQueue()
  },

  _processQueue() {
    if (this.hasCriticalFailure)
      return

    while (this._activeDownloads < this._maxConcurrentDownloads && this._queue.length > 0) {
      const task = this._queue.shift()
      this._activeDownloads++
      // 异步执行任务
      task.loadFun(task)
        .then(() => {
          // loadFun 内部应标记 task.done = true 并调用 taskFinished
          // 如果 loadFun 没有正确处理，这里可能会有问题。
          // 更好的做法是 loadFun 返回一个 Promise，并在 Promise resolve/reject 时调用 taskFinished
          // 为了兼容现有结构，假设 loadFun 最终会调用 taskFinished 或抛出错误
        })
        .catch((err) => {
          // loadFun 内部应该处理自己的错误和重试逻辑
          // 如果 loadFun 抛出未捕获的错误，这里记录并视为最终失败
          this._bookInfoInstance.logger.logError(`任务 ${task.type || task.url} 执行时发生意外错误: ${err}`)
          task.done = true // 标记意外失败
          this.taskFinished(task, task.isCritical) // 标记为失败，并检查是否关键
        })
    }
  },

  /**
   * 任务完成（成功或最终失败）时调用
   * @param {object} task - 完成的任务对象
   * @param {boolean} [isFinalFailure] - 任务是否最终失败
   */
  taskFinished(task, isFinalFailure = false) {
    // 确保不会重复标记完成
    if (task._finished)
      return
    task._finished = true

    this._activeDownloads--
    this._bookInfoInstance.tasksCompletedOrSkipped++

    if (isFinalFailure && task.isCritical && !this.hasCriticalFailure) {
      this.hasCriticalFailure = true
      this._bookInfoInstance.XHRFail = true // 同步到 bookInfo
      this._bookInfoInstance.logger.logError('一个关键下载任务最终失败，后续部分任务可能被取消。')
      this._queue = [] // 清空等待队列
    }

    this._processQueue() // 尝试处理下一个任务
    this._bookInfoInstance.tryBuildEpub() // 通知EpubBuilder检查是否所有任务完成
  },

  /**
   * 任务需要重试时调用
   * @param {object} xhrTask - 需要重试的任务对象
   * @param {string} message - 重试原因消息
   */
  retryTask(xhrTask, message) {
    if (this.hasCriticalFailure) {
      this._bookInfoInstance.logger.logWarn(`重试 ${xhrTask.type || xhrTask.url} 被跳过，因为关键下载已失败。`)
      xhrTask.done = true // 标记为完成（跳过）
      this.taskFinished(xhrTask, true) // 标记为关键失败
      return
    }

    xhrTask.XHRRetryCount = (xhrTask.XHRRetryCount || 0) + 1
    if (xhrTask.XHRRetryCount <= MAX_XHR_RETRIES) {
      this._bookInfoInstance.refreshProgress(this._bookInfoInstance, `${message} (尝试次数 ${xhrTask.XHRRetryCount}/${MAX_XHR_RETRIES})`)
      // 将任务重新放回队列头部，稍后重试
      this._activeDownloads-- // 先减少计数，因为它即将重新入队
      this._queue.unshift(xhrTask)
      // 延迟一小段时间再处理队列，避免立即重试导致服务器压力
      setTimeout(() => this._processQueue(), XHR_RETRY_DELAY_MS * xhrTask.XHRRetryCount)
    }
    else {
      this._bookInfoInstance.refreshProgress(this._bookInfoInstance, `<span style="color:red;">${xhrTask.type || xhrTask.url} 超出最大重试次数, 下载失败！</span>`)
      xhrTask.done = true // 标记为最终失败
      this.taskFinished(xhrTask, xhrTask.isCritical) // 标记为失败，并检查是否关键
    }
  },

  /**
   * 检查所有任务是否完成 (包括队列中和正在进行的)
   * @returns {boolean}
   */
  areAllTasksDone() {
    // 只有当添加的任务总数等于已完成/跳过的任务数，且队列为空，且没有正在进行的下载时，才算全部完成
    return this._bookInfoInstance.tasksCompletedOrSkipped >= this._bookInfoInstance.totalTasksAdded && this._queue.length === 0 && this._activeDownloads === 0
  },
}
