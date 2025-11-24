// 创建DevTools面板
chrome.devtools.panels.create(
  'Debug Helper',
  'icons/icon48.png',
  'panel.html',
  (panel) => {
    console.log('Frontend Debug Helper panel created');

    // 面板显示时的回调
    panel.onShown.addListener((window) => {
      console.log('Panel shown');
    });

    // 面板隐藏时的回调
    panel.onHidden.addListener(() => {
      console.log('Panel hidden');
    });
  }
);
