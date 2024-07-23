function Builder() {
  const BuilderInfo = {
    mimetype: 'application/epub+zip', // epub mimetype 文件内容
    container_xml, // epub container.xml 文件内容
    nav_xhtml: {
      content: nav_xhtml_content,
      path: `Text/nav.xhtml`,
      id: `nav_xhtml_id`,
    }, // epub nav.xhtml 文件模板
    defaultCSS: {
      content: defaultCSS_content,
      id: 'default_css_id',
      path: 'Styles/default.css',
    }, // epub default.css 样式文件
    contentDocument: null,
    manifest: null,
    spine: null,
    manifestItemAdd: (id, href, mediaType) => {
      const doc = BuilderInfo.contentDocument
      let manifest = BuilderInfo.manifest
      if (!manifest) {
        manifest = doc.createElement('manifest')
        doc.firstChild.appendChild(manifest)
        BuilderInfo.manifest = manifest
      }
      const item = doc.createElement('item')
      if (typeof (id) != 'undefined') {
        item.setAttribute('id', id)
      }
      if (typeof (href) != 'undefined') {
        item.setAttribute('href', href)
      }
      if (typeof (mediaType) != 'undefined') {
        item.setAttribute('media-type', mediaType)
      }
      manifest.appendChild(item)
      return item
    },
    spineItemAdd: (idref) => {
      const doc = BuilderInfo.contentDocument
      let spine = BuilderInfo.spine
      if (!spine) {
        spine = doc.createElement('spine')
        doc.firstChild.appendChild(spine)
        BuilderInfo.spine = spine
      }

      const itemref = doc.createElement('itemref')
      if (typeof (idref) != 'undefined') {
        itemref.setAttribute('idref', idref)
      }
      spine.appendChild(itemref)
      return itemref
    },
    manifestSpineItemAdd: (id, href, mediaType) => {
      const item = BuilderInfo.manifestItemAdd(id, href, mediaType)
      const itemref = BuilderInfo.spineItemAdd(id)

      return [item, itemref]
    },
    buildEpub: (info) => {
      if (info.XHRDone()) {
        if (info.ePubEidt && (!info.ePubEidtDone)) {
          info.refreshProgress(info, `开始编辑ePub;`)
          info.ePubEidterInit(info)
          return
        }

        info.refreshProgress(info, `开始生成ePub;`)
        const zip = new JSZip()
        // epub固定内容
        zip.file('mimetype', BuilderInfo.mimetype)
        zip.file('META-INF/container.xml', BuilderInfo.container_xml)

        let content_opf = `<?xml version="1.0" encoding="utf-8"?><package></package>`
        const paraser = new DOMParser()
        BuilderInfo.contentDocument = paraser.parseFromString(content_opf, 'text/xml')

        // 保存插图位置
        if (info.ePubEidterCfg && info.ePubEidterCfg.ImgLocation && info.ePubEidterCfg.ImgLocation.length > 0) {
          const cfgJson = JSON.stringify(info.ePubEidterCfg, null, '  ')
          zip.file('OEBPS/Other/ePubEidterCfg.json', cfgJson)
        }

        // 保存css
        {
          BuilderInfo.manifestItemAdd(BuilderInfo.defaultCSS.id, BuilderInfo.defaultCSS.path, 'text/css')
          // 保存css
          zip.file(`OEBPS/${BuilderInfo.defaultCSS.path}`, BuilderInfo.defaultCSS.content)
        }

        // 生成并保存nav.xhtml
        // <ol><li><a href="Volume_0.xhtml">第一卷</a><ol><li><a href="Volume_0.xhtml#chapter_1">第一章</a></li></ol></li></ol>
        {
          // 生成nav.xhtml
          const domParser = new DOMParser()
          const navXhtmlDoc = domParser.parseFromString(BuilderInfo.nav_xhtml.content, 'application/xhtml+xml')
          const tocEle = navXhtmlDoc.getElementById('toc')
          const bOlEle = navXhtmlDoc.createElement('ol')
          for (const t of info.nav_toc) {
            // 分卷
            const vAEle = navXhtmlDoc.createElement('a')
            vAEle.href = t.volumeHref
            vAEle.innerText = t.volumeName
            const vLiEle = navXhtmlDoc.createElement('li')
            vLiEle.appendChild(vAEle)
            if (t.chapterArr && t.chapterArr.length > 0) {
              // 分卷的章节
              const vOlEle = navXhtmlDoc.createElement('ol')
              for (const c of t.chapterArr) {
                const cAEle = navXhtmlDoc.createElement('a')
                cAEle.href = c.chapterHref
                cAEle.innerText = c.chapterName
                const cLiEle = navXhtmlDoc.createElement('li')
                cLiEle.appendChild(cAEle)
                vOlEle.appendChild(cLiEle)
              }
              vLiEle.appendChild(vOlEle)
            }
            bOlEle.appendChild(vLiEle)
          }
          tocEle.appendChild(bOlEle)
          const nav_xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>

${navXhtmlDoc.firstChild.outerHTML}`

          // 保存nav.xhtml信息到content.opf
          // manifest节点

          const [item, itemref] = BuilderInfo.manifestSpineItemAdd(
            BuilderInfo.nav_xhtml.id,
            BuilderInfo.nav_xhtml.path,
            'application/xhtml+xml',
          )
          item.setAttribute('properties', 'nav')
          itemref.setAttribute('linear', 'no')
          // 保存nav.xhtml
          zip.file(`OEBPS/${BuilderInfo.nav_xhtml.path}`, nav_xhtml)
        }

        // 保存分卷内容
        for (const t of info.Text) {
          BuilderInfo.manifestSpineItemAdd(t.id, t.path, 'application/xhtml+xml')

          // 转换html为xhtml
          const domParser = new DOMParser()
          const rspHtml = domParser.parseFromString(
            `<html>
<head>
	<meta charset="utf-8"/>
	<title>${t.volumeName}</title>
	<link href="../Styles/default.css" rel="stylesheet" type="text/css"/>
</head>
<body></body>
</html>`
            , 'text/html',
          )
          rspHtml.body.innerHTML = t.content

          // 添加插图并去除拖放标签
          const vLocation = info.ImgLocation.filter(i => t.vid == i.vid)
          const volumeImgs = info.Images.filter(i => i.TextId == t.id)
          const dropEleArr = rspHtml.querySelectorAll('.txtDropEnable')
          for (const dropEle of dropEleArr) {
            // 加载已拖放的图片
            let locArr
            let dImg
            if (vLocation
              && (locArr = vLocation.filter(j => j.spanID == dropEle.id))
            ) {
              for (const loc of locArr) {
                if (dImg = volumeImgs.find(j => j.idName == loc.imgID)) {
                  const divimage = rspHtml.createElement('div')
                  divimage.className = 'divimage'

                  const imgEle = rspHtml.createElement('img')
                  imgEle.setAttribute('loading', 'lazy')
                  imgEle.setAttribute('src', `../${dImg.path}`)
                  divimage.innerHTML = imgEle.outerHTML

                  dropEle.parentNode.insertBefore(divimage, dropEle)
                }
              }
            }
            // 去除文字span
            dropEle.parentNode.insertBefore(dropEle.firstChild, dropEle)
            dropEle.parentNode.removeChild(dropEle)
          }

          // 转换html为xhtml
          const xmlSerializer = new XMLSerializer()
          const rspXml = xmlSerializer.serializeToString(rspHtml)
          const rspXHtml = domParser.parseFromString(rspXml, 'application/xhtml+xml')
          rspXHtml.firstChild.setAttribute('xmlns:epub', 'http://www.idpf.org/2007/ops')
          // 保存章节内容，作为epub资源
          const tContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>

${rspXHtml.firstChild.outerHTML}`

          zip.file(`OEBPS/${t.path}`, tContent)
        }
        // 保存图片
        for (const t of info.Images) {
          // media-type暂固定jpeg
          BuilderInfo.manifestItemAdd(t.id, t.path, 'image/jpeg')
          zip.file(`OEBPS/${t.path}`, t.content, { binary: true })
        }

        // 生成书籍信息
        let coverMeta = ''
        if (info.Images.length > 0) {
          let coverImg = info.Images.find(i => i.coverImg)
          if (!coverImg) {
            coverImg = info.Images.find(i => i.coverImgChk)
          }
          if (!coverImg) {
            coverImg = info.Images.find(i => i.smallCover)
          }
          if (coverImg) {
            coverMeta = `<meta name="cover" content="${coverImg.id}" />`
          }
        }

        const uuid = self.crypto.randomUUID()
        // CCYY-MM-DDThh:mm:ssZ
        let createTime = new Date().toISOString()
        createTime = `${createTime.split('.')[0]}Z`
        // <?xml version="1.0" encoding="utf-8"?>
        content_opf = `<?xml version="1.0" encoding="utf-8"?>
<package version="3.0" unique-identifier="BookId" xmlns="http://www.idpf.org/2007/opf">
	<metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
		<dc:language>zh-CN</dc:language>
		<dc:title>${info.title}.${info.nav_toc[0].volumeName}</dc:title>
		<meta property="dcterms:modified">${createTime}</meta>
		<dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
		<dc:creator>${info.creator}</dc:creator>
		<!--第一张插图做封面-->
		${coverMeta}
	</metadata>
	${BuilderInfo.manifest.outerHTML}
	${BuilderInfo.spine.outerHTML}
</package>`
        zip.file('OEBPS/content.opf', content_opf)
        // 书名.开始卷-结束卷.epub
        let epubName = `${info.title}.${info.nav_toc[0].volumeName}`
        if (info.nav_toc.length > 1) {
          epubName = `${epubName}-${info.nav_toc[info.nav_toc.length - 1].volumeName}`
        }
        saveAs(zip.generate({ type: 'blob', mimeType: 'application/epub+zip' }), `${epubName}.epub`)
        info.refreshProgress(info, `ePub生成完成,文件名：${epubName}.epub；`)
      }
      else {
        info.refreshProgress(info)
      }
    }, // 生成epub，如果XHRArr已经都完成了
  }
  return BuilderInfo.buildEpub
};// epub生成
