import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { escapeHtml, generateWikiPages, pageNameForClubKey } from './generate-wiki-pages.mjs';

const root = process.cwd();
const fixture = join(root, '.tmp-wiki-test');

rmSync(fixture, { recursive: true, force: true });
mkdirSync(join(fixture, 'wiki/content'), { recursive: true });
mkdirSync(join(fixture, 'wiki/pages'), { recursive: true });
mkdirSync(join(fixture, 'wiki/library'), { recursive: true });
mkdirSync(join(fixture, 'data'), { recursive: true });

writeFileSync(join(fixture, 'data/clubs.json'), JSON.stringify({
  success: true,
  data: [
    {
      id: 2,
      country: 'china',
      school: '安徽理工大学',
      province: '安徽',
      name: '安徽理工大学_安理二次元同好交流圈',
      display_name: '安理二次元同好交流圈',
      type: 'school',
      verified: 1,
      created_at: '2022-05-10'
    },
    {
      id: 3,
      country: 'china',
      school: 'Incomplete Test University',
      province: 'Shanghai',
      name: 'Incomplete Wiki Test Club',
      display_name: 'Incomplete Wiki Test Club',
      type: 'school',
      verified: 1,
      created_at: '2024-01-01'
    },
    {
      id: 4,
      country: 'china',
      school: 'Province Alias Test University',
      province: '四川省',
      name: 'Province Alias Test Club',
      display_name: 'Province Alias Test Club',
      type: 'school',
      verified: 1,
      created_at: '2024-01-02'
    }
  ]
}, null, 2), 'utf8');

writeFileSync(join(fixture, 'data/clubs_japan.json'), JSON.stringify({
  success: true,
  data: []
}, null, 2), 'utf8');

writeFileSync(join(fixture, 'wiki/content/china-2.json'), JSON.stringify({
  club_key: 'china-2',
  title: '安理二次元同好交流圈',
  summary: '公开资料页 <script>alert(1)</script>',
  i18n: {
    ja: {
      title: 'Anri VN Circle JP',
      summary: 'Japanese summary for the wiki page.',
      infobox: {
        Region: 'JP Region'
      },
      sections: [
        { heading: 'JP Overview', level: 2, body: ['Japanese paragraph.'] }
      ]
    }
  },
  images: [
    { url: '../images/sample.png', caption: '示例图片', alt: '示例', width_percent: 50, align: 'right', fit: 'contain' }
  ],
  sections: [
    { heading: '概要', level: 2, body: ['第一段', '第二段'] },
    { heading: '活动形式', level: 3, body: ['每月组织一次交流会'] }
  ],
  references: [
    { label: '登记资料', url: '../index.html' }
  ],
  updated_at: '2026-05-14'
}, null, 2), 'utf8');

writeFileSync(join(fixture, 'wiki/content/china-3.json'), JSON.stringify({
  club_key: 'china-3',
  title: 'Incomplete Wiki Test Club',
  summary: 'Only a basic summary exists.',
  images: [],
  sections: [
    { heading: 'Overview', level: 2, body: ['Needs a fuller club introduction.'] }
  ],
  references: [],
  updated_at: '2026-05-12'
}, null, 2), 'utf8');

writeFileSync(join(fixture, 'wiki/content/china-4.json'), JSON.stringify({
  club_key: 'china-4',
  title: 'Province Alias Test Club',
  summary: 'Province aliases should be merged into one wiki region.',
  infobox: {
    地区: '四川省'
  },
  images: [],
  sections: [
    { heading: 'Overview', level: 2, body: ['This page checks province suffix normalization.'] }
  ],
  references: [],
  updated_at: '2026-05-13'
}, null, 2), 'utf8');

writeFileSync(join(fixture, 'wiki/library/index.json'), JSON.stringify({
  docs: [
    {
      title: '编写说明',
      url: './library/guide.html',
      category: '规范',
      description: '说明如何维护 Wiki 内容。',
      updated_at: '2026-05-15'
    }
  ]
}, null, 2), 'utf8');

if (escapeHtml('<b>"x"&</b>') !== '&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;') {
  throw new Error('escapeHtml should escape dangerous HTML characters');
}

if (pageNameForClubKey('china-2') !== 'china-2.html') {
  throw new Error('pageNameForClubKey should create a stable HTML filename');
}

const result = generateWikiPages({ rootDir: fixture });
if (result.count !== 3) {
  throw new Error(`Expected 3 pages, got ${result.count}`);
}

