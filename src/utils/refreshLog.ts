function RefreshLog() {
  let LogInfo = {
    progressEle: null,//进度、日志 元素；{txt:,img:,err:}
    refreshProgress: (info, err) => {
      if (!LogInfo.progressEle) {
        //epub生成进度，下载文本进度：7/7；下载图片进度：77/77；日志：开始生成ePub;ePub生成完成;
        LogInfo.progressEle = {};
        LogInfo.progressEle.txt = document.createElement("span");
        LogInfo.progressEle.img = document.createElement("span");
        LogInfo.progressEle.err = document.createElement("span");
        let logDiv = document.createElement('div');
        logDiv.appendChild(document.createTextNode("epub生成进度，下载文本进度："));
        logDiv.appendChild(LogInfo.progressEle.txt);
        logDiv.appendChild(document.createTextNode("；下载图片进度："));
        logDiv.appendChild(LogInfo.progressEle.img);
        logDiv.appendChild(document.createTextNode("；日志："));
        logDiv.appendChild(LogInfo.progressEle.err);
        document.body.insertBefore(logDiv, document.getElementById('title'));
      }
      //日志
      if (err) { LogInfo.progressEle.err.innerHTML = err + LogInfo.progressEle.err.innerHTML; }
      //文本进度
      let txtProgress = info.Text.filter((value) => { return value.content; }).length;
      LogInfo.progressEle.txt.innerText = `${txtProgress}/${info.Text.length}`;
      //图片进度，文本下载完成后才能得到图片总数
      if (txtProgress == info.Text.length) {
        let imgProgress = info.Images.filter((value) => { return value.content; }).length;
        LogInfo.progressEle.img.innerText = `${imgProgress}/${info.Images.length}`;
      }
    },//显示进度日志
  };
  return LogInfo.refreshProgress;
};
