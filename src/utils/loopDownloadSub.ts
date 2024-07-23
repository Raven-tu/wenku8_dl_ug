// 循环下载分卷epub
function loopDownloadSub() {
  const elements = document.querySelectorAll('a.ePubSub');
  const linksArray = Array.from(elements);
  const delayNum = Number(document.querySelector("#subNumInput").value)
  function clickLink(index) {
    if (index < linksArray.length) {
      linksArray[index].click();
      console.log(`Clicked link: ${linksArray[index].href}`);
      setTimeout(() => clickLink(index + 1), delayNum * 1000);
    }
  }
  clickLink(0);
}
