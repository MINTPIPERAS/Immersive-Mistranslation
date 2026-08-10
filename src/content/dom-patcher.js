/**
 * DOM 补丁器：备份原文、替换节点文本、恢复原文
 */

export const originalTexts = new Map();

export function backup(node) {
  if (!originalTexts.has(node)) {
    originalTexts.set(node, node.textContent);
  }
  return originalTexts.get(node);
}

export function apply(node, text) {
  if (node && node.textContent !== text) {
    node.textContent = text;
  }
}

export function restoreAll() {
  for (const [node, original] of originalTexts) {
    if (node && node.parentNode) {
      node.textContent = original;
    }
  }
  originalTexts.clear();
}

export function hasBackup() {
  return originalTexts.size > 0;
}
