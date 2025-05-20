export const CURRENT_URL = new URL(unsafeWindow.location.href)
export const EPUB_EDITOR_CONFIG_UID = '24A08AE1-E132-458C-9E1D-6C998F16A666'
export const IMG_LOCATION_FILENAME = 'ImgLocation'
// eslint-disable-next-line no-control-regex
export const XML_ILLEGAL_CHARACTERS_REGEX = /[\x00-\x08\v\f\x0E-\x1F]/g
export const APP_API_DOMAIN = 'app.wenku8.com'
export const APP_API_PATH = '/android.php'
export const DOWNLOAD_DOMAIN = 'dl.wenku8.com'
export const IMAGE_DOMAIN = 'img.wenku8.com'
export const MAX_XHR_RETRIES = 3 // XHR最大重试次数
export const XHR_TIMEOUT_MS = 20000 // XHR默认超时时间 (20秒)
export const XHR_RETRY_DELAY_MS = 500 // XHR重试延迟基础时间
export const VOLUME_ID_PREFIX = 'Volume' // 分卷文件、DOM ID前缀
export const IMAGE_FILE_PREFIX = 'Img' // 图片文件、ID前缀
export const TEXT_SPAN_PREFIX = 'Txt' // 文字ID前缀
