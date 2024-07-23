function EPubEidter() {
  let EPubEidterInfo = {
    Domain: "www.wenku8.net",
    novelTable: null,
    ePubEidterCfg: {
      UID: ePubEidterCfgUID,
      aid: article_id,
      pathname: hrefUrl.pathname,
      ImgLocation: []
    },//插图位置配置
    ePubEidtImgRegExp: [/img/i, /插图/i, /插圖/i, /\.jpg/i, /\.png/i],//推测插图位置的正则
    ePubEidtLink: [],
    ePubEidt: false,
    ePubEidtDone: false,
    ePubEidterHtml: ePubEidterHtml,//编辑器html代码
    ePubEidter: null,
    ePubEidterLastVolumeUL: null,
    ePubEidterInit: (info) => {
      //隐藏目录
      let downloadEleArr = document.querySelectorAll(".DownloadAll");
      for (let f of downloadEleArr) {
        f.style.pointerEvents = "none";
      }
      EPubEidterInfo.novelTable = document.body.getElementsByTagName("table")[0];
      EPubEidterInfo.novelTable.style.display = "none";

      //加载编辑器、样式
      let linkEle = document.createElement("link");
      linkEle.type = "text/css";
      linkEle.rel = "stylesheet";
      linkEle.href = "/themes/wenku8/style.css";
      document.head.appendChild(linkEle);
      EPubEidterInfo.ePubEidtLink.push(linkEle);

      let divEle = document.createElement("div");
      divEle.id = "ePubEidter";
      divEle.style.display = "none";
      linkEle.onload = () => {
        //显示编辑器
        divEle.style.display = "";
      };
      divEle.innerHTML = EPubEidterInfo.ePubEidterHtml;
      EPubEidterInfo.ePubEidter = divEle;

      EPubEidterInfo.novelTable.parentElement.insertBefore(divEle, info.novelTable);
      document.getElementById("EidterBuildBtn").addEventListener("click", EPubEidterInfo.ePubEidterDoneFun(info));
      document.getElementById("EidterImportBtn").addEventListener("click", EPubEidterInfo.ePubEidterImportCfgFun(info));
      document.getElementById("VolumeImg").addEventListener("drop", EPubEidterInfo.ePubEidterImgDelDropFun(info));

      //加载配置内容
      let cfgAreaEle = document.getElementById("CfgArea");
      EPubEidterInfo.ePubEidterCfg.ImgLocation = info.ImgLocation;
      cfgAreaEle.value = JSON.stringify(EPubEidterInfo.ePubEidterCfg, null, "  ");

      //加载分卷列表
      let liEleFirst = null;
      let VolumeULEle = document.getElementById("VolumeUL");
      VolumeULEle.innerHTML = "";
      for (let i = 0; i < info.Text.length; i++) {
        let text = info.Text[i];
        let liEle = document.createElement("li");
        VolumeULEle.appendChild(liEle);
        let aEle = document.createElement("a");
        liEle.appendChild(aEle);
        aEle.href = "javascript:void(0);";
        aEle.id = text.id;
        aEle.innerText = text.volumeName;
        liEle.addEventListener("click", EPubEidterInfo.ePubEidterVolumeULFun(info, text));
        if (!liEleFirst) {
          liEleFirst = liEle;
        }
      }

      //加载第一卷
      if (liEleFirst) {
        liEleFirst.click();
      }
    },//编辑器初始化
    ePubEidterDestroyer: () => {
      EPubEidterInfo.ePubEidter.parentElement.removeChild(EPubEidterInfo.ePubEidter);
      EPubEidterInfo.ePubEidtLink.forEach(f => f.parentElement.removeChild(f));
      EPubEidterInfo.novelTable = document.body.getElementsByTagName("table")[0];
      EPubEidterInfo.novelTable.style.display = "";
      EPubEidterInfo = null;
      let downloadEleArr = document.querySelectorAll(".DownloadAll");
      for (let f of downloadEleArr) {
        f.style.pointerEvents = "auto";
      }
    },//编辑器销毁
    ePubEidterDoneFun: (info) => {
      return (ev) => {
        ev.currentTarget.disabled = true;
        //生成ePub
        info.ePubEidtDone = true;
        info.buildEpub(info);

        //发送配置
        let sendArticleEle = document.getElementById('SendArticle');
        if (sendArticleEle.checked && 0 < info.ImgLocation.length) {
          let cfgObj = Object.assign({}, EPubEidterInfo.ePubEidterCfg);
          //压缩位置
          let imgLocJson = JSON.stringify(info.ImgLocation);
          let zip = new JSZip();
          zip.file(ImgLocationFile, imgLocJson, {
            compression: "DEFLATE",
            compressionOptions: {
              level: 9
            }
          });
          let imgLocBase64 = zip.generate({ type: "base64", mimeType: "application/zip" });
          cfgObj.ImgLocation = null;
          cfgObj.ImgLocationBase64 = imgLocBase64;

          let cfgJson = JSON.stringify(cfgObj);

          let vidSet = new Set();
          let vName = [];
          for (let loc of info.ImgLocation) {
            if (!vidSet.has(loc.vid)) {
              vidSet.add(loc.vid);
              let nToc = info.nav_toc.find(f => loc.vid == f.vid);
              if (nToc) {
                vName.push(nToc.volumeName);
              }
            }
          }

          let pcontent = `包含分卷列表：${vName}
[code]${cfgJson}[/code]`;

          let map = new Map();
          map.set("ptitle", "ePub插图位置");
          map.set("pcontent", pcontent);
          let url = `https://${EPubEidterInfo.Domain}/modules/article/reviews.php?aid=${info.aid}`;
          //发送配置
          EPubEidterInfo.ePubEidterSend(info, url, map);
        }
        let ePubEditerClose = document.getElementById('ePubEditerClose');
        ev.currentTarget.disabled = false;
        if (ePubEditerClose.checked) {
          EPubEidterInfo.ePubEidterDestroyer();
        }
      };
    },//点击生成ePub事件
    ePubEidterImportCfgFun: (info) => {
      return (ev) => {
        ev.currentTarget.disabled = true;
        let cfgAreaEle = document.getElementById("CfgArea");
        let impCfg;
        try { impCfg = JSON.parse(cfgAreaEle.value); } catch { }
        if (impCfg
          && impCfg.UID == EPubEidterInfo.ePubEidterCfg.UID
          && impCfg.aid == EPubEidterInfo.ePubEidterCfg.aid
          && impCfg.ImgLocation
          && 0 < impCfg.ImgLocation.length
        ) {
          for (let iCfg of impCfg.ImgLocation) {
            if (info.ImgLocation.find(i =>
              i.spanID == iCfg.spanID
              && i.vid == iCfg.vid
              && i.imgID == iCfg.imgID)
            ) {
              continue;
            }
            else if (!info.Text.find(f => f.vid == iCfg.vid)) {
              continue;
            }
            else {
              info.ImgLocation.push(iCfg);
            }
          }
        }
        EPubEidterInfo.ePubEidterCfg.ImgLocation = info.ImgLocation;
        cfgAreaEle.value = JSON.stringify(EPubEidterInfo.ePubEidterCfg, null, "  ");
        if (EPubEidterInfo.ePubEidterLastVolumeUL) {
          EPubEidterInfo.ePubEidterLastVolumeUL.click();
        }
        ev.currentTarget.disabled = false;
      };
    },//点击导入配置事件
    ePubEidterVolumeULFun: (info, text) => {
      return (ev) => {
        //最后点击的章节列表，导入配置后刷新
        if (EPubEidterInfo.ePubEidterLastVolumeUL) {
          EPubEidterInfo.ePubEidterLastVolumeUL.firstElementChild.style.color = "";
        }
        EPubEidterInfo.ePubEidterLastVolumeUL = ev.currentTarget;
        EPubEidterInfo.ePubEidterLastVolumeUL.firstElementChild.style.color = "fuchsia";

        //加载文本内容
        let VolumeTextEle = document.getElementById("VolumeText");
        VolumeTextEle.style.display = "none";
        VolumeTextEle.innerHTML = text.content;

        //加载图片列表
        let imgEleMap = new Map();
        let VolumeImgEle = document.getElementById("VolumeImg");
        VolumeImgEle.innerHTML = "";
        let volumeImgs = info.Images.filter(i => i.TextId == text.id);
        for (let image of volumeImgs) {
          if (!image.ObjectURL) {
            image.Blob = new Blob([image.content], { type: "image/jpeg" });
            image.ObjectURL = URL.createObjectURL(image.Blob);
          }
          let imgDivEle = document.createElement("div");
          imgDivEle.style.float = "left";
          imgDivEle.style.textAlign = "center";
          imgDivEle.style.height = "155px";
          imgDivEle.style.overflow = "hidden";
          imgDivEle.style.margin = "0 2px";
          VolumeImgEle.appendChild(imgDivEle);
          let imgEle = document.createElement("img");
          imgEle.setAttribute("imgID", image.idName);
          imgEle.setAttribute("loading", "lazy");
          imgEle.src = image.ObjectURL;
          imgEle.height = 127;
          //加载用
          imgEleMap.set(image.idName, imgEle);
          imgDivEle.appendChild(imgEle);
          imgDivEle.appendChild(document.createElement("br"));
          let imgTextEle = new Text(image.id)
          imgDivEle.appendChild(imgTextEle);

          //<div style="float: left; text-align: center; height: 155px; overflow: hidden; margin: 0 2px;">
          //	<img id="Img_160408" src="./160408.jpg" border="0" height="127"><br>
          //</div>
        }

        //推测插图处置
        let ImgULEle = document.getElementById("ImgUL");
        ImgULEle.innerHTML = "";
        //加载已拖放的图片
        let vLocation = info.ImgLocation.filter(i => text.vid == i.vid);
        //拖放处理绑定
        let dropEleArr = document.querySelectorAll(".txtDropEnable");
        for (let dropEle of dropEleArr) {
          dropEle.addEventListener("drop", EPubEidterInfo.ePubEidterImgDropFun(info, text));

          //加载已拖放的图片
          let locArr;
          let dImgEle;
          if (vLocation && (locArr = vLocation.filter(j => j.spanID == dropEle.id))) {
            for (let loc of locArr) {
              if (dImgEle = imgEleMap.get(loc.imgID)) {
                let divimage = document.createElement("div");
                divimage.className = "divimageM";
                divimage.innerHTML = dImgEle.outerHTML;
                dropEle.parentNode.insertBefore(divimage, dropEle);
                //添加拖放开始事件，用于删除拖放的标签
                let dropImg = divimage.firstChild;
                dropImg.id = `${loc.spanID}_${loc.imgID}`;
                dropImg.addEventListener("dragstart", EPubEidterInfo.ePubEidterImgDelStartFun(info, loc));
              }
            }
          }
          //章节名不测试
          if (!dropEle.firstElementChild || "chaptertitle" != dropEle.firstElementChild.className) {
            //匹配插图正则
            for (let reg of EPubEidterInfo.ePubEidtImgRegExp) {
              if (reg.test(dropEle.innerText)) {
                let liEle = document.createElement("li");
                ImgULEle.appendChild(liEle);
                let aEle = document.createElement("a");
                liEle.appendChild(aEle);
                aEle.href = "javascript:void(0);";
                aEle.setAttribute("SpanID", dropEle.id);
                aEle.innerText = dropEle.innerText.replace(/\s/g, '').substring(0, 12);
                liEle.addEventListener("click", EPubEidterInfo.ePubEidterImgULFun(info, dropEle));
                dropEle.style.color = "fuchsia";//fontWeight = "bold";
                break;
              }
            }
          }
        }

        //加载章节列表
        let ChapterULEle = document.getElementById("ChapterUL");
        ChapterULEle.innerHTML = "";
        let toc = info.nav_toc.find(i => i.volumeID == text.id);
        for (let chapter of toc.chapterArr) {

          let liEle = document.createElement("li");
          ChapterULEle.appendChild(liEle);
          let aEle = document.createElement("a");
          liEle.appendChild(aEle);
          aEle.href = "javascript:void(0);";
          aEle.setAttribute("chapterID", chapter.chapterID);
          aEle.innerText = chapter.chapterName;
          liEle.addEventListener("click", EPubEidterInfo.ePubEidterChapterULFun(info, chapter));
        }

        VolumeTextEle.style.display = "";
        //滚动到分卷开始
        VolumeTextEle.scroll({ top: 0 });
        VolumeImgEle.scroll({ top: 0 });
      };
    },//点击分卷事件
    ePubEidterImgDropFun: (info, text) => {
      return (ev) => {
        const data = ev.dataTransfer.getData("text/html");
        let divimage = document.createElement("div");
        divimage.className = "divimageM";
        divimage.innerHTML = data;
        let dropImg = divimage.firstChild;
        let imgLocation = { "vid": text.vid, "spanID": ev.currentTarget.id, "imgID": dropImg.getAttribute("imgID") };

        if (info.ImgLocation.find(i =>
          i.spanID == imgLocation.spanID
          && i.vid == imgLocation.vid
          && i.imgID == imgLocation.imgID)
        ) {
          alert("此位置已存在相同的图片");
        }
        else {
          ev.currentTarget.parentNode.insertBefore(divimage, ev.currentTarget);
          info.ImgLocation.push(imgLocation);
          //添加拖放开始事件，用于删除拖放的标签
          dropImg.id = `${imgLocation.spanID}_${imgLocation.imgID}`;
          dropImg.addEventListener("dragstart", EPubEidterInfo.ePubEidterImgDelStartFun(info, imgLocation));

          EPubEidterInfo.ePubEidterCfg.ImgLocation = info.ImgLocation;
          let cfgAreaEle = document.getElementById("CfgArea");
          cfgAreaEle.value = JSON.stringify(EPubEidterInfo.ePubEidterCfg, null, "  ");
          //JSON.parse(cfgAreaEle.value);
        }
      }
    },//插图拖放完成事件
    ePubEidterChapterULFun: (info, chapter) => {
      return (ev) => {
        let VolumeTextEle = document.getElementById("VolumeText");
        let target = document.getElementById(chapter.chapterID);
        VolumeTextEle.scroll({
          top: target.offsetTop,
          behavior: 'smooth'
        });
        //(document.getElementById(chapter.chapterID)).scrollIntoView();
      }
    },//点击章节事件
    ePubEidterImgULFun: (info, dropEle) => {
      return (ev) => {
        let VolumeTextEle = document.getElementById("VolumeText");
        VolumeTextEle.scroll({
          top: dropEle.offsetTop - 130,
          behavior: 'smooth'
        });
      }
    },//点击推测插图位置事件
    ePubEidterSend: (info, url, map) => {
      let iframeEle = document.createElement("iframe");
      iframeEle.style.display = 'none';
      document.body.appendChild(iframeEle);
      let iBodyEle = iframeEle.contentWindow.document.body;
      let iDocument = iframeEle.contentWindow.document;

      let formEle = iDocument.createElement("form");
      formEle.acceptCharset = "gbk";
      formEle.method = "POST";
      formEle.action = url;
      iBodyEle.appendChild(formEle);
      for (let [mk, mv] of map) {
        let inputEle = iDocument.createElement("input");
        inputEle.type = "text";
        inputEle.name = mk;
        inputEle.value = mv;
        formEle.appendChild(inputEle);
      }
      let subEle = iDocument.createElement("input");
      subEle.type = "submit";
      subEle.name = "submit";
      subEle.value = "submit";
      formEle.appendChild(subEle);
      subEle.click();
    },//发送Post请求，无需转gbk
    ePubEidterImgDelDropFun: (info) => {
      return (ev) => {
        let vid = ev.dataTransfer.getData("vid");
        let spanID = ev.dataTransfer.getData("spanID");
        let imgID = ev.dataTransfer.getData("imgID");
        let fromID = ev.dataTransfer.getData("fromID");
        let fromEle = document.getElementById(fromID);
        if (fromEle && "divimageM" == fromEle.parentElement.className) {
          info.ImgLocation =
            info.ImgLocation.filter(i => !(i.spanID == spanID && i.vid == vid && i.imgID == imgID));

          EPubEidterInfo.ePubEidterCfg.ImgLocation = info.ImgLocation;
          let cfgAreaEle = document.getElementById("CfgArea");
          cfgAreaEle.value = JSON.stringify(EPubEidterInfo.ePubEidterCfg, null, "  ");

          fromEle.parentElement.parentElement.removeChild(fromEle.parentElement);
        }
      }
    },//插图拖放完成事件
    ePubEidterImgDelStartFun: (info, imgLocation) => {
      return (ev) => {
        ev.dataTransfer.setData("vid", imgLocation.vid);
        ev.dataTransfer.setData("spanID", imgLocation.spanID);
        ev.dataTransfer.setData("imgID", imgLocation.imgID);
        ev.dataTransfer.setData("fromID", ev.srcElement.id);
      }
    },//插图拖放开始事件
  };
  return [EPubEidterInfo.ePubEidterInit, EPubEidterInfo.ePubEidterCfg];
};//epub编辑器，拖动调整插图位置
