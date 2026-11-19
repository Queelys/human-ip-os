// 把 dist-artifact 里的 JS / CSS 内联成一个 HTML 片段，用于发布成 claude.ai 页面
// （发布时宿主会自动包上 <html><head><body>，所以这里只输出内容部分）
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist-artifact'
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const read = (href) => readFileSync(join(dir, href.replace(/^\.?\//, '')), 'utf8')

const cssHref = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)[1]
const jsSrc = html.match(/<script type="module"[^>]*src="([^"]+)"/)[1]
const css = read(cssHref)
const js = read(jsSrc).replace(/<\/script/gi, '<\\/script')

const out = `<title>AI PM Coach</title>
<meta name="description" content="15 分钟测出你的 AI 产品经理能力短板">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
writeFileSync(join(dir, 'ai-pm-coach.html'), out)
console.log(`wrote ${dir}/ai-pm-coach.html (${(out.length / 1024).toFixed(0)} KB)`)
