# Cloudflare Pages 部署说明

## 当前状态：✅ 已上线

| 项 | 值 |
| :--- | :--- |
| **线上地址** | **https://blog.example.com** |
| Pages 项目名 | `fuwari-blog` |
| 默认域名 | https://fuwari-blog-8mu.pages.dev |
| 自定义域名 | `blog.example.com`（绑定状态 `active`） |
| 证书 | Let's Encrypt（`CN=example.com`），TLS 1.3 |
| 账号 | `you@example.com`（Account ID `<ACCOUNT_ID>`） |
| Zone | `example.com`（Zone ID `<ZONE_ID>`） |
| 技术栈 | **Astro 7.4.0-beta.1** + Tailwind CSS 4 |

**DNS 记录**（已创建，id `b57a33d1e8947e318bf888c239e671ac`）：

| Type | Name | Target | Proxy |
| :--- | :--- | :--- | :--- |
| CNAME | `blog` | `fuwari-blog-8mu.pages.dev` | Proxied |

> 注意：`example.com` 这个 zone 上还跑着 **Email Routing**（3 条 MX + DKIM + SPF），
> 增删记录时不要碰 `example.com` 根域和 `cf2024-1._domainkey` / `google._domainkey` 那几条。

## 技术栈版本（2026-10-05 升级）

| 组件 | 版本 | 备注 |
| :--- | :--- | :--- |
| astro | 7.4.0-beta.1 | 原 5.13.10 |
| tailwindcss | 4.3.3 | 原 3.4.19 |
| @tailwindcss/vite | 4.3.3 | 取代已废弃的 `@astrojs/tailwind` |
| @astrojs/svelte | 9.0.1 | peer 要求 astro ^7 |
| @astrojs/markdown-remark | 7.3.1 | v7 起不再默认安装 |

详见下方「从 Astro 5 升级到 7 的要点」。

## 从 Astro 5 升级到 7 的要点（本次实际踩到的）

如果以后要再升级，或上游 Fuwari 更新后需要合并，注意这几处：

1. **Markdown 处理器换了**：Astro 7 默认用 Sätteri，`@astrojs/markdown-remark` 不再默认安装。
   用了 `remarkPlugins`/`rehypePlugins` 就必须手动装上它。
2. **`@astrojs/tailwind` 已废弃**：改用 `@tailwindcss/vite` Vite 插件（配在 `vite.plugins`，
   不是在 `integrations` 里），并删除 `tailwind.config.cjs` 与 `postcss.config.mjs`。
3. **Tailwind v4 的 `@apply` 限制**：`@layer components` 里自定义的类**不能**被其他规则 `@apply`，
   必须用 `@utility` 定义（本项目改了 `expand-animation`、`link`、`link-lg`、`btn-regular-dark`）。
4. **组件 `<style>` 块里的 `@apply`**：需要 `@reference "../styles/main.css";` 才能解析主题与工具类。
5. **`!important` 写法变了**：`@apply xxx !important` → `@apply !xxx`（负值写 `!-m-0.5`）。
6. **Content Collections 迁移**：`src/content/config.ts` → `src/content.config.ts`，
   每个 collection 显式声明 `loader: glob({...})`。
7. **`entry.render()` → `render(entry)`**，**`entry.slug` → `entry.id`**（v6 起移除）。
8. **空白折叠变化**：新编译器不再把换行折叠成空格，模板里相邻元素间的空格要显式写 `{" "}`。

## 验收记录（2026-10-05）

| 检查项 | 结果 |
| :--- | :--- |
| `/`、`/about/`、`/archive/`、`/posts/hello-world/` | 200 |
| `/rss.xml`、`/sitemap-index.xml`、`/robots.txt` | 200 |
| 静态资源（12 个 `_astro/*.js\|css`） | 全部 200（无白屏风险） |
| 不存在路径 | **404**（真状态码，非首页兜底） |
| `http://` → `https://` | 301 跳转 |
| RSS / sitemap / robots 内绝对链接 | 均指向 `https://blog.example.com/` |
| TLS | Let's Encrypt，TLS 1.3，`CN=example.com` |
| 截图目视 | 首页、文章页、404 页布局与风格正常 |

## 部署方式

### 方式一：命令行手动部署（当前使用）

推代码到 GitHub 后，本地跑：

