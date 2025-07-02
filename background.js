chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    chrome.tabs.captureVisibleTab(null, {}, (image) => {
      sendResponse({ image });
    });
    // Ensure the sendResponse is called asynchronously
    return true;
  } else if (request.action === 'stitch') {
    // 确保在发送消息前先注入content脚本
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ['content.js']
    }, () => {
      // 脚本注入后再发送消息
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'performStitch',
        images: request.images
      }, (response) => {
        sendResponse(response);
      });
    });
    return true;
  }
});

