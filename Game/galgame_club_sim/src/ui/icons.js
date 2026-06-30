const paths = {
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
  restart: '<path d="M4 4v6h6"/><path d="M5.6 15a7 7 0 1 0 .9-7.8L4 10"/>',
  'archive-x': '<path d="M4 7h16M6 7v13h12V7M3 4h18v3H3z"/><path d="m9 11 6 6m0-6-6 6"/>',
  command: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5M9 19v2m6-2v2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  archive: '<path d="M3 5h18v4H3zM5 9v11h14V9M9 13h6"/>',
  projects: '<path d="M3 6h6l2 2h10v11H3z"/><path d="M8 13h8m-4-4v8"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v4m-4 4h8m-6-4h4"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  back: '<path d="m15 18-6-6 6-6"/><path d="M9 12h11"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  campus: '<path d="M3 10 12 4l9 6-9 6z"/><path d="M6 12v5c3 2 9 2 12 0v-5M21 10v6"/>',
  content: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  external: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  creative: '<path d="m4 20 4-1 10-10-3-3L5 16z"/><path d="m13 8 3 3M14 4l3 3"/>',
  succession: '<path d="M5 5h10a4 4 0 0 1 4 4v10"/><path d="m15 15 4 4 4-4M19 19H9a4 4 0 0 1-4-4V5"/><path d="M9 9 5 5 1 9"/>',
  rest: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  funds: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.7-1.7-1-3-1-1.7 0-3 .9-3 2s1.3 1.8 3 2 3 1 3 2.2-1.3 2.3-3 2.3c-1.3 0-2.5-.4-3.2-1.2M12 5v14"/>',
};

export function icon(name, className = '') {
  const body = paths[name] || paths.command;
  return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}
