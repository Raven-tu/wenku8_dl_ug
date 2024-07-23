
// 目录或内容页面会声明章节变量。
if (typeof chapter_id == 'undefined' || undefined === chapter_id) { }
else {
  // 本书编号 article_id
  // 目录页面章节id定义为 '0'
  if (chapter_id == '0') { // 在章节名之后添加下载链接
    // 书名
    const titleEle = document.querySelector('#title')
    const aname = titleEle.innerText
    // targetEncoding 1: 繁體中文, 2: 简体中文
    let charsetDL = 'utf-8'
    let charsetDLAll = 'utf8'
    if (targetEncoding == '1') {
      charsetDL = 'big5'
      charsetDLAll = 'big5'
    }

    // 添加全本下载链接
    {
      const DLink = `https://dl.wenku8.com/down.php?type=${charsetDLAll}&id=${article_id}&fname=${aname}`
      const aEle = document.createElement('a')
      aEle.href = DLink
      aEle.innerText = ` 全本文本下载(${charsetDLAll})`
      titleEle.appendChild(aEle)

      // 添加 ePub下载(全本)
      const aEleEpub = document.createElement('a')
      aEleEpub.className = 'DownloadAll'
      aEleEpub.setAttribute('DownloadAll', 'true')
      aEleEpub.innerText = ' ePub下载(全本)'
      aEleEpub.href = 'javascript:void(0);'
      titleEle.append(aEleEpub)
      aEleEpub.addEventListener('click', e => EpubBuilder().start(e))

      const allaEpubEleEdt = document.createElement('a')
      allaEpubEleEdt.className = 'DownloadAll'
      allaEpubEleEdt.setAttribute('ePubEidt', 'true')
      allaEpubEleEdt.setAttribute('DownloadAll', 'true')
      allaEpubEleEdt.innerText = ' (调整插图)'
      allaEpubEleEdt.href = 'javascript:void(0);'
      titleEle.append(allaEpubEleEdt)
      allaEpubEleEdt.addEventListener('click', e => EpubBuilder().start(e))
      // 添加循环延时下载 所有分卷 EPUB
      // <input type="number" id="NB" max="10" min="3" value="3" style="text-align: center;">
      const aEleInput = document.createElement('input')
      aEleInput.setAttribute('type', 'number')
      aEleInput.setAttribute('id', 'subNumInput')
      aEleInput.setAttribute('max', '10')
      aEleInput.setAttribute('min', '3')
      aEleInput.setAttribute('value', '3')
      aEleInput.style.textAlign = 'center'
      titleEle.append(aEleInput)
      const aEleSubEpub = document.createElement('a')
      aEleSubEpub.className = 'DownloadAllSub'
      aEleSubEpub.innerText = ' 循环下载分卷ePub下载(全本)'
      aEleSubEpub.href = 'javascript:void(0);'
      titleEle.append(aEleSubEpub)
      aEleSubEpub.addEventListener('click', e => loopDownloadSub())
    }

    // 添加分卷下载链接
    const vcssArry = document.querySelectorAll('.vcss')
    for (const vcss of vcssArry) {
      const vname = vcss.innerText
      const vid = vcss.getAttribute('vid')

      const dlink = `https://dl.wenku8.com/packtxt.php?aid=${article_id}&vid=${vid}&aname=${aname}&vname=${vname}&charset=${charsetDL}`
      const aEle = document.createElement('a')
      aEle.href = dlink
      aEle.innerText = `  文本下载(${charsetDL})`
      vcss.appendChild(aEle)

      // 添加 ePub下载(分卷)
      const aEleEpub = document.createElement('a')
      aEleEpub.href = 'javascript:void(0);'
      aEleEpub.innerText = ' ePub下载(本卷)'
      aEleEpub.className = 'ePubSub'
      vcss.append(aEleEpub)
      aEleEpub.addEventListener('click', e => EpubBuilder().start(e))

      const aEleEpubEdt = document.createElement('a')
      aEleEpubEdt.href = 'javascript:void(0);'
      aEleEpubEdt.innerText = ' (调整插图)'
      aEleEpubEdt.setAttribute('ePubEidt', 'true')
      vcss.append(aEleEpubEdt)
      aEleEpubEdt.addEventListener('click', e => EpubBuilder().start(e))
    }
  }
  else {
    // 如果第一个子元素为 内容是'null'的span则判定为版权限制
    const contentMain = document.querySelector('#contentmain')
    if (contentMain.firstElementChild.tagName == 'SPAN'
      && contentMain.firstElementChild.innerText.trim() == 'null') {
      const content = document.getElementById('content')
      const appApi = {
        appApiDomain: 'app.wenku8.com', // app接口域名
        appApiPath: '/android.php', // app接口路径
        targetEncoding,
        appApiLangDis: true, // 禁用app接口请求繁体内容。由页面自行转换。
        appApiLang: () => {
          if (appApi.appApiLangDis) {
            return '0'
          }
          // 0 simplified Chinese;1 traditional Chinese
          let rst = '0'
          if (appApi.targetEncoding == '1') {
            rst = '1'
          }
          else if (appApi.targetEncoding == '2') {
            rst = '0'
          }
          return rst
        }, // 语言选择
        appApiGetEncrypted: (body) => {
          return `appver=1.0&timetoken=${Number(new Date())}&request=${btoa(body)}`
        }, // 编码请求内容
        appApiLoadChapter: (xhr) => {
          xhr.start = true
          const lang = appApi.appApiLang(xhr.bookInfo)
          let body = `action=book&do=text&aid=${xhr.bookInfo.aid}&cid=${xhr.data.cid}&t=${lang}`
          body = appApi.appApiGetEncrypted(body)
          const msg = `${xhr.data.cName} 下载失败，重新下载;`
          GM_xmlhttpRequest({
            method: 'POST',
            url: xhr.url,
            headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
            data: body,
            onload(response) {
              if (response.status == 200) {
                let rspRaw = response.responseText
                rspRaw = rspRaw.replace(/ {2}\S.*/, '')
                // 换行
                rspRaw = rspRaw.replace(/\r\n/g, '<br />\r\n')
                // 替换插图
                if (rspRaw.includes('<!--image-->http')) {
                  rspRaw = rspRaw.replaceAll(/<!--image-->(http[\w:/.?@#&=%]+)<!--image-->/g, (m, p1) => `<div class="divimage"><a href="${p1}" target="_blank"><img src="${p1}" border="0" class="imagecontent"></a></div>`)
                }
                rspRaw += `</div>`
                content.innerHTML = rspRaw
                appApi.translateBody(content)
                xhr.done = true
              }
              else {
                // 重新下载
                xhr.XHRRetryFun(xhr, msg)
              }
            },
            onerror: () => {
              // 重新下载
              xhr.XHRRetryFun(xhr, msg)
            },
          })
        }, // 下载章节，全部完成后拼成分卷格式
        XHRAdd: null,
        refreshProgress: (info, err) => {
          if (err) { content.innerHTML = err + content.innerHTML }
        },
        translateBody,
      }
      const bookInfo = { aid: article_id, refreshProgress: appApi.refreshProgress };
      [bookInfo.XHRAdd] = XHRDownloader()
      const dlink = `http://${appApi.appApiDomain}${appApi.appApiPath}`
      const xhr = { start: false, done: false, url: dlink, loadFun: appApi.appApiLoadChapter, data: { cid: chapter_id }, bookInfo }
      xhr.bookInfo.XHRAdd(xhr)
      content.innerHTML = '正在下载，请稍候...'
    }
  }
}

// 评论页面
const articleReg = /\/modules\/article\//
if (articleReg.test(window.location.href)) {
  const rid = hrefUrl.searchParams.get('rid')
  const page = hrefUrl.searchParams.get('page')
  const codeEleArr = document.querySelectorAll('.jieqiCode')
  const yidSet = new Set()
  for (const code of codeEleArr) {
    const yidDivEle = code.parentElement.parentElement
    let yid
    for (const aEle of yidDivEle.getElementsByTagName('a')) {
      yid = aEle.getAttribute('name')
      if (yid) { break }
    }
    if (rid && yid) {
      const codeJson = code.innerText.replace(/\s/g, '')
      let locCfg
      try {
        locCfg = JSON.parse(codeJson)
      }
      catch (e) {
        console.log(e)
        continue
      }
      if (locCfg
        && ePubEidterCfgUID == locCfg.UID
        && locCfg.aid
        && locCfg.pathname
        && (locCfg.ImgLocationBase64 || (locCfg.ImgLocation && locCfg.ImgLocation.length > 0))
        && (!yidSet.has(yid))
      ) {
        yidSet.add(yid)
        const titleDivEle = yidDivEle.firstElementChild
        const epubRefEle = document.createElement('a')
        epubRefEle.innerText = '[使用配置生成ePub]'
        epubRefEle.style.color = 'fuchsia'
        epubRefEle.href = `${locCfg.pathname}?rid=${rid}&page=${page || '1'}&yid=${yid}&CfgRef=1`
        titleDivEle.insertBefore(epubRefEle, titleDivEle.firstElementChild)
      }
    }
  }
}

// 读取到的配置
let ImgLocationCfgRef = []
/// modules/article/reviewshow.php?rid=270583
if (hrefUrl.searchParams.get('CfgRef') == '1') {
  const ridCfg = hrefUrl.searchParams.get('rid')
  const pageCfg = hrefUrl.searchParams.get('page')
  const yidCfg = hrefUrl.searchParams.get('yid')
  if (ridCfg && yidCfg) {
    const articleUrl = `${hrefUrl.origin}/modules/article/reviewshow.php?rid=${ridCfg}&page=${pageCfg}`
    GM_xmlhttpRequest({
      method: 'GET',
      url: articleUrl,
      onload(response) {
        if (response.status == 200) {
          const domParser = new DOMParser()
          const rspHtml = domParser.parseFromString(response.responseText, 'text/html')
          const codeEleArr = rspHtml.querySelectorAll('.jieqiCode')
          for (const code of codeEleArr) {
            const yidDivEle = code.parentElement.parentElement
            let yid
            for (const aEle of yidDivEle.getElementsByTagName('a')) {
              yid = aEle.getAttribute('name')
              if (yid) { break }
            }
            if (yid && yidCfg == yid) {
              const codeJson = code.innerText.replace(/\s/g, '')
              let locCfg
              try {
                locCfg = JSON.parse(codeJson)
              }
              catch (e) {
                console.log(e)
                continue
              }
              // 解压
              if (locCfg.ImgLocationBase64) {
                const zip = new JSZip()
                const textDec = new TextDecoder()
                zip.load(locCfg.ImgLocationBase64, { base64: true })
                const fileArry = zip.file(ImgLocationFile)._data.getContent()
                const imgLocJson = textDec.decode(fileArry)
                const ImgLocation = JSON.parse(imgLocJson)
                locCfg.ImgLocation = ImgLocation
              }
              if (locCfg
                && ePubEidterCfgUID == locCfg.UID
                && locCfg.aid
                && locCfg.pathname
                && locCfg.ImgLocation
                && locCfg.ImgLocation.length > 0
              ) {
                ImgLocationCfgRef.push(locCfg)
              }
            }
          }
        }
        else {
          console.log(articleUrl)
          console.log('配置下载失败')
        }
      },
      onerror: () => {
        console.log(articleUrl)
        console.log('配置下载失败')
      },
    })
  }
}
