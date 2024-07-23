import { GM_xmlhttpRequest } from '$'

export function AppApi() {
  const AppApiInfo = {
    VolumeMap: new Map(),
    appApiDomain: 'app.wenku8.com', // app接口域名
    appApiPath: '/android.php', // app接口路径
    appApiLangDis: true, // 禁用app接口请求繁体内容。由页面自行转换。
    appApiLang: (info: { targetEncoding: string }) => {
      if (AppApiInfo.appApiLangDis) {
        return '0'
      }
      // 0 simplified Chinese;1 traditional Chinese
      let rst = '0'
      if (info.targetEncoding === '1') {
        rst = '1'
      }
      else if (info.targetEncoding === '2') {
        rst = '0'
      }
      return rst
    }, // 语言选择
    appApiGetEncrypted: (body: string) => {
      return `appver=1.0&timetoken=${Number(new Date())}&request=${btoa(body)}`
    }, // 编码请求内容
    appApiListLoad: (xhr) => {
      xhr.start = true
      xhr.bookInfo.refreshProgress(xhr.bookInfo, `下载app章节目录;`)
      const lang = AppApiInfo.appApiLang(xhr.bookInfo)
      let body = `action=book&do=list&aid=${xhr.bookInfo.aid}&t=${lang}`
      body = AppApiInfo.appApiGetEncrypted(body)
      GM_xmlhttpRequest({
        method: 'POST',
        url: xhr.url,
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
        data: body,
        onload(response) {
          if (response.status === 200) {
            xhr.done = true
            const rspRaw = response.responseText
            // 格式化xml内容
            const domParser = new DOMParser()
            const rspXml = domParser.parseFromString(rspRaw, 'application/xml')
            AppApiInfo.appApiList = rspXml
            // 继续下载在等待章节列表的分卷
            for (const x of AppApiInfo.appApiListWait) {
              AppApiInfo.appApiLoadVolume(x)
            }
          }
          else {
            // 重新下载
            xhr.XHRRetryFun(xhr, `app章节目录下载失败，重新下载;`)
          }
        },
        onerror: () => {
          // 重新下载
          xhr.XHRRetryFun(xhr, `app章节目录下载失败，重新下载;`)
        },
      })
    }, // 下载章节列表，全本下载只下载一次
    appApiList: null as Document | null, // 章节列表docum，XML
    appApiListStart: false, // 章节列表已开始下载
    appApiListWait: [], // 等待章节列表的xhr
    appApiDoList: (xhr) => {
      if (!AppApiInfo.appApiListStart) {
        AppApiInfo.appApiListStart = true
        // 下载章节列表
        const dlink = `http://${AppApiInfo.appApiDomain}${AppApiInfo.appApiPath}`
        const lXhr = { start: false, done: false, url: dlink, loadFun: AppApiInfo.appApiListLoad, VolumeIndex: xhr.VolumeIndex, bookInfo: xhr.bookInfo }
        lXhr.bookInfo.XHRAdd(lXhr)
      }
      AppApiInfo.appApiListWait.push(xhr)
    }, // 下载章节列表，处理等待队列
    appApiLoadVolume: (xhr) => {
      // 如果没有章节列表就去下载
      if (!AppApiInfo.appApiList) {
        AppApiInfo.appApiDoList(xhr)
        return
      }

      let vol
      for (vol of AppApiInfo.appApiList.getElementsByTagName('volume')) {
        if (xhr.data.vid === vol.getAttribute('vid')) {
          break
        }
      }
      // 找不到分卷，停止
      if (!vol) {
        xhr.bookInfo.refreshProgress(xhr.bookInfo, `<span style="color:fuchsia;">app章节目录未找到分卷${xhr.data.vid}，无法生成ePub;</span>`)
        xhr.done = false
        xhr.bookInfo.XHRFail = true
        return
      }
      const chArr = []
      // 添加章节下载，完成失败的分卷下载；pack.php
      for (const ch of vol.children) {
        const cid = ch.getAttribute('cid')
        const cName = ch.textContent
        // let xhr = { start: false, done: false, url: dlink, loadFun: bInfo.loadVolume, VolumeIndex: VolumeIndex, data: { vid: vid, vcssText: vcssText }, bookInfo: bInfo };
        const dlink = `http://${AppApiInfo.appApiDomain}${AppApiInfo.appApiPath}`
        const cXhr = { start: false, done: false, url: dlink, loadFun: AppApiInfo.appApiLoadChapter, dealVolume: xhr.dealVolume, VolumeIndex: xhr.VolumeIndex, data: { vid: xhr.data.vid, vcssText: xhr.data.vcssText, Text: xhr.data.Text, isAppApi: true, cid }, bookInfo: xhr.bookInfo }
        cXhr.bookInfo.XHRAdd(cXhr)

        chArr.push({ cid, cName, content: null })
      }
      AppApiInfo.VolumeMap.set(xhr.data.vid, chArr)

      xhr.done = true
      xhr.bookInfo.buildEpub(xhr.bookInfo)
    }, // 下载分卷，app接口只能下载章节
    appApiLoadChapter: (xhr) => {
      xhr.start = true
      const lang = AppApiInfo.appApiLang(xhr.bookInfo)
      let body = `action=book&do=text&aid=${xhr.bookInfo.aid}&cid=${xhr.data.cid}&t=${lang}`
      body = AppApiInfo.appApiGetEncrypted(body)
      const msg = `${xhr.data.cName} 下载失败，重新下载;`
      GM_xmlhttpRequest({
        method: 'POST',
        url: xhr.url,
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
        data: body,
        onload(response) {
          if (response.status == 200) {
            const rspRaw = response.responseText
            const chArr = AppApiInfo.VolumeMap.get(xhr.data.vid)
            const ch = chArr.find(f => f.cid == xhr.data.cid)
            ch.content = rspRaw

            xhr.done = true

            const vid = xhr.data.vid
            // 分卷的章节都下载完成了
            if (xhr.bookInfo.XHRDone(vid)) {
              let VolumeText = ''
              // 处理格式，拼接章节
              for (const c of chArr) {
                if (!c.content) { continue }
                const cName = c.cName
                const cid = c.cid
                // 章节名
                c.content = c.content.replace(cName, `<div class="chaptertitle"><a name="${cid}">${cName}</a></div><div class="chaptercontent">`)
                // 换行
                c.content = c.content.replace(/\r\n/g, '<br />\r\n')
                // 替换插图
                if (c.content.includes('<!--image-->http')) {
                  c.content = c.content.replaceAll('<!--image-->http', `<div class="divimage" title="http`)
                  c.content = c.content.replaceAll('<!--image-->', `"></div>`)
                }
                c.content += `</div>`

                VolumeText += c.content
              }
              // 处理分卷文本
              xhr.dealVolume(xhr, VolumeText)
            }
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
  }
  return AppApiInfo.appApiLoadVolume
};// 用app接口下载分卷、章节
