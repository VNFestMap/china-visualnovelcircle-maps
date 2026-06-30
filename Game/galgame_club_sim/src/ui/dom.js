export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') node.className = props[k];
    else if (k === 'dataset') Object.assign(node.dataset, props[k]);
    else if (k.startsWith('on') && typeof props[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), props[k]);
    else if (k === 'html') node.innerHTML = props[k];
    else if (k in node) node[k] = props[k];
    else node.setAttribute(k, props[k]);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
