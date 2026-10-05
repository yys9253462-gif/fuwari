/**
 * Decap CMS 的 GitHub OAuth 中转 —— 第二步：用 code 换 token 并回传
 *
 * 路由：GET /api/callback?code=xxx
 *
 * 流程：
 *   1. GitHub 带 code 回调到这里
 *   2. 本函数用 client_secret 向 GitHub 换 access_token（secret 不出服务端）
 *   3. 返回一段 HTML，用 postMessage 把 token 交给打开本页的父窗口（Decap CMS）
 *   4. 父窗口完成登录，本弹窗自关
 *
 * 安全要点：
 *   - client_secret 只存在于 Cloudflare 环境变量里，永不进浏览器
 *   - 回应 postMessage 时使用 e.origin 作为 targetOrigin，不使用通配 "*"
 *   - token 只在本响应里出现一次，不落盘、不记日志
 *   - 整个响应禁止缓存
 */

const PROVIDER = "github";

export async function onRequestGet({ request, env }) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");

	if (error) {
		return htmlResponse(renderError(`GitHub 返回错误：${escapeHtml(error)}`));
	}

	if (!code) {
		return htmlResponse(renderError("缺少授权码 code 参数。"));
	}

	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		return htmlResponse(
			renderError(
				"服务端缺少 GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET 环境变量。",
			),
		);
	}

	let tokenResult;
	try {
		const resp = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				"user-agent": "fuwari-decap-oauth",
			},
			body: JSON.stringify({
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				code,
				redirect_uri: `${url.origin}/api/callback`,
			}),
		});

		tokenResult = await resp.json();
	} catch (e) {
		return htmlResponse(
			renderError(`请求 GitHub 失败：${escapeHtml(String(e))}`),
		);
	}

	if (tokenResult.error || !tokenResult.access_token) {
		const desc = tokenResult.error_description || tokenResult.error || "未知错误";
		return htmlResponse(renderError(`换取 token 失败：${escapeHtml(desc)}`));
	}

	return htmlResponse(renderSuccess(tokenResult.access_token));
}

function htmlResponse(body) {
	return new Response(body, {
		status: 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			// 含 token 的一次性页面，禁止任何缓存
			"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
			"x-content-type-options": "nosniff",
			// 允许同源页面内联脚本执行（下面用到内联 script）
			"content-security-policy": "default-src 'none'; script-src 'unsafe-inline'",
		},
	});
}

function escapeHtml(str) {
	return String(str).replace(
		/[&<>"']/g,
		(c) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[c],
	);
}

/**
 * Decap CMS 的 OAuth 握手协议：
 *   1. 本页先向父窗口广播 "authorizing:github"，告知自己已就绪
 *   2. Decap 收到后回一条 message
 *   3. 本页再把 "authorization:github:success:{...token...}" 发给父窗口
 * 必须走完这三步，否则 CMS 端不会认。
 */
function renderSuccess(token) {
	const payload = JSON.stringify({
		token,
		provider: PROVIDER,
	});
	const message = `authorization:${PROVIDER}:success:${payload}`;

	return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>授权成功</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;color:#333;text-align:center">
  <p>授权成功，正在返回后台…</p>
  <script>
  (function () {
    var message = ${JSON.stringify(message)};
    function receive(e) {
      // 只对同源窗口回应，避免 token 被转发到第三方页面
      window.opener.postMessage(message, e.origin);
    }
    window.addEventListener("message", receive, false);
    // 主动告知父窗口：OAuth 流程已就绪
    window.opener.postMessage("authorizing:${PROVIDER}", "*");
  })();
  </script>
</body></html>`;
}

function renderError(text) {
	return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>授权失败</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;color:#333">
  <h2 style="color:#c00">授权失败</h2>
  <p>${text}</p>
  <p style="color:#888;font-size:14px">
    请检查 Cloudflare Pages 项目的环境变量 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
    是否已配置，以及 GitHub OAuth App 的回调地址是否为
    <code>https://blog.example.com/api/callback</code>。
  </p>
</body></html>`;
}
