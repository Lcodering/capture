// 截取网页
document.getElementById('captureVisible').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;

    if (!url.startsWith('chrome://')) {
      chrome.runtime.sendMessage({ action: 'capture' }, (response) => {
        if (response && response.image) {
          const imageUrl = response.image;
          chrome.tabs.create({ url: chrome.runtime.getURL('edit.html') }, (tab) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
              if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                chrome.tabs.sendMessage(tabId, { action: 'editImage', image: imageUrl });
              }
            });
          });
        }
      });
    } else {
      console.error('Cannot execute script on this page.');
    }
    });
  });

// ... 保持 captureVisible 部分不变 ...
document.getElementById('captureFull').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const body = document.body;
        const html = document.documentElement;
        const totalHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
        const viewportHeight = window.innerHeight;
        let scrollY = 0;
        const images = [];

        const capture = () => {
          if (scrollY < totalHeight) {
            window.scrollTo(0, scrollY);
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'capture' }, (response) => {
                if (response && response.image) {
                  images.push(response.image);
                  scrollY += viewportHeight;
                  capture();
                } else {
                  console.error('Error capturing image');
                }
              });
            }, 300);
          } else {
            // 滚动回顶部
            window.scrollTo(0, 0);
            // 发送所有图片进行拼接
            chrome.runtime.sendMessage({ action: 'stitch', images }, (response) => {
              if (response && response.finalImage) {
                const link = document.createElement('a');
                link.href = response.finalImage;
                link.download = 'full_screenshot.png';
                link.click();
              } else {
                console.error('Error stitching images:', response?.error);
              }
            });
          }
        };

        capture();
      }
    });
  });
});
  
  
  