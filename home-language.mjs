import { english } from './home-translations.mjs?v=4fcbdf333883';

const root = document.documentElement;
const key = 'penumbra-language';
const attributes = ['aria-label', 'title', 'alt', 'placeholder', 'content'];
const originals = new WeakMap();
let language = 'ko';
const normalize = text => text.replace(/\s+/g, ' ').trim();

// Retain the original nodes, listeners and Korean whitespace when switching back.
function translated(node, field, current) {
  let fields = originals.get(node);
  if (!fields) originals.set(node, fields = new Map());
  let record = fields.get(field);
  if (!record || current !== record.output) record = { source: current, output: current };
  const value = english[normalize(record.source)];
  const output = language === 'en' && value !== undefined
    ? (record.source.match(/^\s*/)?.[0] || '') + value + (record.source.match(/\s*$/)?.[0] || '')
    : record.source;
  record.output = output;
  fields.set(field, record);
  return output;
}
function visit(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.parentElement?.closest('script,style,noscript,code,pre,.hero-name,.language-switch')) return;
    const value = translated(node, 'text', node.data);
    if (node.data !== value) node.data = value;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return;
  if (node.matches?.('script,style,noscript,code,pre,.hero-name')) return;
  for (const attr of attributes) {
    if (!node.hasAttribute?.(attr)) continue;
    const value = translated(node, attr, node.getAttribute(attr));
    if (node.getAttribute(attr) !== value) node.setAttribute(attr, value);
  }
  for (const child of node.childNodes) visit(child);
}
function apply(value) {
  language = value === 'en' ? 'en' : 'ko';
  root.lang = language;
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
  visit(document);
  document.querySelector('.hero-name')?.setAttribute('aria-label', language === 'en' ? 'Soyoun Kim' : 'SOYOUN KIM 김소연');
  window.dispatchEvent(new CustomEvent('penumbra-language-change', { detail: { language } }));
  window.dispatchEvent(new Event('resize'));
}
for (const button of document.querySelectorAll('[data-language]')) {
  button.addEventListener('click', () => {
    try { localStorage.setItem(key, button.dataset.language); } catch {}
    apply(button.dataset.language);
  });
}
let saved = 'ko';
try { saved = localStorage.getItem(key) || 'ko'; } catch {}
apply(saved);
new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'childList') record.addedNodes.forEach(visit);
    else if (record.type === 'characterData') visit(record.target);
    else {
      const node = record.target;
      if (node.matches('.hero-name')) continue;
      const current = node.getAttribute(record.attributeName);
      if (current === null) continue;
      const value = translated(node, record.attributeName, current);
      if (current !== value) node.setAttribute(record.attributeName, value);
    }
  }
}).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
window.addEventListener('storage', event => {
  if (event.key === key) apply(event.newValue);
  else if (event.key === null) apply('ko');
});
