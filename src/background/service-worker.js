import { initApiHandler } from './api-handler.js';

const VERSION = '1.0.0-baidu';

chrome.runtime.onInstalled.addListener(() => {
  console.log(`[乱翻译] 扩展已安装/更新，版本: ${VERSION}`);
});

chrome.runtime.onStartup.addListener(() => {
  console.log(`[乱翻译] 浏览器启动，服务脚本加载，版本: ${VERSION}`);
});

console.log(`[乱翻译] Service Worker 启动，版本: ${VERSION}`);

initApiHandler();
