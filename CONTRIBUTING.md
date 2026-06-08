# 参与贡献

## 工作流程

1. 从 `main` 分支创建功能分支：`git checkout -b feat/你的功能`
2. 在分支上开发并本地测试
3. 推送到远程：`git push origin feat/你的功能`
4. 在 GitHub 上创建 Pull Request 合并到 `main`
5. PR 会自动触发 Docker 构建检查，通过后等待 Review 合并

## 分支命名

- `feat/xxx` — 新功能
- `fix/xxx` — 修复
- `refactor/xxx` — 重构
- `chore/xxx` — 杂项（依赖、配置等）

## 本地开发

项目基于 Docker，本地开发时：

```bash
docker compose up -d
```

修改 PHP 代码后直接刷新即可（源码通过 volume 挂载）。
修改 Dockerfile 或需要安装新的 PHP 扩展则需要重新构建：

```bash
docker compose build
docker compose up -d
```

## 提交 PR 前检查

- [ ] 代码在本地 `docker compose build` 能通过
- [ ] 没有留下调试用的 `var_dump`、`console.log` 等
- [ ] 涉及数据库变更的，确认迁移脚本已添加

## 部署

合并到 `main` 后，GitHub Actions 会自动构建镜像并推送到 ghcr.io。
生产服务器上的 Watchtower 会自动检测新镜像并热更新容器，无需手动操作。
