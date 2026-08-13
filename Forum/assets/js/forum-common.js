(function (global) {
  'use strict';

  const API = './api/forum.php';
  const PLATFORM_API = '../api';
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const attr = esc;

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value), global.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function safeForumImage(value) {
    const path = String(value || '').replace(/^\.\//, '');
    return /^uploads\/[a-zA-Z0-9/_\-.]+$/.test(path) && !path.includes('..') ? './' + path : '';
  }

  const forumImageUrl = safeForumImage;

  function removeForumImageReferences(markdownValue, attachmentPath) {
    const target = safeForumImage(attachmentPath);
    const source = String(markdownValue || '');
    if (!target) return source;
    const imagePattern = /!\[([^\]\r\n]*)\]\(\s*((?:\.\/)?uploads\/[a-zA-Z0-9/_\-.]+)(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'))?\s*\)/g;
    return source.replace(imagePattern, (match, _altText, candidatePath) => (
      safeForumImage(candidatePath) === target ? '' : match
    ));
  }

  function mediaUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return safeHttpUrl(raw);
    if (/^(?:\.\/)?uploads\//.test(raw)) return '../' + raw.replace(/^\.\//, '');
    if (/^\//.test(raw) && !raw.startsWith('//')) return raw;
    if (/^\.\.\//.test(raw) && !raw.includes('..', 3)) return raw;
    return '';
  }

  function inlineMarkdown(source) {
    let text = source;
    const code = [];
    text = text.replace(/`([^`\n]+)`/g, (_, body) => `\u0000C${code.push(`<code>${body}</code>`) - 1}\u0000`);
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, altText, url) => {
      const safe = safeForumImage(url.replaceAll('&amp;', '&'));
      return safe ? `<img src="${attr(safe)}" alt="${attr(altText)}" loading="lazy">` : `![${altText}](${url})`;
    });
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const safe = safeHttpUrl(url.replaceAll('&amp;', '&'));
      return safe ? `<a href="${attr(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : `${label} (${url})`;
    });
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/(^|\s)@([\p{L}\p{N}_-]{2,32})/gu, '$1<span class="forum-runtime-mention">@$2</span>');
    return text.replace(/\u0000C(\d+)\u0000/g, (_, index) => code[Number(index)] || '');
  }

  function markdown(value) {
    const source = esc(value).replace(/\r\n?/g, '\n');
    const blocks = [];
    const fenced = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, language, body) => {
      const index = blocks.push(`<pre><code data-language="${attr(language.trim())}">${body.replace(/^\n|\n$/g, '')}</code></pre>`) - 1;
      return `\n\u0000B${index}\u0000\n`;
    });
    const lines = fenced.split('\n');
    const output = [];
    let list = null;
    let quote = false;
    const closeList = () => { if (list) { output.push(`</${list}>`); list = null; } };
    const closeQuote = () => { if (quote) { output.push('</blockquote>'); quote = false; } };
    for (const raw of lines) {
      if (/^\u0000B\d+\u0000$/.test(raw)) { closeList(); closeQuote(); output.push(raw); continue; }
      if (!raw.trim()) { closeList(); closeQuote(); continue; }
      const heading = raw.match(/^(#{2,3})\s+(.+)$/);
      if (heading) {
        closeList(); closeQuote();
        const level = heading[1].length;
        output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }
      const quoteLine = raw.match(/^&gt;\s?(.*)$/);
      if (quoteLine) {
        closeList();
        if (!quote) { output.push('<blockquote>'); quote = true; }
        output.push(`<p>${inlineMarkdown(quoteLine[1])}</p>`);
        continue;
      }
      closeQuote();
      const bullet = raw.match(/^[-*]\s+(.+)$/);
      const ordered = raw.match(/^\d+\.\s+(.+)$/);
      if (bullet || ordered) {
        const wanted = bullet ? 'ul' : 'ol';
        if (list !== wanted) { closeList(); list = wanted; output.push(`<${list}>`); }
        output.push(`<li>${inlineMarkdown((bullet || ordered)[1])}</li>`);
        continue;
      }
      closeList();
      output.push(`<p>${inlineMarkdown(raw)}</p>`);
    }
    closeList();
    closeQuote();
    return output.join('\n').replace(/\u0000B(\d+)\u0000/g, (_, index) => blocks[Number(index)] || '');
  }

  /*
   * Rich composer helpers.  The editable surface is deliberately treated as
   * an input device only: Markdown remains the canonical value submitted to
   * the Forum API.  Keeping the conversion here also means replies and future
   * editors can share the exact same allow-list.
   */
  const EDITOR_BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE']);
  const EDITOR_INLINE_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'CODE', 'A', 'IMG', 'BR', 'SPAN']);

  function editorText(value) {
    return String(value == null ? '' : value).replace(/[\u0000\u200b\ufeff]/g, '');
  }

  function replaceWithText(element, value) {
    const textNode = document.createTextNode(editorText(value));
    if (element && element.parentNode) element.parentNode.replaceChild(textNode, element);
    return textNode;
  }

  function sanitizeEditorFragment(fragment) {
    if (!fragment || typeof fragment.querySelectorAll !== 'function') return fragment;
    const walk = (parent) => {
      Array.from(parent.childNodes || []).forEach((node) => {
        if (node.nodeType === 8) { node.remove(); return; }
        if (node.nodeType !== 1) return;
        const tag = node.tagName.toUpperCase();
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED') {
          node.remove();
          return;
        }
        if (tag === 'IMG') {
          const source = safeForumImage(node.getAttribute('src') || '');
          if (!source) { replaceWithText(node, node.getAttribute('alt') || ''); return; }
          const alt = editorText(node.getAttribute('alt') || '图片').slice(0, 120) || '图片';
          Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
          node.setAttribute('src', source);
          node.setAttribute('alt', alt);
          node.setAttribute('loading', 'lazy');
          node.setAttribute('decoding', 'async');
          return;
        }
        if (tag === 'A') {
          const href = safeHttpUrl(node.getAttribute('href') || '');
          if (!href) { const text = node.textContent || ''; replaceWithText(node, text); return; }
          const label = node.textContent || href;
          Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
          node.setAttribute('href', href);
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
          if (!label.trim()) node.textContent = href;
          walk(node);
          return;
        }
        if (tag === 'DIV' || tag === 'ARTICLE' || tag === 'SECTION') {
          const paragraph = document.createElement('p');
          while (node.firstChild) paragraph.append(node.firstChild);
          node.parentNode.replaceChild(paragraph, node);
          walk(paragraph);
          return;
        }
        if (!EDITOR_BLOCK_TAGS.has(tag) && !EDITOR_INLINE_TAGS.has(tag)) {
          const parentNode = node.parentNode;
          while (node.firstChild) parentNode.insertBefore(node.firstChild, node);
          node.remove();
          return;
        }
        Array.from(node.attributes).forEach((attribute) => {
          if (tag === 'CODE' && node.parentNode && node.parentNode.tagName === 'PRE' && attribute.name === 'data-language') return;
          if (tag === 'SPAN' && attribute.name === 'class' && /forum-runtime-mention/.test(attribute.value)) return;
          node.removeAttribute(attribute.name);
        });
        walk(node);
      });
    };
    walk(fragment);
    return fragment;
  }

  function markdownToEditorDom(value, target) {
    if (!target || typeof document === 'undefined') return target;
    const template = document.createElement('template');
    template.innerHTML = markdown(editorText(value));
    sanitizeEditorFragment(template.content);
    target.replaceChildren();
    Array.from(template.content.childNodes).forEach((node) => target.append(node));
    if (!target.childNodes.length) target.append(document.createElement('p'));
    return target;
  }

  function serializeInlineNode(node) {
    if (!node) return '';
    if (node.nodeType === 3) return editorText(node.nodeValue || '').replace(/\u00a0/g, ' ');
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toUpperCase();
    const content = Array.from(node.childNodes || []).map(serializeInlineNode).join('');
    if (tag === 'BR') return '\n';
    if (tag === 'IMG') {
      const source = safeForumImage(node.getAttribute('src') || '');
      return source ? `![${editorText(node.getAttribute('alt') || '图片').replace(/[\[\]\r\n]/g, ' ')}](${source.replace(/^\.\//, '')})` : '';
    }
    if (tag === 'A') {
      const href = safeHttpUrl(node.getAttribute('href') || '');
      return href && content.trim() ? `[${content.trim()}](${href})` : content;
    }
    if (tag === 'STRONG' || tag === 'B') return content ? `**${content}**` : '';
    if (tag === 'EM' || tag === 'I') return content ? `*${content}*` : '';
    if (tag === 'CODE' && (!node.parentNode || node.parentNode.tagName.toUpperCase() !== 'PRE')) return content ? `\`${content.replace(/`/g, '\\`')}\`` : '';
    return content;
  }

  function serializeEditorBlock(node) {
    if (!node) return '';
    if (node.nodeType === 3) return editorText(node.nodeValue || '').trim();
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toUpperCase();
    if (tag === 'H2' || tag === 'H3') return `${'#'.repeat(Number(tag.slice(1)))} ${serializeInlineNode(node).trim()}`;
    if (tag === 'UL' || tag === 'OL') {
      const marker = tag === 'OL' ? (index) => `${index + 1}. ` : () => '- ';
      return Array.from(node.children).filter((child) => child.tagName && child.tagName.toUpperCase() === 'LI')
        .map((child, index) => `${marker(index)}${serializeInlineNode(child).trim()}`).join('\n');
    }
    if (tag === 'BLOCKQUOTE') {
      const nested = Array.from(node.childNodes).map(serializeEditorBlock).filter(Boolean).join('\n');
      return nested.split('\n').map((line) => `> ${line}`).join('\n');
    }
    if (tag === 'PRE') {
      const code = node.querySelector('code');
      const language = code ? editorText(code.getAttribute('data-language') || '').replace(/[^a-zA-Z0-9_-]/g, '') : '';
      return `\`\`\`${language}\n${editorText((code || node).textContent || '').replace(/^\n|\n$/g, '')}\n\`\`\``;
    }
    if (tag === 'P' || tag === 'DIV' || tag === 'ARTICLE' || tag === 'SECTION') return serializeInlineNode(node).trim();
    return serializeInlineNode(node).trim();
  }

  function editorDomToMarkdown(root) {
    if (!root) return '';
    sanitizeEditorFragment(root);
    return Array.from(root.childNodes).map(serializeEditorBlock).filter(Boolean).join('\n\n')
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function normalizePlainTextPaste(value) {
    return editorText(value).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
      .split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function selectionInside(root) {
    const selection = global.getSelection && global.getSelection();
    if (!selection || !selection.rangeCount || !root) return null;
    const range = selection.getRangeAt(0);
    return root.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  }

  function setupRichComposer(options) {
    const settings = options || {};
    const textarea = settings.textarea;
    const editor = settings.editor;
    const preview = settings.preview;
    const tabList = settings.tabList;
    const panels = { visual: settings.editorPanel, preview: settings.previewPanel, source: settings.sourcePanel };
    if (!textarea || !editor || !preview || !tabList) return { refresh() {}, activate() {}, syncMarkdown() {}, insertMarkdown() {}, insertText() {}, captureSelection() {} };
    const tabs = Array.from(tabList.querySelectorAll('[data-editor-tab]'));
    let mode = 'visual';
    let renderTimer = 0;
    let composing = false;
    let syncing = false;
    let savedRange = null;
    const richSupported = 'contentEditable' in editor && typeof document.createRange === 'function';
    if (!richSupported) {
      /* The full composer has a source panel for the main post editor.  The
         compact reply composer intentionally has only edit/preview tabs, so
         expose its canonical textarea in the edit panel as the safe fallback. */
      mode = panels.source ? 'source' : 'visual';
      editor.hidden = true;
      editor.setAttribute('aria-hidden', 'true');
      if (!panels.source) {
        textarea.hidden = false;
        textarea.removeAttribute('aria-hidden');
      }
      const sourceTab = tabs.find((tab) => tab.dataset.editorTab === 'source');
      if (sourceTab) sourceTab.textContent = 'Markdown 编辑';
    }

    const setStatus = (value) => { if (settings.status) settings.status.textContent = value; };
    const renderPreview = () => {
      global.clearTimeout(renderTimer);
      renderTimer = 0;
      try {
        const scrollTop = preview.scrollTop;
        const value = textarea.value.trim();
        preview.innerHTML = value
          ? markdown(textarea.value)
          : `<div class="forum-preview-empty"><strong>正文预览会显示在这里</strong><span>可以直接输入，或使用工具栏整理内容。</span></div>`;
        preview.scrollTop = Math.min(scrollTop, Math.max(0, preview.scrollHeight - preview.clientHeight));
        setStatus('已同步');
      } catch (error) {
        setStatus('预览更新失败');
        toast(error && error.message ? `预览更新失败：${error.message}` : '预览更新失败', 'error');
      }
    };
    const schedulePreview = () => {
      global.clearTimeout(renderTimer);
      setStatus('正在更新');
      renderTimer = global.setTimeout(renderPreview, 120);
    };
    const syncMarkdown = () => {
      if (mode === 'visual') {
        const value = editorDomToMarkdown(editor);
        if (textarea.value !== value) {
          syncing = true;
          textarea.value = value;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          syncing = false;
        }
        return value;
      }
      return textarea.value;
    };
    const syncVisual = () => markdownToEditorDom(textarea.value, editor);
    const syncPanels = () => {
      tabs.forEach((tab) => {
        const selected = tab.dataset.editorTab === mode;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      Object.entries(panels).forEach(([name, panel]) => {
        if (!panel) return;
        const hidden = name !== mode;
        panel.hidden = hidden;
        panel.setAttribute('aria-hidden', String(hidden));
      });
      editor.setAttribute('aria-hidden', String(mode !== 'visual'));
    };
    const activate = (next, focus) => {
      const requested = next === 'edit' ? 'visual' : next;
      const nextMode = ['visual', 'preview', 'source'].includes(requested) ? requested : 'visual';
      if (mode === 'visual') syncMarkdown();
      if (nextMode === 'visual') syncVisual();
      if (nextMode === 'preview') renderPreview();
      mode = nextMode;
      syncPanels();
      if (focus) {
        const selected = tabs.find((tab) => tab.dataset.editorTab === mode);
        if (selected) selected.focus();
        if (mode === 'visual') editor.focus();
        if (mode === 'source') textarea.focus();
      }
    };
    const insertFragment = (fragment) => {
      const range = savedRange && editor.contains(savedRange.commonAncestorContainer) ? savedRange : selectionInside(editor);
      const fragmentNodes = Array.from(fragment.childNodes);
      const hasBlock = fragmentNodes.some((node) => node.nodeType === 1 && EDITOR_BLOCK_TAGS.has(node.tagName.toUpperCase()));
      const insertion = document.createDocumentFragment();
      fragmentNodes.forEach((node) => insertion.append(node));
      let insertedAfterBlock = null;
      if (range && hasBlock) {
        let block = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
        while (block && block !== editor && !EDITOR_BLOCK_TAGS.has(block.tagName && block.tagName.toUpperCase())) block = block.parentElement;
        if (block && block.parentNode && block !== editor) {
          if (!range.collapsed) range.deleteContents();
          block.parentNode.insertBefore(insertion, block.nextSibling);
          insertedAfterBlock = block.nextElementSibling;
        }
      }
      if (range && !insertedAfterBlock) {
        range.deleteContents();
        range.insertNode(insertion);
        range.collapse(false);
        const selection = global.getSelection();
        if (selection) { selection.removeAllRanges(); selection.addRange(range); }
      } else if (!range) editor.append(insertion);
      savedRange = null;
      editorDomToMarkdown(editor);
      syncMarkdown();
      if (insertedAfterBlock) {
        const last = insertedAfterBlock;
        const rangeAfter = document.createRange();
        rangeAfter.selectNodeContents(last);
        rangeAfter.collapse(false);
        const selection = global.getSelection();
        if (selection) { selection.removeAllRanges(); selection.addRange(rangeAfter); }
      }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const insertMarkdown = (value) => {
      const holder = document.createElement('div');
      markdownToEditorDom(value, holder);
      insertFragment(holder);
      activate('visual');
      /* An upload completes asynchronously; render once immediately so the
         trusted image is visible without waiting for the debounce timer. */
      renderPreview();
    };
    const insertText = (value) => {
      const holder = document.createDocumentFragment();
      holder.append(document.createTextNode(editorText(value)));
      insertFragment(holder);
      activate('visual');
    };
    const captureSelection = () => { savedRange = selectionInside(editor); return savedRange; };
    const wrapSelection = (tagName, attributes) => {
      editor.focus();
      const range = selectionInside(editor);
      if (!range) return;
      const element = document.createElement(tagName);
      Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, value));
      if (range.collapsed) element.textContent = tagName === 'CODE' ? '代码' : '文本';
      else element.append(range.extractContents());
      range.insertNode(element);
      range.selectNodeContents(element);
      const selection = global.getSelection();
      if (selection) { selection.removeAllRanges(); selection.addRange(range); }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const format = (action) => {
      editor.focus();
      const command = {
        bold: ['bold'], italic: ['italic'], 'unordered-list': ['insertUnorderedList'], 'ordered-list': ['insertOrderedList'],
        heading2: ['formatBlock', 'H2'], heading3: ['formatBlock', 'H3'], quote: ['formatBlock', 'BLOCKQUOTE'], 'code-block': ['formatBlock', 'PRE']
      }[action];
      if (command && typeof document.execCommand === 'function') {
        try { document.execCommand(command[0], false, command[1]); editor.dispatchEvent(new Event('input', { bubbles: true })); return; } catch (_) { /* use DOM fallback below */ }
      }
      if (action === 'inline-code') wrapSelection('code');
      else if (action === 'link') insertLink();
      else if (action === 'bold') wrapSelection('strong');
      else if (action === 'italic') wrapSelection('em');
    };
    const insertLink = () => {
      captureSelection();
      const dialog = openDialog({
        title: '插入链接',
        html: '<label class="forum-dialog-field">链接文字<input type="text" data-link-label placeholder="链接文字"></label><label class="forum-dialog-field">网址<input type="url" data-link-url placeholder="https://"></label>',
        actions: '<div class="forum-dialog-actions"><button type="button" data-dialog-close>取消</button><button type="button" class="primary" data-link-submit>插入链接</button></div>',
        initialFocus: '[data-link-label]'
      });
      const submit = dialog.dialog.querySelector('[data-link-submit]');
      submit.addEventListener('click', () => {
        const label = dialog.dialog.querySelector('[data-link-label]').value.trim() || '链接';
        const href = safeHttpUrl(dialog.dialog.querySelector('[data-link-url]').value.trim());
        if (!href) { toast('请输入 HTTP(S) 链接', 'error'); return; }
        const holder = document.createElement('span');
        const anchor = document.createElement('a');
        anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = label;
        holder.append(anchor);
        insertFragment(holder);
        dialog.close('submit');
      });
    };
    const handlePaste = (event) => {
      if (event.clipboardData && Array.from(event.clipboardData.files || []).some((file) => IMAGE_TYPES.has(file.type))) return;
      const html = event.clipboardData && event.clipboardData.getData('text/html');
      const text = event.clipboardData && event.clipboardData.getData('text/plain');
      if (!html && !text) return;
      event.preventDefault();
      const template = document.createElement('template');
      let externalImages = 0;
      if (html) {
        template.innerHTML = html;
        externalImages = Array.from(template.content.querySelectorAll('img')).filter((image) => !safeForumImage(image.getAttribute('src') || '')).length;
        sanitizeEditorFragment(template.content);
      } else {
        const normalized = normalizePlainTextPaste(text);
        template.innerHTML = markdown(normalized);
        sanitizeEditorFragment(template.content);
      }
      if (!template.content.textContent.trim() && !template.content.querySelector('img')) return;
      captureSelection();
      insertFragment(template.content);
      toast(externalImages ? '已转换文字；外部图片未导入，请使用图片上传添加' : '已转换为论坛支持的格式', externalImages ? 'error' : 'success');
    };
    const closestBlock = () => {
      const range = selectionInside(editor);
      let node = range ? (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement) : null;
      while (node && node !== editor) {
        if (EDITOR_BLOCK_TAGS.has(node.tagName && node.tagName.toUpperCase())) return node;
        node = node.parentElement;
      }
      return null;
    };
    const placeCaretAtEnd = (node) => {
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const selection = global.getSelection();
      if (selection) { selection.removeAllRanges(); selection.addRange(range); }
    };
    const normalizeEditorRoot = () => {
      const rootTextNodes = Array.from(editor.childNodes).filter((node) => node.nodeType === 3 && editorText(node.nodeValue || '').trim());
      if (!rootTextNodes.length) return;
      rootTextNodes.forEach((node) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = editorText(node.nodeValue || '');
        node.parentNode.replaceChild(paragraph, node);
        const emptyParagraphs = Array.from(editor.children).filter((child) => child.tagName === 'P' && !child.textContent.trim());
        emptyParagraphs.forEach((empty) => { if (empty !== paragraph) empty.remove(); });
        placeCaretAtEnd(paragraph);
      });
    };
    const smartBlockPrefix = () => {
      const block = closestBlock();
      if (!block || !block.textContent) return false;
      const text = block.textContent;
      const heading = text.match(/^#{2,3}\s+(.+)$/);
      const unordered = text.match(/^[-*]\s+(.+)$/);
      const ordered = text.match(/^\d+\.\s+(.+)$/);
      const fence = /^```(?:[a-zA-Z0-9_-]+)?\s*$/.test(text);
      if (!heading && !unordered && !ordered && !fence) return false;
      if (heading) {
        const replacement = document.createElement(heading[0].startsWith('###') ? 'h3' : 'h2');
        replacement.textContent = heading[1];
        block.replaceWith(replacement);
        placeCaretAtEnd(replacement);
        return true;
      }
      if (unordered || ordered) {
        const list = document.createElement(ordered ? 'ol' : 'ul');
        const item = document.createElement('li');
        item.textContent = (ordered || unordered)[1];
        list.append(item);
        block.replaceWith(list);
        placeCaretAtEnd(item);
        return true;
      }
      const pre = document.createElement('pre');
      pre.append(document.createElement('code'));
      block.replaceWith(pre);
      placeCaretAtEnd(pre.querySelector('code'));
      return true;
    };
    const smartEnter = (event) => {
      if (event.key !== 'Enter' || composing) return;
      const block = closestBlock();
      if (!block) return;
      if (block.tagName === 'LI' && !block.textContent.trim()) {
        event.preventDefault();
        const list = block.parentElement;
        block.remove();
        if (!list.children.length) {
          const paragraph = document.createElement('p');
          list.replaceWith(paragraph);
          placeCaretAtEnd(paragraph);
        } else placeCaretAtEnd(list.lastElementChild);
      } else if (block.tagName === 'P' && block.parentElement && block.parentElement.tagName === 'BLOCKQUOTE' && !block.textContent.trim()) {
        event.preventDefault();
        const quote = block.parentElement;
        const paragraph = document.createElement('p');
        quote.replaceWith(paragraph);
        placeCaretAtEnd(paragraph);
      }
    };
    const autoLinkCurrentBlock = () => {
      const block = closestBlock();
      if (!block || /<a\b/i.test(block.innerHTML) || !/\s$/.test(block.textContent || '')) return false;
      const walker = document.createTreeWalker(block, 4);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const node = nodes[nodes.length - 1];
      if (!node) return false;
      const match = String(node.nodeValue || '').match(/(https?:\/\/[^\s<]+)\s$/i);
      if (!match || !safeHttpUrl(match[1])) return false;
      const range = document.createRange();
      range.setStart(node, node.nodeValue.length - match[1].length - 1);
      range.setEnd(node, node.nodeValue.length - 1);
      const anchor = document.createElement('a');
      anchor.href = safeHttpUrl(match[1]); anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      anchor.textContent = match[1];
      range.deleteContents(); range.insertNode(anchor); placeCaretAtEnd(block);
      return true;
    };
    editor.addEventListener('input', () => {
      if (syncing) return;
      normalizeEditorRoot();
      if (!composing) { smartBlockPrefix(); autoLinkCurrentBlock(); }
      syncMarkdown(); schedulePreview();
    });
    textarea.addEventListener('input', () => {
      if (syncing) return;
      if (mode === 'visual') syncVisual();
      schedulePreview();
    });
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('focus', () => {
      if (!editor.textContent.trim()) {
        const paragraph = editor.querySelector('p:only-child') || editor.appendChild(document.createElement('p'));
        placeCaretAtEnd(paragraph);
      }
    });
    editor.addEventListener('compositionstart', () => { composing = true; });
    editor.addEventListener('compositionend', () => { composing = false; });
    editor.addEventListener('keydown', (event) => {
      if (composing) return;
      smartEnter(event);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); format('bold'); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') { event.preventDefault(); format('italic'); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); insertLink(); }
    });
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab.dataset.editorTab));
      tab.addEventListener('keydown', (event) => {
        let next = null;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next == null) return;
        event.preventDefault(); activate(tabs[next].dataset.editorTab, true);
      });
    });
    if (richSupported) syncVisual();
    syncPanels();
    renderPreview();
    return { refresh: () => { if (mode === 'visual') syncVisual(); renderPreview(); }, activate, syncMarkdown, insertMarkdown, insertText, captureSelection, format, get mode() { return mode; } };
  }

  function setupRichToolbar(root, composer, options) {
    if (!root || !composer) return;
    const settings = options || {};
    root.querySelectorAll('[data-md]').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault();
      const action = button.dataset.md;
      composer.captureSelection();
      if (action === 'image' && typeof settings.onImage === 'function') { settings.onImage(button); return; }
      composer.format(action);
    }));
  }

  class ForumError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = 'ForumError';
      this.status = status;
      this.data = data;
    }
  }

  async function requestJson(url, options) {
    let response;
    try {
      response = await fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options || {}));
    } catch (cause) {
      throw new ForumError('网络连接失败，请检查连接后重试', 0, { cause });
    }
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      throw new ForumError(`服务器返回了无法识别的响应（${response.status}）`, response.status, { raw: raw.slice(0, 300) });
    }
    if (!response.ok || data.success === false) {
      const fallback = {
        401: '登录状态已失效', 403: '没有执行此操作的权限', 404: '内容不存在',
        409: '当前状态已发生变化', 422: '提交内容需要修改', 429: '操作太频繁，请稍后再试'
      }[response.status] || '请求失败';
      const error = new ForumError(data.message || fallback, response.status, data);
      if (response.status === 401) global.dispatchEvent(new CustomEvent('forum:auth-required'));
      throw error;
    }
    return data;
  }

  async function api(action, options) {
    const settings = Object.assign({ method: 'GET', query: null, body: null, signal: null }, options || {});
    const query = new URLSearchParams(Object.assign({ action }, settings.query || {}));
    const init = { method: settings.method, headers: { Accept: 'application/json' }, signal: settings.signal };
    if (settings.body instanceof FormData) init.body = settings.body;
    else if (settings.body != null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(settings.body);
    }
    const payload = await requestJson(`${API}?${query}`, init);
    return payload.data == null ? payload : payload.data;
  }

  async function platformApi(path, options) {
    const settings = Object.assign({ method: 'GET', body: null }, options || {});
    const init = { method: settings.method, headers: { Accept: 'application/json' } };
    if (settings.body != null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(settings.body);
    }
    return requestJson(`${PLATFORM_API}/${path}`, init);
  }

  function toast(message, type) {
    let region = document.querySelector('.forum-runtime-toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'forum-runtime-toast-region';
      region.setAttribute('aria-live', 'polite');
      document.body.append(region);
    }
    const item = document.createElement('div');
    item.className = `forum-runtime-toast${type === 'error' ? ' is-error' : ''}`;
    item.textContent = message;
    region.append(item);
    global.setTimeout(() => item.remove(), 4200);
  }

  function parseDate(value) {
    if (!value) return null;
    const text = String(value);
    const date = new Date(text.replace(' ', 'T') + (/[z+-]/i.test(text.slice(-6)) ? '' : 'Z'));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value, full) {
    const date = parseDate(value);
    if (!date) return value ? String(value) : '';
    if (full) return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date).replaceAll('/', '-');
    const difference = Date.now() - date.getTime();
    if (difference >= 0 && difference < 60000) return '刚刚';
    if (difference >= 0 && difference < 3600000) return `${Math.floor(difference / 60000)} 分钟前`;
    if (difference >= 0 && difference < 86400000) return `${Math.floor(difference / 3600000)} 小时前`;
    if (difference >= 0 && difference < 7 * 86400000) return `${Math.floor(difference / 86400000)} 天前`;
    return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
  }

  function compact(value) {
    return new Intl.NumberFormat('zh-CN', {
      notation: Number(value) >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1
    }).format(Number(value) || 0);
  }

  function safeAvatarUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return safeHttpUrl(raw);
    if (/^\/data\/avatars\/\d+\.(?:jpg|jpeg|png|gif|webp)(?:\?t=\d+)?$/.test(raw)) return raw;
    if (/^data\/avatars\/\d+\.(?:jpg|jpeg|png|gif|webp)(?:\?t=\d+)?$/.test(raw)) return '../' + raw;
    return '';
  }

  function avatarUrl(user) {
    return safeAvatarUrl(user && user.avatar_url);
  }

  let avatarFallbackHandlerReady = false;

  function ensureAvatarFallbackHandler() {
    if (avatarFallbackHandlerReady || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    avatarFallbackHandlerReady = true;
    document.addEventListener('error', (event) => {
      const image = event.target;
      if (!image || image.tagName !== 'IMG' || !image.hasAttribute('data-forum-avatar')) return;
      const label = image.dataset.avatarLabel || '用户';
      const fallback = document.createElement('span');
      fallback.className = `${image.dataset.avatarClass || 'avatar'} forum-runtime-avatar-fallback`;
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', `${label}的头像`);
      fallback.textContent = image.dataset.avatarInitial || '?';
      image.replaceWith(fallback);
    }, true);
  }

  function avatarImage(user, className, options) {
    const label = String((user && (user.nickname || user.username)) || '用户');
    const source = avatarUrl(user);
    const avatarClass = String(className || 'avatar');
    const initialText = (Array.from(label.trim())[0] || '?').toUpperCase();
    const initial = esc(initialText);
    if (source) {
      ensureAvatarFallbackHandler();
      const eager = Boolean(options && options.eager);
      return `<img class="${attr(avatarClass)} forum-runtime-avatar-image" src="${attr(source)}" alt="${attr(label)}的头像" loading="${eager ? 'eager' : 'lazy'}" decoding="async" data-forum-avatar data-avatar-class="${attr(avatarClass)}" data-avatar-label="${attr(label)}" data-avatar-initial="${attr(initialText)}">`;
    }
    return `<span class="${attr(avatarClass)} forum-runtime-avatar-fallback" role="img" aria-label="${attr(label)}的头像">${initial}</span>`;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = label || '处理中…';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalLabel || button.textContent;
      delete button.dataset.originalLabel;
    }
  }

  function currentForumPath() {
    return 'Forum/' + global.location.pathname.split('/').pop() + global.location.search + global.location.hash;
  }

  function loginUrl(returnPath) {
    return '../login.html?redirect=' + encodeURIComponent(returnPath || currentForumPath());
  }

  function requireLogin(returnPath) {
    global.location.href = loginUrl(returnPath);
  }

  function setupChrome() {
    if (typeof global.initVoteThemeToggle === 'function') global.initVoteThemeToggle('themeToggle');
    const sidebar = document.querySelector('.forum-sidebar');
    const menu = document.querySelector('#forumNavToggle');
    const drawerMedia = typeof global.matchMedia === 'function' ? global.matchMedia('(max-width: 1023px)') : null;
    const topbar = document.querySelector('.topbar');
    let progress = document.querySelector('.forum-navigation-progress');
    let live = document.querySelector('#forumNavigationStatus');
    let navigationTimer = null;

    if (topbar && !progress) {
      progress = document.createElement('span');
      progress.className = 'forum-navigation-progress';
      progress.setAttribute('aria-hidden', 'true');
      topbar.append(progress);
    }
    if (!live) {
      live = document.createElement('span');
      live.id = 'forumNavigationStatus';
      live.className = 'forum-sr-only';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      document.body.append(live);
    }

    const setDrawer = (open, restoreFocus) => {
      if (!sidebar || !menu) return;
      const drawerMode = !drawerMedia || drawerMedia.matches;
      const drawerOpen = drawerMode && !!open;
      sidebar.classList.toggle('is-open', drawerOpen);
      document.body.classList.toggle('forum-runtime-drawer-open', drawerOpen);
      menu.setAttribute('aria-expanded', String(drawerOpen));
      menu.setAttribute('aria-label', drawerOpen ? '关闭论坛导航' : '打开论坛导航');
      if (drawerMode) {
        sidebar.toggleAttribute('inert', !drawerOpen);
        if (drawerOpen) {
          sidebar.removeAttribute('aria-hidden');
          global.requestAnimationFrame(() => {
            const first = sidebar.querySelector('a[href],button:not([disabled])');
            if (first) first.focus();
          });
        } else {
          sidebar.setAttribute('aria-hidden', 'true');
        }
      } else {
        sidebar.removeAttribute('inert');
        sidebar.removeAttribute('aria-hidden');
      }
      if (!drawerOpen && restoreFocus) menu.focus();
    };

    if (menu && sidebar) {
      setDrawer(false, false);
      menu.addEventListener('click', () => setDrawer(!sidebar.classList.contains('is-open'), false));
      sidebar.addEventListener('click', (event) => {
        if (event.target.closest('a[href]')) setDrawer(false, false);
      });
      document.addEventListener('click', (event) => {
        if (!sidebar.classList.contains('is-open')) return;
        if (!sidebar.contains(event.target) && !menu.contains(event.target)) setDrawer(false, false);
      });
      if (drawerMedia) {
        const syncDrawerMode = () => setDrawer(false, false);
        if (typeof drawerMedia.addEventListener === 'function') drawerMedia.addEventListener('change', syncDrawerMode);
        else if (typeof drawerMedia.addListener === 'function') drawerMedia.addListener(syncDrawerMode);
      }
    }

    const clearNavigationFeedback = () => {
      if (navigationTimer) global.clearTimeout(navigationTimer);
      navigationTimer = null;
      document.body.classList.remove('forum-navigation-pending');
      document.querySelectorAll('.is-navigating').forEach((element) => element.classList.remove('is-navigating'));
      if (live) live.textContent = '';
    };

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      let destination;
      try { destination = new URL(anchor.href, global.location.href); }
      catch (_) { return; }
      if (destination.origin !== global.location.origin) return;
      const isForumDestination = /\/Forum\//.test(destination.pathname);
      const isExplicitForumNavigation = anchor.hasAttribute('data-forum-nav-feedback');
      if (!isForumDestination && !isExplicitForumNavigation) return;
      if (destination.href === global.location.href && !destination.hash) return;
      anchor.classList.add('is-navigating');
      document.body.classList.add('forum-navigation-pending');
      if (live) live.textContent = `正在打开${anchor.textContent.trim() || '页面'}…`;
      navigationTimer = global.setTimeout(clearNavigationFeedback, 8000);
    });

    global.addEventListener('pageshow', clearNavigationFeedback);
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !/input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) {
        const search = document.querySelector('.topbar-search input');
        if (search) { event.preventDefault(); search.focus(); }
      }
      if (event.key === 'Escape' && sidebar) {
        setDrawer(false, !!(menu && sidebar.classList.contains('is-open')));
      }
    });
  }

  function randomToken() {
    const bytes = new Uint8Array(18);
    global.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function insertText(textarea, before, after, placeholder) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || placeholder || '';
    textarea.setRangeText(before + selected + after, start, end, 'end');
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function prefixSelectedLines(textarea, prefix, placeholder, numbered) {
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const lineStart = textarea.value.lastIndexOf('\n', selectionStart - 1) + 1;
    const nextBreak = textarea.value.indexOf('\n', selectionEnd);
    const lineEnd = nextBreak === -1 ? textarea.value.length : nextBreak;
    const selected = textarea.value.slice(lineStart, lineEnd) || placeholder || '';
    const replacement = selected.split('\n').map((line, index) => `${numbered ? `${index + 1}. ` : prefix}${line}`).join('\n');
    textarea.setRangeText(replacement, lineStart, lineEnd, 'select');
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setupToolbar(root, textarea, options) {
    if (!root || !textarea) return;
    const settings = options || {};
    root.querySelectorAll('[data-md]').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault();
      const action = button.dataset.md;
      if (action === 'image' && typeof settings.onImage === 'function') {
        settings.onImage(button);
        return;
      }
      const inline = {
        bold: ['**', '**', '粗体文字'],
        italic: ['*', '*', '斜体文字'],
        'inline-code': ['`', '`', '代码'],
        code: ['`', '`', '代码'],
        'code-block': ['```\n', '\n```', '代码块'],
        codeblock: ['```\n', '\n```', '代码块'],
        link: ['[', '](https://)', '链接文字']
      };
      if (inline[action]) {
        insertText(textarea, ...inline[action]);
        return;
      }
      if (action === 'heading2' || action === 'h2') prefixSelectedLines(textarea, '## ', '二级标题', false);
      else if (action === 'heading3' || action === 'h3') prefixSelectedLines(textarea, '### ', '三级标题', false);
      else if (action === 'unordered-list' || action === 'ul') prefixSelectedLines(textarea, '- ', '列表项', false);
      else if (action === 'ordered-list' || action === 'ol') prefixSelectedLines(textarea, '', '列表项', true);
      else if (action === 'quote') prefixSelectedLines(textarea, '> ', '引用内容', false);
    }));
  }

  function uploadImage(file, token, onProgress) {
    let xhr = null;
    const request = new Promise((resolve, reject) => {
      xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}?action=upload_image`);
      xhr.responseType = 'json';
      xhr.withCredentials = true;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(Math.round(event.loaded / event.total * 100));
      };
      xhr.onerror = () => reject(new ForumError('图片上传中断', 0));
      xhr.onabort = () => reject(new ForumError('图片上传已取消', 0));
      xhr.onload = () => {
        const data = xhr.response;
        if (xhr.status >= 200 && xhr.status < 300 && data && data.success) resolve(data.data);
        else reject(new ForumError((data && data.message) || '图片上传失败', xhr.status, data));
      };
      const body = new FormData();
      body.append('upload_token', token);
      body.append('image', file, file.name);
      xhr.send(body);
    });
    request.abort = () => {
      if (xhr && xhr.readyState !== XMLHttpRequest.DONE) xhr.abort();
    };
    return request;
  }

  function formatBytes(value) {
    const size = Number(value) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(1)} MB`;
  }

  function setupUploader(options) {
    const zone = options.zone;
    const textarea = options.textarea;
    const token = options.token;
    const maxCount = Number(options.maxCount) || 20;
    const maxBytes = Number(options.maxBytes) || 10485760;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.multiple = true;
    input.hidden = true;
    zone.after(input);
    const list = document.createElement('div');
    list.className = 'forum-runtime-upload-list';
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', '图片上传队列');
    input.after(list);
    const items = [];
    let nextItemId = 0;

    function statusText(item) {
      if (item.status === 'waiting') return '等待上传';
      if (item.status === 'uploading') return `上传中 ${item.progress || 0}%`;
      if (item.status === 'done') return '已完成';
      if (item.status === 'removing') return '正在删除';
      return item.error || '上传失败';
    }

    function releaseLocalPreview(item) {
      if (!item || !item.localPreviewUrl) return;
      try {
        if (global.URL && typeof global.URL.revokeObjectURL === 'function') global.URL.revokeObjectURL(item.localPreviewUrl);
      } catch (_) {
        // Object URLs are best-effort UI resources and never part of persisted content.
      }
      item.localPreviewUrl = '';
    }

    function localPreview(file) {
      try {
        if (global.URL && typeof global.URL.createObjectURL === 'function') return global.URL.createObjectURL(file);
      } catch (_) {
        // The upload remains usable when a browser cannot create an object URL.
      }
      return '';
    }

    function cleanImageAlt(value) {
      return String(value || '图片').replace(/[\[\]\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || '图片';
    }

    function render() {
      list.innerHTML = items.map((item, index) => {
        const preview = item.serverPreviewUrl || item.localPreviewUrl;
        const progress = item.status === 'done' || item.status === 'removing' ? 100 : item.progress || 0;
        const status = statusText(item);
        return `<div class="forum-runtime-upload-item is-${attr(item.status)}" role="listitem" data-upload-id="${item.id}" aria-busy="${item.status === 'uploading' || item.status === 'removing' ? 'true' : 'false'}">
        <div class="forum-runtime-upload-thumb-wrap">${preview ? `<img class="forum-runtime-upload-thumb" src="${attr(preview)}" alt="${attr(cleanImageAlt(item.file.name))}预览" loading="lazy" decoding="async">` : '<span class="forum-runtime-upload-thumb is-empty" aria-hidden="true"></span>'}</div>
        <div class="forum-runtime-upload-meta"><strong title="${attr(item.file.name)}">${esc(item.file.name)}</strong><span>${formatBytes(item.file.size)} · <span data-upload-status>${esc(status)}</span></span>
          <span class="forum-runtime-progress" role="progressbar" aria-label="${attr(item.file.name)}上传进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-valuetext="${esc(status)}"><i style="width:${progress}%"></i></span>
        </div>
        <div class="forum-runtime-upload-actions">
          ${item.status === 'error' ? `<button type="button" data-upload-retry="${index}" aria-label="重试上传 ${attr(item.file.name)}">重试</button>` : ''}
          <button type="button" data-upload-remove="${index}" aria-label="删除 ${attr(item.file.name)}"${item.status === 'removing' ? ' disabled' : ''}>删除</button>
        </div>
      </div>`;
      }).join('');
      list.querySelectorAll('[data-upload-retry]').forEach((button) => button.addEventListener('click', () => start(items[Number(button.dataset.uploadRetry)])));
      list.querySelectorAll('[data-upload-remove]').forEach((button) => button.addEventListener('click', () => remove(Number(button.dataset.uploadRemove))));
      if (options.countNode) options.countNode.textContent = `${items.length} / ${maxCount}`;
      if (options.onChange) options.onChange(items.slice());
    }

    function updateProgress(item) {
      const node = list.querySelector(`[data-upload-id="${item.id}"]`);
      if (!node) return;
      const status = statusText(item);
      const statusNode = node.querySelector('[data-upload-status]');
      const progressNode = node.querySelector('[role="progressbar"]');
      const bar = progressNode && progressNode.querySelector('i');
      if (statusNode) statusNode.textContent = status;
      if (progressNode) {
        progressNode.setAttribute('aria-valuenow', String(item.progress || 0));
        progressNode.setAttribute('aria-valuetext', status);
      }
      if (bar) bar.style.width = `${item.progress || 0}%`;
    }

    async function start(item) {
      if (!item || item.removed || item.status === 'uploading' || item.status === 'done' || item.status === 'removing') return;
      item.status = 'uploading';
      item.progress = 0;
      item.error = '';
      render();
      try {
        item.request = uploadImage(item.file, token, (progress) => {
          if (item.removed) return;
          item.progress = progress;
          updateProgress(item);
        });
        const upload = await item.request;
        if (item.removed) {
          if (upload && upload.id) {
            try { await api('delete_upload', { method: 'POST', body: { attachment_id: upload.id } }); }
            catch (_) { /* Server cleanup will handle an abandoned temporary attachment. */ }
          }
          return;
        }
        const safePath = safeForumImage(upload && upload.path);
        const serverPreviewUrl = safeForumImage(upload && upload.url) || safePath;
        if (!safePath || !serverPreviewUrl) {
          if (upload && upload.id) {
            try { await api('delete_upload', { method: 'POST', body: { attachment_id: upload.id } }); }
            catch (_) { /* Keep the original validation error as the actionable failure. */ }
          }
          throw new ForumError('服务器返回了不受信任的图片路径', 422);
        }
        item.upload = upload;
        item.serverPreviewUrl = serverPreviewUrl;
        item.status = 'done';
        item.progress = 100;
        const markdownText = `![${cleanImageAlt(upload.original_name || item.file.name)}](${safePath.replace(/^\.\//, '')})`;
        item.markdown = markdownText;
        if (typeof options.onInsert === 'function') {
          options.onInsert(markdownText, upload, item);
        } else {
          const prefix = textarea.value && !textarea.value.endsWith('\n') ? '\n\n' : '';
          textarea.setRangeText(prefix + markdownText + '\n', textarea.selectionStart, textarea.selectionEnd, 'end');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        releaseLocalPreview(item);
      } catch (error) {
        if (item.removed) return;
        item.status = 'error';
        item.error = error.message || '上传失败';
      } finally {
        item.request = null;
      }
      render();
    }

    function finishRemoval(item) {
      const itemIndex = items.indexOf(item);
      if (itemIndex === -1) return;
      if (item.upload && item.upload.path) {
        textarea.value = removeForumImageReferences(textarea.value, item.upload.path).replace(/\n{3,}/g, '\n\n');
      } else if (item.markdown) {
        textarea.value = textarea.value.replace(item.markdown, '').replace(/\n{3,}/g, '\n\n');
      }
      releaseLocalPreview(item);
      item.removed = true;
      items.splice(itemIndex, 1);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      render();
    }

    async function remove(index) {
      const item = items[index];
      if (!item || item.removed || item.status === 'removing') return;
      if (item.status === 'uploading' && item.request && typeof item.request.abort === 'function') {
        item.removed = true;
        item.request.abort();
        releaseLocalPreview(item);
        items.splice(index, 1);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        render();
        return;
      }
      if (item.upload && item.upload.id) {
        const previousStatus = item.status;
        item.status = 'removing';
        render();
        try { await api('delete_upload', { method: 'POST', body: { attachment_id: item.upload.id } }); }
        catch (error) {
          item.status = previousStatus;
          toast(error.message, 'error');
          render();
          return;
        }
      }
      finishRemoval(item);
    }

    function addFiles(fileList) {
      const files = Array.from(fileList || []);
      const added = [];
      for (const file of files) {
        if (items.length >= maxCount) { toast(`每篇内容最多上传 ${maxCount} 张图片`, 'error'); break; }
        if (!IMAGE_TYPES.has(file.type)) { toast(`${file.name} 不是支持的图片格式`, 'error'); continue; }
        if (file.size <= 0 || file.size > maxBytes) { toast(`${file.name} 超过 ${formatBytes(maxBytes)} 或文件为空`, 'error'); continue; }
        const item = {
          id: ++nextItemId, file, status: 'waiting', progress: 0, upload: null, request: null,
          error: '', markdown: '', localPreviewUrl: localPreview(file), serverPreviewUrl: '', removed: false
        };
        items.push(item);
        added.push(item);
      }
      render();
      added.forEach((item) => start(item));
    }

    zone.setAttribute('role', 'button');
    zone.tabIndex = 0;
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.remove('dragover'); }));
    zone.addEventListener('drop', (event) => addFiles(event.dataTransfer && event.dataTransfer.files));
    const pasteTarget = options.pasteTarget || textarea;
    pasteTarget.addEventListener('paste', (event) => {
      const files = Array.from(event.clipboardData && event.clipboardData.files || []).filter((file) => IMAGE_TYPES.has(file.type));
      if (files.length) { event.preventDefault(); addFiles(files); }
    });
    const dropTarget = options.dropTarget && options.dropTarget !== zone ? options.dropTarget : null;
    if (dropTarget) {
      ['dragenter', 'dragover'].forEach((name) => dropTarget.addEventListener(name, (event) => {
        if (!Array.from(event.dataTransfer && event.dataTransfer.items || []).some((item) => item.kind === 'file')) return;
        event.preventDefault(); dropTarget.classList.add('dragover');
      }));
      dropTarget.addEventListener('dragleave', () => dropTarget.classList.remove('dragover'));
      dropTarget.addEventListener('drop', (event) => {
        const files = event.dataTransfer && event.dataTransfer.files;
        if (!files || !files.length) return;
        event.preventDefault(); dropTarget.classList.remove('dragover'); addFiles(files);
      });
    }
    const releaseAllPreviews = () => items.forEach(releaseLocalPreview);
    const open = () => {
      if (items.length >= maxCount) {
        toast(`每篇内容最多上传 ${maxCount} 张图片`, 'error');
        return;
      }
      input.click();
    };
    if (options.trigger) options.trigger.addEventListener('click', open);
    global.addEventListener('pagehide', releaseAllPreviews, { once: true });
    render();
    return {
      items,
      open,
      addFiles,
      remove,
      retry: (index) => start(items[Number(index)]),
      hasPending: () => items.some((item) => item.status === 'uploading' || item.status === 'waiting' || item.status === 'removing'),
      destroy: () => {
        items.forEach((item) => {
          if (item.request && typeof item.request.abort === 'function') item.request.abort();
          releaseLocalPreview(item);
        });
        global.removeEventListener('pagehide', releaseAllPreviews);
        if (options.trigger) options.trigger.removeEventListener('click', open);
        input.remove();
        list.remove();
      }
    };
  }

  let forumDialogSequence = 0;

  function openDialog(options) {
    const settings = options || {};
    const previousFocus = document.activeElement;
    const titleId = `forumDialogTitle${++forumDialogSequence}`;
    const overlay = document.createElement('div');
    overlay.className = 'forum-runtime-dialog-backdrop';
    overlay.innerHTML = `<section class="forum-runtime-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <div class="forum-runtime-dialog-head"><h2 id="${titleId}">${esc(settings.title || '')}</h2><button type="button" data-dialog-close aria-label="关闭">×</button></div>
      <div class="forum-runtime-dialog-body">${settings.html || ''}</div>
      ${settings.actions || ''}
    </section>`;
    document.body.append(overlay);
    const dialog = overlay.querySelector('[role="dialog"]');
    let closed = false;
    let closeReason = '';
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusableElements = () => Array.from(dialog.querySelectorAll(focusableSelector)).filter((element) => (
      !element.hidden && element.getAttribute('aria-hidden') !== 'true'
    ));
    const close = (reason) => {
      if (closed) return;
      closed = true;
      closeReason = reason || 'programmatic';
      overlay.remove();
      if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) previousFocus.focus();
      if (typeof settings.onClose === 'function') settings.onClose(closeReason);
    };
    overlay.querySelectorAll('[data-dialog-close]').forEach((button) => button.addEventListener('click', () => close('button')));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close('backdrop'); });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close('escape');
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });
    const requestedFocus = typeof settings.initialFocus === 'string'
      ? dialog.querySelector(settings.initialFocus)
      : settings.initialFocus;
    const first = requestedFocus || focusableElements()[0] || dialog;
    first.focus();
    return {
      element: overlay,
      dialog,
      close,
      get closeReason() { return closeReason; }
    };
  }

  global.VNFForum = {
    api, platformApi, esc, attr, markdown, ForumError, toast, formatDate, compact,
    mediaUrl, forumImageUrl, removeForumImageReferences, safeAvatarUrl, avatarUrl, avatarImage, setBusy, loginUrl, requireLogin, setupChrome,
    randomToken, setupToolbar, setupRichToolbar, setupRichComposer, markdownToEditorDom, editorDomToMarkdown,
    sanitizeEditorFragment, normalizePlainTextPaste, insertText, uploadImage, setupUploader, formatBytes,
    openDialog
  };
})(window);
