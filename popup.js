// Popup脚本
document.addEventListener("DOMContentLoaded", () => {
  // 检测操作系统 - 更全面的检测
  const platform = navigator.platform.toUpperCase();
  const userAgent = navigator.userAgent.toUpperCase();

  // 判断是否为Mac系统
  const isMac =
    platform.indexOf("MAC") >= 0 ||
    userAgent.indexOf("MAC") >= 0 ||
    platform.indexOf("DARWIN") >= 0;

  // 判断是否为Windows系统
  const isWindows =
    platform.indexOf("WIN") >= 0 || userAgent.indexOf("WIN") >= 0;

  // 判断是否为Linux系统
  const isLinux =
    platform.indexOf("LINUX") >= 0 || userAgent.indexOf("LINUX") >= 0;

  // 根据系统设置快捷键
  let shortcutKey, shortcutKeyAlt, osName;

  if (isMac) {
    shortcutKey = "Cmd+Option+I";
    shortcutKeyAlt = "Cmd+Option+J";
    osName = "macOS";
  } else if (isWindows) {
    shortcutKey = "F12";
    shortcutKeyAlt = "Ctrl+Shift+I";
    osName = "Windows";
  } else if (isLinux) {
    shortcutKey = "F12";
    shortcutKeyAlt = "Ctrl+Shift+I";
    osName = "Linux";
  } else {
    // 默认使用F12
    shortcutKey = "F12";
    shortcutKeyAlt = "Ctrl+Shift+I";
    osName = "Unknown";
  }

  console.log(
    `Detected OS: ${osName}, Platform: ${platform}, Shortcut: ${shortcutKey}`
  );

  // 更新页面中的快捷键显示
  const shortcutKeyElement = document.getElementById("shortcutKey");
  if (shortcutKeyElement) {
    shortcutKeyElement.textContent = shortcutKey;
  }

  const shortcutKeyTipElement = document.getElementById("shortcutKeyTip");
  if (shortcutKeyTipElement) {
    shortcutKeyTipElement.textContent = shortcutKey;
  }

  // 打开DevTools按钮
  document.getElementById("openDevTools").addEventListener("click", () => {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 根据系统生成不同的提示消息
        let message;
        if (isMac) {
          message = `请按 ${shortcutKey} 或 ${shortcutKeyAlt} 打开开发者工具\n\n然后在顶部标签栏找到 "Debug Helper" 标签！`;
        } else {
          message = `请按 ${shortcutKey} 或 ${shortcutKeyAlt} 键打开开发者工具\n\n然后在顶部标签栏找到 "Debug Helper" 标签！`;
        }
        alert(message);
      }
    });
  });

  // 查看文档按钮
  document.getElementById("docsBtn").addEventListener("click", () => {
    // 打开文档页面
    chrome.tabs.create({
      url: "https://github.com/chenqinyang1994/frontend-debug-helper",
    });
  });

  // 故障排查链接
  document.getElementById("troubleshootLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: "https://github.com/chenqinyang1994/frontend-debug-helper#troubleshooting",
    });
  });

  // 检查当前页面是否注入了content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "PING" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script未注入
          console.log("Content script not injected");
        } else {
          console.log("Content script is active");
        }
      });
    }
  });
});