```bash
pnpm build     # 或 npm run build
npx wrangler pages deploy dist --project-name=fuwari-blog --branch=main
```

### 方式二：Git 自动部署（推荐开启，需在面板开一次）

推代码后自动构建发布，不用手工跑命令。

在 Cloudflare 面板：**Workers & Pages → fuwari-blog → Settings → Builds & deployments
→ Connect to Git**，选择 `yys9253462-gif/fuwari`，然后填：

| 配置项 | 值 |
| :--- | :--- |
| Production branch | `main` |
| Build command | `npm install --ignore-scripts --legacy-peer-deps && npm run build` |
| Build output directory | `dist` |

> **为什么 build command 这么写**：本仓库 `package.json` 的 `preinstall` 是
> `npx only-allow pnpm`，Cloudflare 构建机默认用 npm 会被它拦下报错。
> 加 `--ignore-scripts` 跳过该检查；`--legacy-peer-deps` 规避 peer 依赖冲突。
> `npm run build` 内部走 `astro build && pagefind --site dist`。

## 本地开发

```bash
pnpm dev       # 本地开发服务器 http://localhost:4321
pnpm build     # 构建到 dist/
pnpm preview   # 预览构建产物
```

> **本机安装依赖的坑**：本机 pnpm 11 全局配置里有个未决的 `allowBuilds` 项
> （`agent-browser`），会导致 `pnpm install` 静默不动、不生成 `node_modules`。
> 遇到这种情况改用：
> ```bash
> npm install --ignore-scripts --legacy-peer-deps
> ```

> **构建报 `The link class does not exist` 时**：这是缓存问题，不是代码问题
> （`.link` 在 `src/styles/main.css` 的 `@layer components` 里有定义）。
> 清缓存即可：
> ```bash
> rm -rf .astro dist node_modules/.vite && npx astro build
> ```

```bash
pnpm build
npx wrangler pages deploy dist --project-name=fuwari-blog --branch=main
```

### 方式二：Git 自动部署（推荐，需在面板开一次）

推代码后自动构建发布，不用手工跑命令。

在 Cloudflare 面板：**Workers & Pages → fuwari-blog → Settings → Builds & deployments
→ Connect to Git**，选择 `yys9253462-gif/fuwari`，然后填：

| 配置项 | 值 |
| :--- | :--- |
| Production branch | `main` |
| Build command | `npm install --ignore-scripts --legacy-peer-deps && npm run build` |
| Build output directory | `dist` |

> **为什么 build command 这么写**：本仓库 `package.json` 的 `preinstall` 是
> `npx only-allow pnpm`，Cloudflare 构建机默认用 npm 会被它拦下报错。
> 加 `--ignore-scripts` 跳过该检查；`--legacy-peer-deps` 规避 peer 依赖冲突。
> `npm run build` 内部走 `astro build && pagefind --site dist`。

## 本地开发

```bash
pnpm dev       # 本地开发服务器 http://localhost:4321
pnpm build     # 构建到 dist/
pnpm preview   # 预览构建产物
```

> **本机安装依赖的坑**：本机 pnpm 11 全局配置里有个未决的 `allowBuilds` 项
> （`agent-browser`），会导致 `pnpm install` 静默不动、不生成 `node_modules`。
> 遇到这种情况改用：
> ```bash
> npm install --ignore-scripts --legacy-peer-deps
> ```

## 写新文章

```bash
pnpm new-post 我的文章名
```

然后编辑 `src/content/posts/我的文章名.md`，frontmatter 格式：

```yaml
---
title: 文章标题
published: 2026-10-05
description: 摘要，会显示在列表页
tags: [标签1, 标签2]
category: 分类名
draft: false
---
```

## 站点配置位置

| 要改什么 | 改哪个文件 |
| :--- | :--- |
| 域名（`site`） | `astro.config.mjs` 的 `site` 字段 |
| 站点标题/副标题/语言 | `src/config.ts` 的 `siteConfig` |
| 导航栏链接 | `src/config.ts` 的 `navBarConfig` |
| 头像/昵称/简介/社交链接 | `src/config.ts` 的 `profileConfig` |
| 横幅图 | `src/config.ts` 的 `siteConfig.banner` |
| 404 页面文案 | `src/pages/404.astro` |
