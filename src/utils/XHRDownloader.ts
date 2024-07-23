function XHRDownloader() {
  let XHRDownloaderInfo = {
    XHRFail: false,//下载失败，不生成ePub
    XHRRetry: 3,//xhr重试次数
    XHRRetryFun: (xhr, msg) => {
      //下载失败，不重试，不会生成ePub
      if (XHRDownloaderInfo.XHRFail) { return; }
      if (
        (!xhr.XHRRetryCount)
        || 0 == XHRDownloaderInfo.XHRRetry
        || xhr.XHRRetryCount < XHRDownloaderInfo.XHRRetry
      ) {
        xhr.XHRRetryCount = (xhr.XHRRetryCount ?? 0) + 1;
        xhr.loadFun(xhr);
        xhr.bookInfo.refreshProgress(xhr.bookInfo, msg);
      }
      else {
        XHRDownloaderInfo.XHRFail = true;
        xhr.bookInfo.refreshProgress(xhr.bookInfo, `<span style="color:fuchsia;">超出最大重试次数,下载失败，无法生成ePub;</span>`);
      }
    },//xhr重试
    XHRArr: [],//下载请求；[{start:false,done:false,url:,loadFun:,data:,bookInfo:bInfo}]
    XHRAdd: (xhr) => {
      xhr.XHRRetryFun = xhr.XHRRetryFun ?? XHRDownloaderInfo.XHRRetryFun;
      XHRDownloaderInfo.XHRArr.push(xhr);
      xhr.loadFun(xhr);
    },
    XHRDone: (vid) => {
      let arr = XHRDownloaderInfo.XHRArr;
      if (vid) {
        arr = arr.filter(f => f.data && f.data.vid && vid == f.data.vid);
      }
      return arr.every(e => e.done);
    },
  };
  return [XHRDownloaderInfo.XHRAdd, XHRDownloaderInfo.XHRDone];
};//XHR下载、重试
