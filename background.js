// Background Service Worker
console.log('Frontend Debug Helper background service worker loaded');

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOG_CHANGE') {
    console.log('Change detected:', request.data);
  }

  sendResponse({ success: true });
  return true;
});

// 扩展安装或更新时
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Frontend Debug Helper installed');
  } else if (details.reason === 'update') {
    console.log('Frontend Debug Helper updated');
  }
});
