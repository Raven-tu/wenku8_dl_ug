function LoadVolume() {
  let LoadVolumeInfo = {
    imgDomain: 'img.wenku8.com',
    appApiLoadVolume: AppApi(),//调用app接口下载文档
    loadVolume: (xhr) => {
      let navToc = xhr.bookInfo.nav_toc[xhr.VolumeIndex];
      let msg = `${navToc.volumeName} 下载失败，重新下载;`;
      xhr.start = true;
      GM_xmlhttpRequest({
        method: 'GET',
        url: xhr.url,
        onload: function (response) {
          if (response.status == 200) {
            xhr.done = true;
            LoadVolumeInfo.dealVolume(xhr, response.responseText);
          }
          //部分小说会404，用app接口
          else if (404 == response.status) {
            xhr.dealVolume = LoadVolumeInfo.dealVolume;
            LoadVolumeInfo.appApiLoadVolume(xhr);
          }
          else {
            //重新下载
            xhr.XHRRetryFun(xhr, msg);
          }
        },
        onerror: () => {
          //重新下载
          xhr.XHRRetryFun(xhr, msg);
        }
      });
    },//分卷下载
    ImagesFix: "Img",//图片文件、ID前缀
    SpanFix: "Txt",//文字ID前缀
    loadImg: (xhr) => {
      xhr.start = true;
      let msg = `${xhr.images.idName} 下载失败，重新下载;`;
      GM_xmlhttpRequest({
        method: 'GET',
        url: xhr.url,
        responseType: "arraybuffer",
        onload: function (response) {
          if (response.status == 200) {
            xhr.images.content = response.response;
            if (xhr.images.coverImgChk && (!xhr.bookInfo.Images.find(i => i.coverImg))) {
              xhr.images.Blob = new Blob([xhr.images.content], { type: "image/jpeg" });
              xhr.images.ObjectURL = URL.createObjectURL(xhr.images.Blob);
              let imgEle = new Image();
              imgEle.onload = () => {
                //高比宽大于1就能做封面
                xhr.images.coverImg = (imgEle.naturalHeight / imgEle.naturalWidth > 1);
                xhr.done = true;
                xhr.bookInfo.buildEpub(xhr.bookInfo);
              };
              imgEle.src = xhr.images.ObjectURL;
            }
            else {
              xhr.done = true;
              xhr.bookInfo.buildEpub(xhr.bookInfo);
            }
          } else {
            //重新下载
            xhr.XHRRetryFun(xhr, msg);
          }
        },
        onerror: () => {
          //重新下载
          xhr.XHRRetryFun(xhr, msg);
        }
      });
    },//图片下载
    dealVolume: (xhr, txt) => {
      let chapterIndex = 0;
      let ImagesIndex = 0;
      let TextIndex = 0;
      let Text = xhr.data.Text;
      let navToc = Text.navToc;

      //https://developer.mozilla.org/zh-CN/docs/Web/Guide/Parsing_and_serializing_XML
      //下载分卷文本，转换为html
      let domParser = new DOMParser();
      let rspHtml = domParser.parseFromString(
        `<html>
<head>
	<meta charset="utf-8"/>
	<title>${xhr.data.vcssText}</title>
	<link href="../Styles/default.css" rel="stylesheet" type="text/css"/>
</head>
<body><div class="volumetitle"><h2>${xhr.data.vcssText}</h2></div><br /></body>
</html>`, "text/html");
      rspHtml.body.innerHTML += txt;

      //调用简转繁
      if (currentEncoding != targetEncoding) {
        translateBody(rspHtml.body);
      }

      //HTML DOM 中的 HTMLCollection 是即时更新的（live）；当其所包含的文档结构发生改变时，它会自动更新。
      //因此，最好是创建副本（例如，使用 Array.from）后再迭代这个数组以添加、移动或删除 DOM 节点。
      let removeChild = [];
      //处理章节、插图 和 contentdp
      let bodyChildArr = Array.from(rspHtml.body.children);
      for (let i = 0; i < bodyChildArr.length; i++) {
        let child = bodyChildArr[i];
        if ("UL" == child.tagName && "contentdp" == child.id) {
          removeChild.push(child);
        }
        //章节
        else if ("DIV" == child.tagName && "chaptertitle" == child.className) {
          chapterIndex++;
          //章节h3、分卷h2、书名h1（没有做）
          //<div class="chaptertitle"><div id="chapter_1" name="xxx"><h3>第一章</h3></div></div>
          let cTitle = child.innerText;
          if (child.firstChild.hasAttribute("name")) {
            child.firstChild.remove("name");
          }
          //let aName = child.firstChild.getAttribute("name");
          let divEle = document.createElement("div");
          divEle.id = `chapter_${chapterIndex}`;
          //divEle.setAttribute("name", aName);
          divEle.innerHTML = `<h3>${cTitle}</h3>`;
          child.innerHTML = divEle.outerHTML;
          if (navToc) {
            //添加章节导航
            navToc.chapterArr.push({
              chapterName: cTitle
              , chapterID: divEle.id
              , chapterHref: `${navToc.volumeHref}#${divEle.id}`
            });
          }
          //章节名接受拖放
          let txtSpan = rspHtml.createElement("span");
          txtSpan.id = `${LoadVolumeInfo.SpanFix}_${divEle.id}`;
          txtSpan.className = "txtDropEnable";
          txtSpan.setAttribute("ondragover", "return false");
          child.parentElement.insertBefore(txtSpan, child);
          txtSpan.appendChild(child);
        }
        //内容
        else if ("DIV" == child.tagName && "chaptercontent" == child.className) {
          let chapterChildArr = Array.from(child.childNodes);
          for (let j = 0; j < chapterChildArr.length; j++) {
            let contentChild = chapterChildArr[j];
            //文字
            if (Node.TEXT_NODE == contentChild.nodeType && contentChild.textContent != '\n') {
              TextIndex++;
              let txtSpan = rspHtml.createElement("span");
              txtSpan.id = `${LoadVolumeInfo.SpanFix}_${xhr.VolumeIndex}_${TextIndex}`;
              txtSpan.className = "txtDropEnable";
              txtSpan.setAttribute("ondragover", "return false");
              child.insertBefore(txtSpan, contentChild);
              txtSpan.appendChild(contentChild);
            }
            //插图
            else if ("DIV" == contentChild.tagName && "divimage" == contentChild.className) {//插图
              //取得插图下载地址
              let imgASrc = contentChild.getAttribute("title");
              let imgUrl = new URL(imgASrc);
              let imgPath = `Images${imgUrl.pathname}`;
              let imgURL = new URL(imgASrc);
              let pathNameArr = imgURL.pathname.split('/');
              let imgIdName = pathNameArr[pathNameArr.length - 1];
              //在html中加入img标签
              let imgEle = document.createElement("img");
              imgEle.setAttribute("loading", "lazy");
              imgEle.setAttribute("src", `../${imgPath}`);
              contentChild.innerHTML = imgEle.outerHTML;
              //记录图片信息作为epub资源
              ImagesIndex++;
              let ImagesID = `${LoadVolumeInfo.ImagesFix}_${xhr.VolumeIndex}_${ImagesIndex}`;
              let images = { path: `${imgPath}`, content: null, id: ImagesID, idName: imgIdName, TextId: Text.id };
              //封面候补 第一卷的前两张图，高/宽 > 1
              if (0 == xhr.VolumeIndex && 3 > ImagesIndex) {
                images.coverImgChk = true;
              }
              xhr.bookInfo.Images.push(images);
              //添加图片下载xhr请求
              let xhrImg = { start: false, done: false, url: imgASrc, loadFun: LoadVolumeInfo.loadImg, images: images, bookInfo: xhr.bookInfo };

              xhr.bookInfo.XHRAdd(xhrImg);
            }
          }
        }
      }
      removeChild.forEach(c => rspHtml.body.removeChild(c));


      Text.content = rspHtml.body.innerHTML;

      //没有图片则添加书籍缩略图
      if (xhr.bookInfo.Images.length == 0) {
        let pathArry = location.pathname.replace('novel', 'image').split('/');
        pathArry.pop();
        let ImagesID = `${pathArry.findLast(e => e)}s`;
        pathArry.push(`${ImagesID}.jpg`);
        let imgASrc = `https://${LoadVolumeInfo.imgDomain}${pathArry.join('/')}`;
        let imgUrl = new URL(imgASrc);
        let imgPath = `Images${imgUrl.pathname}`;

        let images = { path: `${imgPath}`, content: null, id: ImagesID, idName: ImagesID, TextId: "", smallCover: true };
        xhr.bookInfo.Images.push(images);
        //添加图片下载xhr请求
        let xhrImg = { start: false, done: false, url: imgASrc, loadFun: LoadVolumeInfo.loadImg, images: images, bookInfo: xhr.bookInfo };

        xhr.bookInfo.XHRAdd(xhrImg);
      }

      //生成epub，还有资源未下载则只更新生成进度
      xhr.bookInfo.buildEpub(xhr.bookInfo);
    },
  };
  return LoadVolumeInfo.loadVolume;
};//下载分卷内容及插图
