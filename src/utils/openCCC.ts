import OpenCC from 'opencc-js'
import type { ConvertText, ConverterOptions } from 'opencc-js'
import { getCookie, setCookie } from './tools'

let Simplized: ConvertText
let Traditionalized: ConvertText
let targetEncoding = '2' // 1: 繁體中文, 2: 简体中文
const currentEncoding = '2'
const targetEncodingCookie = '1'
function translateBody(): void {}

// 使用OpenCCC进行简转繁
export function OpenCCConver(): () => void {
  const OpenCCInfo = {
    OpenCCCookieKey: 'OpenCCwenku8', // 存放设置的cookie的key
    OpenCCCookie: null as string | null, // 存放设置的cookie的值
    translateButtonId: '', // GB_BIG5转换元素ID
    GB_BIG5_Simplized: Simplized, // GB_BIG5转换方法
    GB_BIG5_Traditionalized: Traditionalized, // GB_BIG5转换方法
    currentEncoding, // 1: 繁體中文, 2: 简体中文
    targetEncodingCookie, // GB_BIG5翻译目标
    translateBody, // 翻译元素方法
    setCookie, // 设置cookie
    getCookie, // 读cookie
    CookieDays: 7, // cookie天数
    OpenCCEle: null as HTMLAnchorElement | null, // 开关元素
    OpenCCEleClick: () => {
      // 关闭
      if (OpenCCInfo.OpenCCCookie) {
        OpenCCInfo.setCookie(OpenCCInfo.OpenCCCookieKey, '', OpenCCInfo.CookieDays)
        location.reload()
      }
      // 开启
      else {
        OpenCCInfo.setCookie(OpenCCInfo.targetEncodingCookie, '2', OpenCCInfo.CookieDays)
        OpenCCInfo.setCookie(OpenCCInfo.OpenCCCookieKey, '1', OpenCCInfo.CookieDays)
        location.reload()
      }
    }, // 开关元素点击事件
    start: () => {
      OpenCCInfo.OpenCCEle = document.createElement('a')
      OpenCCInfo.OpenCCEle.href = 'javascript:void(0);'
      OpenCCInfo.OpenCCEle.innerHTML = '開啟(OpenCC)'
      OpenCCInfo.OpenCCEle.addEventListener('click', OpenCCInfo.OpenCCEleClick)
      // 如果有设置就替换GB_BIG5的转换
      if (OpenCCInfo.OpenCCCookie) {
        OpenCCInfo.OpenCCEle.innerHTML = '关闭(OpenCC)'

        Traditionalized = OpenCC.Converter({ from: 'cn', to: 'tw' } as ConverterOptions)
        Simplized = OpenCC.Converter({ from: 'tw', to: 'cn' } as ConverterOptions)

        if (OpenCCInfo.OpenCCCookie === '1') {
          targetEncoding = OpenCCInfo.OpenCCCookie
          translateBody()
        }
      }
      // 添加开关元素
      const tranBtn = document.querySelector(`#${OpenCCInfo.translateButtonId}`)
      if (tranBtn) {
        tranBtn.parentElement?.appendChild(document.createTextNode('  '))
        tranBtn.parentElement?.appendChild(OpenCCInfo.OpenCCEle)
      }
    }, //
  }
  OpenCCInfo.OpenCCCookie = OpenCCInfo.getCookie(OpenCCInfo.OpenCCCookieKey)
  return OpenCCInfo.start
};// 使用OpenCCC进行简转繁
OpenCCConver()()