const pagePath = join(fixture, 'wiki/pages/china-2.html');
if (!existsSync(pagePath)) {
  throw new Error('Expected generated wiki HTML page');
}

const html = readFileSync(pagePath, 'utf8');
if (!html.includes('安理二次元同好交流圈')) {
  throw new Error('Generated page should contain the title');
}
if (html.includes('<script>alert(1)</script>')) {
  throw new Error('Generated page should escape content HTML');
}
if (!html.includes('&lt;script&gt;alert(1)&lt;/script&gt;')) {
  throw new Error('Generated page should preserve escaped text content');
}
if (!html.includes('<h2>概要</h2>') || !html.includes('<h3>活动形式</h3>')) {
  throw new Error('Generated page should render section heading levels');
}
if (!html.includes('wiki-image-gallery') || !html.includes('../images/sample.png')) {
  throw new Error('Generated page should render wiki images');
}
if (!html.includes('wiki-image-align-right') || !html.includes('wiki-image-fit-contain') || !html.includes('--wiki-image-width:50%')) {
  throw new Error('Generated page should render image display controls');
}
if (!html.includes('data-wiki-lang="zh"') || !html.includes('data-wiki-lang="ja"') || !html.includes('Anri VN Circle JP')) {
  throw new Error('Generated page should render Chinese and Japanese wiki bodies');
}
if (!html.includes('wikiLanguageSwitch') || !html.includes('?lang=ja')) {
  throw new Error('Generated page should expose a language switcher');
}

const manifest = JSON.parse(readFileSync(join(fixture, 'wiki/index.json'), 'utf8'));
if (manifest['china-2'].url !== './pages/china-2.html') {
  throw new Error('Manifest should point to the generated page URL');
}
if (manifest['china-2'].country !== 'china' || manifest['china-2'].region !== '安徽') {
  throw new Error('Manifest should include country and region metadata');
}
if (manifest['china-4'].region !== '四川') {
  throw new Error('Manifest should normalize Chinese province suffixes for wiki grouping');
}
if (manifest['china-2'].i18n?.ja?.title !== 'Anri VN Circle JP' || manifest['china-2'].i18n?.ja?.summary !== 'Japanese summary for the wiki page.') {
  throw new Error('Manifest should include Japanese wiki index metadata');
}

const homePath = join(fixture, 'wiki/index.html');
if (!existsSync(homePath)) {
  throw new Error('Expected generated VNFest WIKI index HTML');
}
const home = readFileSync(homePath, 'utf8');
if (!home.includes('VNFest WIKI') || !home.includes('高校同好会百科')) {
  throw new Error('Wiki index should render the encyclopedia-style VNFest WIKI home page');
}
if (!home.includes('文档库') || !home.includes('编写说明')) {
  throw new Error('Wiki index should render library documents');
}
if (!home.includes('wiki-encyclopedia-layout') || !home.includes('wiki-index-sidebar')) {
  throw new Error('Wiki index should render the encyclopedia layout shell');
}
if (!home.includes('id="recent-updates"') || !home.includes('最近更新')) {
  throw new Error('Wiki index should render the recent updates section');
}
if (!home.includes('wikiIndexLangSwitch') || !home.includes('lang=ja')) {
  throw new Error('Wiki index should expose a Chinese/Japanese language switch');
}
if (!home.includes('id="all-pages"') || !home.includes('全部页面索引')) {
  throw new Error('Wiki index should render the all-pages index');
}
if (!home.includes('id="maintenance"') || !home.includes('维护中心')) {
  throw new Error('Wiki index should render the maintenance center');
}
if (!home.includes('Incomplete Wiki Test Club') || !home.includes('完整度')) {
  throw new Error('Maintenance queue should include incomplete wiki pages with completeness hints');
}
if (home.indexOf('编写说明') > home.indexOf('安理二次元同好交流圈')) {
  throw new Error('Recent updates should sort library and wiki entries by updated_at descending');
}

writeFileSync(homePath, '<!doctype html><title>Custom wiki shell</title>', 'utf8');
generateWikiPages({ rootDir: fixture });
if (readFileSync(homePath, 'utf8') !== '<!doctype html><title>Custom wiki shell</title>') {
  throw new Error('Generator should preserve an existing wiki homepage shell');
}

rmSync(fixture, { recursive: true, force: true });
console.log('wiki generator tests passed');
