# Wiki 刊物 3D 阅读器

这个目录承载 Wiki 刊物资料库的 3D 翻页阅读能力。正式入口在 `wiki/publications.html`，读者通过 `tools/pdf-reader/?preview_id=<id>` 打开公开刊物预览。

## 来源

- 上游仓库：https://github.com/Simingchen/pdfReader
- 默认分支：`master`
- 拉取日期：2026-06-20
- 本地 vendor 目录：`tools/pdf-reader/vendor/pdfReader/`

上游仓库 README 说明：

- PDF 预览入口为 `pdf/viewer.html?file=...`
- 3D 翻页入口为 `index.html`
- 3D 翻页依赖 `css/`、`js/`、`images/`、`voice/`、`files/thumb/` 等静态资源

## 本地访问

启动项目根目录的 PHP 开发服务：

```bash
php -S 127.0.0.1:8000
```

打开：

```text
http://127.0.0.1:8000/wiki/publications.html
http://127.0.0.1:8000/tools/pdf-reader/?preview_id=<id>
```

## 数据与接口

```text
api/publication_previews.php?action=list
api/publication_previews.php?action=book_data&preview_id=<id>
api/publication_previews.php?action=create
api/publication_previews.php?action=upload_page
api/publication_previews.php?action=publish
api/publication_previews.php?action=delete
```

元数据保存在 `data/publication_previews.json`，页面图保存在 `uploads/publication_previews/<preview_id>/pages/`。这些都是运行时数据，不进入 Git。

## 边界

- 正式阅读只使用 3D 翻页功能，不暴露 PDF viewer tab。
- PDF 转页面图在浏览器端完成，后端只保存页面图和索引。
- 同好会 `manager` / `representative` 或超管可发布；发布完成后即时公开。
- 旧的 `api/manuscripts.php` 投稿/下载流不参与公开刊物预览，避免把投稿稿件和资料库刊物混在一起。

## 授权提醒

上游仓库当前未见明确 license 文件。正式公开长期使用前，需要确认授权，或替换为明确授权的 `pdf.js`/翻页库组合。
