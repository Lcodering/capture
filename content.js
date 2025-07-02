function captureVisibleTab() {
  chrome.runtime.sendMessage({ action: 'capture' });
}

function captureFullPage() {
  const body = document.body;
  const html = document.documentElement;
  const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);

  window.scrollTo(0, 0);

  const capture = () => {
    if (window.scrollY + window.innerHeight < height) {
      window.scrollBy(0, window.innerHeight);
      setTimeout(capture, 300);
    } else {
      chrome.runtime.sendMessage({ action: 'capture' });
    }
  };

  capture();
}

captureVisibleTab(); // For visible area

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'performStitch') {
    stitchImages(request.images)
      .then(finalImage => {
        sendResponse({ finalImage });
      })
      .catch(error => {
        console.error('Error stitching images:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
});

// 图像拼接函数
async function stitchImages(images) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const imgElements = await Promise.all(images.map(loadImage));

  const totalHeight = imgElements.reduce((sum, img) => sum + img.height, 0);
  const maxWidth = Math.max(...imgElements.map(img => img.width));

  canvas.width = maxWidth;
  canvas.height = totalHeight;

  let yOffset = 0;
  imgElements.forEach(img => {
    ctx.drawImage(img, 0, yOffset);
    yOffset += img.height;
  });

  return canvas.toDataURL('image/png');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
