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

		// 设置请求头，模拟真实浏览器访问，避免触发风控
		const headers = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
			'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
			'Accept-Encoding': 'gzip, deflate, br',
			'Cache-Control': 'max-age=0',
			'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
			'Sec-Ch-Ua-Mobile': '?0',
			'Sec-Ch-Ua-Platform': '"Windows"',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'none',
			'Sec-Fetch-User': '?1',
			'Upgrade-Insecure-Requests': '1',
			'Referer': targetUrl
		}

		try {


			if (targetUrl.indexOf('bilibili.com') != -1) {
				const finalUrl = await this.parseBilibiliVideo(targetUrl);
				// let data =  new Response(finalUrl)
				console.log(finalUrl)
				// return new Response(finalUrl, { status: 200 })
				return Response.redirect(finalUrl, 302)
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
	},
	// ========== 核心函数部分 ==========

	/**
	 * 解析 Bilibili 视频直链地址
	 * @param {string} url 完整的 Bilibili 视频页面 URL（支持 BV / AV 号）
	 * @returns {Promise<string>} 返回视频直链地址（MP4）
	 */
	async parseBilibiliVideo(url) {
		// 提取 BV 或 AV 号
		let videoId = null;
		if (url.includes("BV")) {
			const match = url.match(/BV[^/?&#]+/);
			videoId = match ? match[0] : null;
		} else if (url.includes("av")) {
			const match = url.match(/av\d+/i);
			videoId = match ? match[0] : null;
		}

		if (!videoId) throw new Error("无法提取视频编号");

		// 方案1: 使用第三方解析服务（推荐）
		// 这些服务已经处理好了B站的风控问题
		try {
			// 尝试使用公开的B站解析API
			const parseApiUrl = `https://api.injahow.cn/bparse/?url=https://www.bilibili.com/video/${videoId}`;
			const parseRes = await fetch(parseApiUrl);
			const parseData = await parseRes.json();
			
			if (parseData.code === 0 && parseData.data?.url) {
				return parseData.data.url;
			}
		} catch (e) {
			console.log('第三方解析失败，尝试备用方案:', e.message);
		}

		// 方案2: 返回iframe嵌入链接（B站官方播放器）
		// 这个方案不会被ban，因为是使用B站官方播放器
		return `https://player.bilibili.com/player.html?bvid=${videoId}&high_quality=1&autoplay=1`;
	}
};
