/**
 * Decap CMS 的 GitHub OAuth 中转 —— 第一步：跳转到 GitHub 授权页
 *
 * 路由：GET /api/auth
 *
 * 为什么需要这个：
 *   Cloudflare Pages 是纯静态托管，没有 Netlify 那种内置的 git-gateway / Identity。
 *   Decap CMS 用 GitHub 后端时必须有人用 client_secret 去换 access_token，
 *   而这步不能放在浏览器里做（会泄露 secret），所以用 Pages Function 代劳。
 *
 * 依赖的环境变量（在 Cloudflare Pages 项目设置里配）：
 *   GITHUB_CLIENT_ID     —— GitHub OAuth App 的 Client ID
 *   GITHUB_CLIENT_SECRET —— GitHub OAuth App 的 Client Secret（务必加密存储）
 */

export async function onRequestGet({ request, env }) {
	const url = new URL(request.url);

	if (!env.GITHUB_CLIENT_ID) {
		return new Response(
			"缺少环境变量 GITHUB_CLIENT_ID，请在 Cloudflare Pages 项目设置中配置。",
			{ status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
		);
	}

	// Decap 会带上 ?provider=github&site_id=... 之类的参数，这里只需回跳到 callback
	const state = crypto.randomUUID();

	const authUrl = new URL("https://github.com/login/oauth/authorize");
	authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
	authUrl.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
	authUrl.searchParams.set("scope", "repo,user");
	authUrl.searchParams.set("state", state);

	return Response.redirect(authUrl.toString(), 302);
}
