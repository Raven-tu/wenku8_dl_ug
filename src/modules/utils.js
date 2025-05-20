/**
 * 封装 GM_xmlhttpRequest 为 Promise
 * @param {object} details - GM_xmlhttpRequest 的参数对象
 * @returns {Promise<object>} Promise 对象，resolve 时返回 response 对象
 */
export function gmXmlHttpRequestAsync(details) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      ...details,
      onload: resolve,
      onerror: (err) => {
        console.error(`GM_xmlhttpRequest error for ${details.url}:`, err)
        reject(err)
      },
      ontimeout: (err) => {
        console.error(`GM_xmlhttpRequest timeout for ${details.url}:`, err)
        reject(err)
      },
    })
  })
}

/**
 * 封装 fetch 为 Promise，并处理指定编码
 * @param {string} url - 请求URL
 * @param {string} [encoding] - 响应编码
 * @returns {Promise<string>} Promise 对象，resolve 时返回文本内容
 */
export async function fetchAsText(url, encoding = 'gbk') {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for ${url}`)
  }
  const buffer = await response.arrayBuffer()
  const decoder = new TextDecoder(encoding)
  return decoder.decode(buffer)
}

/**
 * 清理可能导致XML解析错误的非法字符
 * @param {string} text - 输入字符串
 * @returns {string} 清理后的字符串
 */
export function cleanXmlIllegalChars(text) {
  return text.replace(XML_ILLEGAL_CHARACTERS_REGEX, '')
}
