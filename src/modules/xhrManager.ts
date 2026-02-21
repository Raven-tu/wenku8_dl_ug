import type { BookInfoLike, XhrTask } from '../types'
import { toErrorMessage } from './errorUtils'

export const XHRDownloadManager = {
  _XHRArr: [] as XhrTask[], // 下载请求列表
  _XHRLimitArr: [] as XhrTask[], // 仅对 app 接口限速的请求队列
  _XHRDelay: 60 * 1000 / 100, // 限制每60秒100个请求
  _XHRIntervalID: null as ReturnType<typeof setInterval> | null, // 限速请求发送计时器
  _bookInfoInstance: null as BookInfoLike | null, // 关联的EpubBuilder实例
  hasCriticalFailure: false, // 标记是否有关键下载失败

  init(bookInfoInstance: BookInfoLike) {
    this._bookInfoInstance = bookInfoInstance
    this._XHRArr = []
    this._XHRLimitArr = []
    if (this._XHRIntervalID) {
      clearInterval(this._XHRIntervalID)
      this._XHRIntervalID = null
    }
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
  add(xhrTask: XhrTask) {
    if (!this._bookInfoInstance)
      return
    if (this.hasCriticalFailure) {
      this._bookInfoInstance.logger.logWarn(`关键下载已失败，新任务 ${xhrTask.type || xhrTask.url} 被跳过。`)
      // 标记任务为“完成”（实际上是跳过）以允许流程继续判断
      this._bookInfoInstance.totalTasksAdded++
      this._bookInfoInstance.tasksCompletedOrSkipped++
      this._bookInfoInstance.tryBuildEpub() // 尝试推进构建流程
      return
    }
    xhrTask.start = xhrTask.start ?? false
    xhrTask.done = xhrTask.done ?? false
    xhrTask.XHRRetryCount = 0
    xhrTask.isCritical = xhrTask.isCritical !== undefined ? xhrTask.isCritical : true // 默认是关键任务
    this._XHRArr.push(xhrTask)
    this._bookInfoInstance.totalTasksAdded++
    this._XHRLoad(xhrTask)
  },

  _XHRLoad(xhrTask: XhrTask) {
    if (!this._bookInfoInstance)
      return
    if (xhrTask.url && xhrTask.url.endsWith('/android.php')) {
      if (this._XHRIntervalID === null) {
        this._XHRIntervalID = setInterval(() => this._XHRLimitLoad(), this._XHRDelay)
      }
      this._XHRLimitArr.push(xhrTask)
      return
    }

    this._executeTask(xhrTask)
  },

  _XHRLimitLoad() {
    if (!this._bookInfoInstance)
      return
    const xhrTask = this._XHRLimitArr.shift()
    if (!xhrTask)
      return

    this._executeTask(xhrTask)
  },

  _executeTask(xhrTask: XhrTask) {
    if (!this._bookInfoInstance)
      return
    const taskName = xhrTask.type || xhrTask.url

    try {
      if (!xhrTask.loadFun)
        return
      const maybePromise = xhrTask.loadFun(xhrTask)
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch((err: unknown) => {
          this._bookInfoInstance?.logger.logError(`任务 ${taskName} 执行时发生意外错误: ${toErrorMessage(err)}`)
          this.retryTask(xhrTask, `${taskName} 下载失败`) // 未被内部捕获时按原逻辑重试
        })
      }
    }
    catch (err: unknown) {
      this._bookInfoInstance.logger.logError(`任务 ${taskName} 执行时发生意外错误: ${toErrorMessage(err)}`)
      this.retryTask(xhrTask, `${taskName} 下载失败`)
    }
  },

  /**
   * 任务完成（成功或最终失败）时调用
   * @param {object} task - 完成的任务对象
   * @param {boolean} [isFinalFailure] - 任务是否最终失败
   */
  taskFinished(task: XhrTask, isFinalFailure = false) {
    if (!this._bookInfoInstance)
      return
    // 确保不会重复标记完成
    if (task._finished)
      return
    task._finished = true
    task.done = true

    this._bookInfoInstance.tasksCompletedOrSkipped++

    if (isFinalFailure && task.isCritical && !this.hasCriticalFailure) {
      this.hasCriticalFailure = true
      this._bookInfoInstance.XHRFail = true // 同步到 bookInfo
      this._bookInfoInstance.logger.logError('一个关键下载任务最终失败，后续部分任务可能被取消。')
      this._XHRLimitArr = [] // 清空等待队列
      if (this._XHRIntervalID) {
        clearInterval(this._XHRIntervalID)
        this._XHRIntervalID = null
      }
    }

    if (this._XHRArr.every(e => e.done) && this._XHRIntervalID) {
      clearInterval(this._XHRIntervalID)
      this._XHRIntervalID = null
    }
    this._bookInfoInstance.tryBuildEpub() // 通知EpubBuilder检查是否所有任务完成
  },

  /**
   * 任务需要重试时调用
   * @param {object} xhrTask - 需要重试的任务对象
   * @param {string} message - 重试原因消息
   */
  retryTask(xhrTask: XhrTask, message: string) {
    if (!this._bookInfoInstance)
      return
    if (this.hasCriticalFailure) {
      this._bookInfoInstance.logger.logWarn(`重试 ${xhrTask.type || xhrTask.url} 被跳过，因为关键下载已失败。`)
      return
    }

    xhrTask.XHRRetryCount = (xhrTask.XHRRetryCount || 0) + 1
    if (xhrTask.XHRRetryCount <= MAX_XHR_RETRIES) {
      this._bookInfoInstance.refreshProgress(this._bookInfoInstance, `${message} (尝试次数 ${xhrTask.XHRRetryCount}/${MAX_XHR_RETRIES})`)
      setTimeout(() => this._XHRLoad(xhrTask), XHR_RETRY_DELAY_MS * xhrTask.XHRRetryCount)
    }
    else {
      this._bookInfoInstance.refreshProgress(this._bookInfoInstance, `<span style="color:red;">${xhrTask.type || xhrTask.url} 超出最大重试次数, 下载失败！</span>`)
      const isCritical = Boolean(xhrTask.isCritical)
      this.hasCriticalFailure = isCritical
      this._bookInfoInstance.XHRFail = isCritical
      this.taskFinished(xhrTask, isCritical) // 标记为失败，并检查是否关键
    }
  },

  /**
   * 检查所有任务是否完成 (包括队列中和正在进行的)
   * @returns {boolean}
   */
  areAllTasksDone() {
    const allDone = this._XHRArr.every(e => e.done)
    if (allDone && this._XHRIntervalID) {
      clearInterval(this._XHRIntervalID)
      this._XHRIntervalID = null
    }
    return allDone
  },
}
