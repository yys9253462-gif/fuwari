---
title: 博客上线了
published: 2026-10-05
description: 用 Astro + Fuwari + Cloudflare Pages 搭好这个博客的第一篇记录。
tags: [Astro, Cloudflare, 博客]
category: 技术
draft: false
---

## 起因

想要一个自己的地方放技术笔记，要求很简单：**加载快、免费、能写 Markdown**。

试过 Ghost（重，要维护服务器和数据库），最后还是回到静态站：
写完推 Git，Cloudflare 自动构建发布，一年到头不用管服务器。

## 技术栈

| 部分 | 选型 |
| :--- | :--- |
| 框架 | Astro 7（纯静态输出） |
| 主题 | Fuwari |
| 样式 | Tailwind CSS 4 |
| 托管 | Cloudflare Pages |
| 搜索 | Pagefind（构建时生成索引） |
| 评论 | 未启用 |

## 为什么是纯静态

Astro 默认输出静态 HTML，构建完就是一堆 `.html` + `.js` + `.css`，
扔到任何静态托管上都能跑。这意味着：

- 没有服务器要运维，没有数据库要备份
- 全球 CDN 直接命中边缘节点，首屏很快
- 免费额度对个人博客绰绰有余

## 部署方式

代码推送到 GitHub 后，Cloudflare Pages 自动拉取、构建、发布：

```bash
pnpm build   # astro build && pagefind --site dist
```

产物在 `dist/`，Cloudflare 检测到这个目录后直接发布到边缘网络。

## 后续计划

- [x] 配好自定义域名和 SEO
- [ ] 把旧的技术笔记搬过来
- [ ] 写一篇技术文章（不是这种建站记录）

::github{repo="yys9253462-gif/fuwari"}