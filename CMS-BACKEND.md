# 博客后台（Decap CMS）

给博客加了一个网页后台，在浏览器里就能写文章、传图、发布，**不用碰命令行**。

## 怎么用

1. 打开 **https://blog.example.com/admin/**
2. 点「Login with GitHub」→ 用 GitHub 账号授权（**只有仓库协作者能登录**）
3. 左侧「文章」→ 新建 / 编辑 → 写完点 **Publish**
4. Decap 会把 Markdown 直接提交到 GitHub 仓库的 `main` 分支
5. Cloudflare Pages 检测到提交 → 自动重新构建 → 约 1 分钟后线上更新

图片直接在编辑器里拖拽上传，自动存到 `public/images/uploads/`。

## 架构

```
浏览器 /admin/
   ↓ 点登录
GET /api/auth          ← Cloudflare Pages Function
   ↓ 302 跳转
github.com/login/oauth/authorize
   ↓ 用户授权，带 code 回调
GET /api/callback?code=xxx   ← Cloudflare Pages Function
   ↓ 用 client_secret 换 access_token（secret 不出服务端）
   ↓ 返回 HTML，用 postMessage 把 token 交给 CMS 弹窗
Decap CMS 登录完成，开始读写 GitHub 仓库
```

**为什么需要那两个 Function**：Cloudflare Pages 是纯静态托管，没有 Netlify 那种内置的
git-gateway / Identity 服务。Decap CMS 用 GitHub 后端时必须有人拿 `client_secret` 去换
`access_token`，而这步绝不能放浏览器里做（会泄露 secret），所以用 Pages Function 代劳。

## 文件结构

| 文件 | 作用 |
| :--- | :--- |
| `public/admin/index.html` | 后台入口，加载 Decap CMS（`public/` 会原样拷进 `dist/`） |
| `public/admin/config.yml` | CMS 配置：内容模型、字段、上传路径 |
| `functions/api/auth.js` | OAuth 第一步：跳转 GitHub 授权页 |
| `functions/api/callback.js` | OAuth 第二步：换 token 并 postMessage 回传 |

> `functions/` 目录**不会**进 `dist/`，它由 Cloudflare Pages 单独编译成 Worker。
> 部署时日志里出现 `✨ Compiled Worker successfully` + `✨ Uploading Functions bundle`
> 就说明 Functions 生效了。

## ⚠️ 待办：配置 OAuth 凭据（否则后台登录不了）

代码已部署，但**登录还差两步**，都需要你手动做一次：

### 第 1 步：创建 GitHub OAuth App

打开 https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**，填：

| 字段 | 值 |
| :--- | :--- |
| Application name | `Teyir Blog CMS`（随意） |
| Homepage URL | `https://blog.example.com` |
| Authorization callback URL | `https://blog.example.com/api/callback` |

> ⚠️ 回调地址**必须精确**为 `https://blog.example.com/api/callback`，一个字符都不能差。

创建后记下 **Client ID**，再点 **Generate a new client secret** 生成 **Client Secret**
（secret 只显示一次，先复制下来）。

### 第 2 步：在 Cloudflare Pages 配环境变量

进入 Cloudflare 面板 → **Workers & Pages** → `fuwari-blog` → **Settings** →
**Environment variables** → 添加两条（Production 和 Preview 都加）：

| 变量名 | 值 | 类型 |
| :--- | :--- | :--- |
| `GITHUB_CLIENT_ID` | 上一步的 Client ID | Plaintext |
| `GITHUB_CLIENT_SECRET` | 上一步的 Client Secret | **Secret（加密）** |

> **必须加密存 `GITHUB_CLIENT_SECRET`**。它一旦泄露，任何人都能以你的身份读写仓库。

配完**重新部署一次**（环境变量对已运行的 Worker 不生效）：

```bash
npx wrangler pages deploy dist --project-name=fuwari-blog --branch=main
```

### 验证

配好后打开 https://blog.example.com/admin/ 点登录，能正常跳到 GitHub 授权页就说明通了。
若报错，页面会直接显示是哪个环节出问题（缺环境变量 / 回调地址不对 / secret 无效）。

## 安全说明

- **只有仓库协作者能登录**：GitHub OAuth 授权后，Decap 会核对登录者对仓库的写权限，
  非协作者即使完成了 OAuth 也进不去。
- `client_secret` 只存在于 Cloudflare 环境变量，**永不进浏览器**。
- `/api/callback` 的响应带 `no-store`，且 token 只用一次、不落盘、不记日志。
- 后台页面带 `<meta name="robots" content="noindex, nofollow">`，不会被搜索引擎收录。
- ⚠️ 后台地址是公开可访问的（`/admin/`），安全边界完全依赖 GitHub 的 OAuth 与仓库权限。
  这是 Decap 这类 Git-based CMS 的固有模式——**不是漏洞**，但你要知道它靠什么保护。

## 本地开发（可选）

想在本地用后台调试（不连 GitHub、直接写本地文件），在 `config.yml` 顶部加：

```yaml
local_backend: true
```

然后开两个终端：

```bash
npx decap-server          # 终端 1：本地 Git 代理（默认 8081 端口）
pnpm dev                  # 终端 2：Astro 开发服务器
```

访问 http://localhost:4321/admin/ 即可**免登录**直接编辑本地 Markdown 文件。
⚠️ 用完记得把 `local_backend: true` 去掉，**别提交到仓库**（本地代理不该上生产）。

## 已知限制

- **需要 GitHub 账号**才能登录后台。就你一个人写博客，这不是问题。
- Decap CMS 的 Markdown 编辑器是简单的所见即所得，不支持本站特有的
  `::github{repo="..."}` 这类指令的图形化插入——需要手写。写普通文章不受影响。
- 升级 Decap 时，要**同时改两处版本号**：`public/admin/index.html` 里的 CDN 链接，
  以及 `package.json` 里的 `decap-cms` 依赖（当前锁 `3.16.3`）。
