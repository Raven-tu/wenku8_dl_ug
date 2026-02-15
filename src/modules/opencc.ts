type PageGlobals = Window

export const OpenCCConverter = {
  COOKIE_KEY: 'OpenCCwenku8',
  TARGET_ENCODING_COOKIE_KEY: 'targetEncodingCookie', // 假设页面脚本定义了这个key
  COOKIE_DAYS: 7,
  buttonElement: null as HTMLAnchorElement | null,
  isConversionEnabled: false,
  originalSimplized: null as ((text: string) => string) | null | undefined,
  originalTraditionalized: null as ((text: string) => string) | null | undefined,

  /**
   * 初始化 OpenCC 转换功能
   * @param {object} pageGlobals - 包含页面全局变量的对象 (如 unsafeWindow)
   */
  init(pageGlobals: PageGlobals) {
    // 尝试获取页面已有的简繁转换函数和状态变量
    this.originalSimplized = pageGlobals.Simplized
    this.originalTraditionalized = pageGlobals.Traditionalized

    if (typeof pageGlobals.OpenCC === 'undefined') {
      console.warn('OpenCC库未加载，简繁转换功能可能受限。')
      return
    }

    this.isConversionEnabled = this.getCookie(this.COOKIE_KEY, pageGlobals) === '1'

    this.buttonElement = document.createElement('a')
    this.buttonElement.href = 'javascript:void(0);'
    this.buttonElement.addEventListener('click', () => this.toggleConversion(pageGlobals))

    this.updateButtonText()

    if (this.isConversionEnabled) {
      // 替换页面原有的转换函数
      if (typeof pageGlobals.Traditionalized !== 'undefined') {
        pageGlobals.Traditionalized = pageGlobals.OpenCC.Converter({ from: 'cn', to: 'tw' })
      }
      if (typeof pageGlobals.Simplized !== 'undefined') {
        pageGlobals.Simplized = pageGlobals.OpenCC.Converter({ from: 'tw', to: 'cn' })
      }

      // 如果cookie中设置了目标编码为简体，则执行一次翻译
      if (this.getCookie(this.TARGET_ENCODING_COOKIE_KEY, pageGlobals) === '2' && typeof pageGlobals.translateBody === 'function') {
        pageGlobals.targetEncoding = '2' // 强制设置为简体目标
        pageGlobals.translateBody()
      }
    }

    const translateButton = document.querySelector(`#${pageGlobals.translateButtonId}`) // translateButtonId 来自页面
    if (translateButton && translateButton.parentElement) {
      translateButton.parentElement.appendChild(document.createTextNode('  '))
      translateButton.parentElement.appendChild(this.buttonElement)
    }
    else {
      console.warn('未能找到页面简繁转换按钮的挂载点。OpenCC切换按钮可能无法显示。')
    }
  },

  toggleConversion(pageGlobals: PageGlobals) {
    if (this.isConversionEnabled) {
      this.setCookie(this.COOKIE_KEY, '', this.COOKIE_DAYS, pageGlobals) // 关闭
    }
    else {
      this.setCookie(this.TARGET_ENCODING_COOKIE_KEY, '2', this.COOKIE_DAYS, pageGlobals) // 开启并设置为目标简体
      this.setCookie(this.COOKIE_KEY, '1', this.COOKIE_DAYS, pageGlobals) // 开启
    }
    location.reload()
  },

  updateButtonText() {
    if (this.buttonElement) {
      this.buttonElement.innerHTML = this.isConversionEnabled ? '关闭(OpenCC)' : '开启(OpenCC)'
    }
  },

  // 保持与旧代码一致的 setCookie 和 getCookie (可能由页面提供)
  setCookie(name: string, value: string, days: number, pageGlobals: PageGlobals) {
    if (typeof pageGlobals.setCookie === 'function') {
      pageGlobals.setCookie(name, value, days)
    }
    else {
      console.warn('pageGlobals.setCookie 未定义，OpenCC cookie 可能无法设置')
      let expires = ''
      if (days) {
        const date = new Date()
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
        expires = `; expires=${date.toUTCString()}`
      }
      document.cookie = `${name}=${value || ''}${expires}; path=/`
    }
  },

  getCookie(name: string, pageGlobals: PageGlobals): string | null {
    if (typeof pageGlobals.getCookie === 'function') {
      return pageGlobals.getCookie(name)
    }
    console.warn('pageGlobals.getCookie 未定义，OpenCC cookie 可能无法读取')
    const nameEQ = `${name}=`
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0)
        return c.substring(nameEQ.length, c.length)
    }
    return null
  },
}
