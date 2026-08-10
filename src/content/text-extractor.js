/**
 * 文本节点提取器
 */
import { MIN_TEXT_LENGTH, IGNORED_TAGS } from '../shared/constants.js';

const INPUT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];

export function isIgnoredElement(element) {
  if (!element) return true;
  // 排除插件自己的进度浮层及其内部元素
  if (element.closest && element.closest('#immersive-mistranslation-progress')) {
    return true;
  }
  const tag = element.tagName;
  if (IGNORED_TAGS.has(tag)) return true;
  if (element.isContentEditable) return true;
  if (INPUT_TAGS.includes(tag)) return true;
  return false;
}

export function isVisibleElement(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  return true;
}

export function extractTextNodes(root = document.body) {
  const nodes = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent;
        if (!text || !text.trim() || text.trim().length < MIN_TEXT_LENGTH) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        if (isIgnoredElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!isVisibleElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let current;
  while ((current = walker.nextNode())) {
    nodes.push(current);
  }
  return nodes;
}
