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
		// 工具函数：将 av 转换为 bv
		const XOR_CODE = 23442827791579n;
		const MAX_AID = 1n << 51n;
		const BASE = 58n;
		const data = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';
		function av2bv(av) {
			const aid = av.startsWith('av') ? av.slice(2) : av;
			const bytes = ['B', 'V', '1', '0', '0', '0', '0', '0', '0', '0', '0', '0'];
			let bvIndex = bytes.length - 1;
			let tmp = (MAX_AID | BigInt(aid)) ^ XOR_CODE;
			while (tmp > 0) {
				bytes[bvIndex] = data[Number(tmp % BigInt(BASE))];
				tmp = tmp / BASE;
				bvIndex -= 1;
			}
			[bytes[3], bytes[9]] = [bytes[9], bytes[3]];
			[bytes[4], bytes[7]] = [bytes[7], bytes[4]];
			return bytes.join('');
		}

		// 提取 BV 号
		let bvId = null;
		if (url.includes("BV")) {
			const match = url.match(/BV[^/?&#]+/);
			bvId = match ? match[0] : null;
		} else if (url.includes("av")) {
			const match = url.match(/av\d+/i);
			if (match) bvId = av2bv(match[0]);
		}

		if (!bvId) throw new Error("无法提取视频编号");

		// 设置 B站 API 请求头
		const biliHeaders = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Referer': 'https://www.bilibili.com/',
			'Origin': 'https://www.bilibili.com',
			'Accept': 'application/json, text/plain, */*',
			'Accept-Language': 'zh-CN,zh;q=0.9',
			'Accept-Encoding': 'gzip, deflate, br',
			'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
			'Sec-Ch-Ua-Mobile': '?0',
			'Sec-Ch-Ua-Platform': '"Windows"',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-site'
		};

		// 获取 cid
		const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvId}`;
		const infoRes = await fetch(infoUrl, { headers: biliHeaders });
		const videoData = await infoRes.json();
		const cid = videoData.data?.cid;
		if (!cid) throw new Error("获取 cid 失败");

		// 获取播放地址（qn=80 表示高清 1080P，可根据需要调整）
		const playUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvId}&cid=${cid}&qn=116&type=&otype=json&platform=html5&high_quality=1`;
		const playRes = await fetch(playUrl, { headers: biliHeaders });
		const playData = await playRes.json();
		const videoUrl = playData.data.durl[0].url;

		if (!videoUrl) throw new Error("无法获取视频直链");

		return videoUrl;
	}
};
