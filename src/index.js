/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.js` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.js --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {

		const url = new URL(request.url)

		const targetUrl = url.searchParams.get('url')

		if (!targetUrl) {
			return new Response('Error: Missing URL parameter', { status: 400 })
		}

		// 设置请求头，模拟浏览器访问
		const headers = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
		}

		try {


			if (targetUrl.indexOf('bilibili.com') != -1) {
				return Response.redirect('https://jx.91vrchat.com/bl/?url=' + targetUrl, 302)
			} else {
				// 发送GET请求 构建
				const response = await fetch(targetUrl, { headers })
				const bodyText = await response.text()

				// 使用正则表达式匹配playAddr
				const match = bodyText.match(/"playAddr":{.*?}/s)
				if (match) {
					const playAddrJsonStr = match[0]
					const playAddrJson = JSON.parse('{' + playAddrJsonStr + '}')

					// 提取视频链接
					const videoUrl = playAddrJson.playAddr.ori_m3u8
					if (videoUrl) {
						// 重定向到视频地址
						return Response.redirect(videoUrl, 302)
					} else {
						return new Response('Error: Video URL not found in the response.', { status: 404 })
					}
				} else {
					return new Response('Error: No playAddr JSON object found in the HTML.', { status: 404 })
				}
			}

		} catch (error) {
			return new Response(`An error occurred: ${error}`, { status: 500 })
		}
	}

};
