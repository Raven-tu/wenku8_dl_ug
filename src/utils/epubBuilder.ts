function EpubBuilder() {
  let bInfo = {
    XHRAdd: null,
    XHRDone: null,
    ePubEidterInit: null,
    ePubEidterCfg: null,
    buildEpub: Builder(),
    loadVolume: LoadVolume(),//下载章节方法
    refreshProgress: RefreshLog(),
    start: (e) => {
      [bInfo.XHRAdd, bInfo.XHRDone] = XHRDownloader();
      let ePubEidt = e.target.getAttribute("ePubEidt");
      if (ePubEidt && "true" == ePubEidt) {
        bInfo.ePubEidt = true;
        [bInfo.ePubEidterInit, bInfo.ePubEidterCfg] = EPubEidter();
      }

      //全本分卷
      let vcssEle = null;
      let DownloadAll = e.target.getAttribute("DownloadAll");
      if (DownloadAll && "true" == DownloadAll) {
        //全本下载
        vcssEle = document.querySelectorAll(".vcss");
      }
      else {
        vcssEle = [e.target.parentElement];
      }
      for (let VolumeIndex = 0; VolumeIndex < vcssEle.length; VolumeIndex++) {

        let vcss = vcssEle[VolumeIndex];
        //分卷ID
        let vid = vcss.getAttribute("vid");
        //pack.php下载整卷，每个章节不带卷名，用分卷的第一个章节做分卷vid
        let vid1 = vcss.parentElement.nextElementSibling.getElementsByTagName('a')[0].getAttribute('href').split('.')[0];
        //let vid = vcss.getAttribute("vid");
        let vcssText = vcss.childNodes[0].textContent;
        let navToc = bInfo.nav_toc[VolumeIndex] = {
          volumeName: vcssText
          , vid: vid
          , volumeID: `${bInfo.VolumeFix}_${VolumeIndex}`
          , volumeHref: `${bInfo.VolumeFix}_${VolumeIndex}.xhtml`
          , chapterArr: []
        };
        let Text = {
          path: `Text/${navToc.volumeHref}`
          , content: ""
          , id: navToc.volumeID
          , vid: vid
          , volumeName: vcssText
        };
        Text.navToc = navToc;
        bInfo.Text[VolumeIndex] = Text;
        //分卷下载链接
        let dlink = `https://${bInfo.dlDomain}/pack.php?aid=${bInfo.aid}&vid=${vid1}`;
        let xhr = { start: false, done: false, url: dlink, loadFun: bInfo.loadVolume, VolumeIndex: VolumeIndex, data: { vid: vid, vcssText: vcssText, Text: Text }, bookInfo: bInfo };
        bInfo.XHRAdd(xhr);
      }

      //加载从评论读取的配置
      if (bInfo.ImgLocationCfgRef && 0 < bInfo.ImgLocationCfgRef.length) {
        for (let cfgRef of bInfo.ImgLocationCfgRef) {
          if (ePubEidterCfgUID == cfgRef.UID
            && bInfo.aid == cfgRef.aid
            && cfgRef.ImgLocation
            && 0 < cfgRef.ImgLocation.length
          ) {
            for (let loc of cfgRef.ImgLocation) {
              //插图位置记录{vid:,spanID:,imgID:}
              if (loc.vid && loc.spanID && loc.imgID
                && bInfo.Text.find(f => f.vid == loc.vid)
              ) {
                if (!bInfo.ImgLocation.find(f =>
                  f.vid == loc.vid
                  && f.spanID == loc.spanID
                  && f.imgID == loc.imgID
                )) {
                  bInfo.ImgLocation.push(loc);
                }
              }
            }
          }
        }
      }
      if (bInfo.ePubEidterCfg && bInfo.ImgLocation && 0 < bInfo.ImgLocation.length) {
        bInfo.ePubEidterCfg.ImgLocation = bInfo.ImgLocation;
      }

      bInfo.buildEpub(bInfo);
    },//入口，开始下载文件并生成epub；

    nav_toc: [],//导航菜单,第一层分卷，第二层章节{volumeName：,volumeID:,volumeHref:,chapterArr:[{chapterName:,chapterID:,chapterHref:}]}
    Text: [],//下载后生成的XHTML；{path:`Text/${volumeHref}`,content:}
    Images: [],//下载的图片；{path:`Images/${url.pathname}`,content:}

    VolumeFix: "Volume",//分卷文件、ID前缀
    dlDomain: "dl.wenku8.com",
    ImgLocationCfgRef: ImgLocationCfgRef,//读取到的配置
    ImgLocation: [],//插图位置记录{vid:,spanID:,imgID:}
    targetEncoding: targetEncoding,// 1: 繁體中文, 2: 简体中文
    aid: article_id,//本书编号 article_id
    title: document.getElementById("title").childNodes[0].textContent, //标题
    creator: document.getElementById('info').innerText,//作者
    bookUrl: self.location.href,

  };
  return bInfo;
};//epub生成;使用addEventListener绑定start；
