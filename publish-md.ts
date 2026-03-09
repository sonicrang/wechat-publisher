import { initRenderer } from './src/doocs-md/core/src/index'
import { marked } from 'marked'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

// ============ 读取配置文件 ============
interface Config {
  wechat: {
    appId: string
    appSecret: string
  }
  author?: string
}

function loadConfig(): Config {
  const configPath = path.join(process.cwd(), 'config.yaml')
  if (!fs.existsSync(configPath)) {
    throw new Error('配置文件 config.yaml 不存在，请复制 config.example.yaml 并填写配置')
  }
  const configContent = fs.readFileSync(configPath, 'utf-8')
  return yaml.load(configContent) as Config
}

const CONFIG = loadConfig()
const WECHAT_APPID = CONFIG.wechat?.appId || process.env.WECHAT_APPID
const WECHAT_APPSECRET = CONFIG.wechat?.appSecret || process.env.WECHAT_APPSECRET
const DEFAULT_AUTHOR = CONFIG.author || 'Anonymous'

// ============ 内联样式映射 ============
const PRIMARY_COLOR = '#B76E79'
const FONT_FAMILY = '-apple-system-font,BlinkMacSystemFont,Helvetica Neue,PingFang SC,Hiragino Sans GB,Microsoft YaHei UI,Microsoft YaHei,Arial,sans-serif'

const STYLES: Record<string, string> = {
  h1: `display:table;padding:0.5em 1em;border-bottom:2px solid ${PRIMARY_COLOR};margin:2em auto 1em;color:#333;font-size:22.4px;font-weight:bold;text-align:center;`,
  h2: `display:table;padding:0.3em 1em;margin:4em auto 2em;color:#fff;background:${PRIMARY_COLOR};font-size:20.8px;font-weight:bold;text-align:center;border-radius:8px;`,
  h3: `padding-left:12px;border-left:4px solid ${PRIMARY_COLOR};border-bottom:1px dashed ${PRIMARY_COLOR};margin:2em 8px 0.75em 0;color:#333;font-size:19.2px;font-weight:bold;line-height:1.2;`,
  h4: `margin:2em 8px 0.5em;color:${PRIMARY_COLOR};font-size:17.6px;font-weight:bold;`,
  p: `margin:1.5em 0; padding:0 8px; box-sizing:border-box; letter-spacing:0.1em;color:#333;line-height:1.75;`,
  blockquote: `font-style:italic;padding:1em 1em 1em 2em;border-left:4px solid ${PRIMARY_COLOR};border-radius:6px;color:rgba(0,0,0,0.6);background:#f7f7f7;margin:1em 8px;font-size:16px;`,
  ul: 'list-style:none;padding-left:1.5em;margin:1.5em 8px;',
  ol: 'padding-left:1em;margin-left:0;',
  li: 'display:block;margin:0.5em 8px;color:#333;',
  code: 'font-size:90%;color:#d14;background:rgba(27,31,35,0.05);padding:3px 5px;border-radius:4px;font-family:Monaco,Consolas,monospace;',
  pre: 'font-size:90%;overflow-x:auto;border-radius:8px;padding:16px !important;line-height:1.5;margin:10px 8px;background:#0d1117;display:block;',
  table: 'color:#333;width:100%;border-collapse:separate;border-spacing:0;border-radius:8px;margin:0.5em 8px;overflow:hidden;border:1px solid #dfdfdf;',
  th: `border:1px solid #dfdfdf;padding:0.5em 1em;background:${PRIMARY_COLOR};color:#fff;font-weight:bold;text-align:left;`,
  td: 'border:1px solid #dfdfdf;padding:0.5em 1em;text-align:left;',
  strong: `color:${PRIMARY_COLOR};font-weight:bold;`,
  a: 'color:#576b95;text-decoration:none;',
  img: 'width:100%;max-width:100%;height:auto;margin:0;border-radius:4px;display:block;',
  figure: 'margin:0.35em 0;width:100%;box-sizing:border-box;padding:0 8px;',
  figcaption: 'text-align:center;color:#888;font-size:0.8em;',
  hr: 'border-style:solid;border-width:1px 0 0;border-color:rgba(0,0,0,0.1);margin:1.5em 0;',
  footnotes: 'margin:0.5em 8px;font-size:80%;color:#333;',
  section: `font-family:${FONT_FAMILY};font-size:16px;line-height:1.75;text-align:left;`,
  'code.hljs': 'display:block;padding:16px 50px 16px 16px;overflow-x:auto;color:#c9d1d9;background:none;white-space:pre;margin:0;font-family:Monaco,Consolas,monospace;',
}

// ============ 微信 API 工具 ============

async function getAccessToken(): Promise<string> {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APPID}&secret=${WECHAT_APPSECRET}`
  const response = await fetch(url)
  const data: any = await response.json()
  if (data.access_token) return data.access_token
  throw new Error(`获取 access_token 失败: ${JSON.stringify(data)}`)
}

async function uploadImage(accessToken: string, imagePath: string): Promise<{url: string, mediaId: string}> {
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`
  const imageBuffer = fs.readFileSync(imagePath)
  const boundary = `----WebKitFormBoundary${Date.now()}`
  const formData = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${path.basename(imagePath)}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ])
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: formData,
  })
  const data: any = await response.json()
  if (data.url && data.media_id) {
    return { url: data.url, mediaId: data.media_id }
  }
  throw new Error(`上传图片失败: ${JSON.stringify(data)}`)
}

async function getCoverImage(accessToken: string): Promise<string | null> {
  const url = `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${accessToken}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ type: 'image', offset: 0, count: 1 }),
  })
  const data: any = await response.json()
  return data.item?.[0]?.media_id || null
}

async function publishDraft(accessToken: string, title: string, content: string, thumbMediaId: string, options: { author?: string; digest?: string } = {}): Promise<string> {
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`
  const article: any = { title, content, thumb_media_id: thumbMediaId }
  if (options.author) article.author = options.author
  if (options.digest) article.digest = options.digest
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ articles: [article] }),
  })
  const data: any = await response.json()
  if (data.media_id) return data.media_id
  throw new Error(`发布草稿失败: ${JSON.stringify(data)}`)
}

// 顺序处理图片（保证第一张作为封面）
async function processImages(markdown: string, mdDir: string, accessToken: string): Promise<{ content: string; images: string[]; firstMediaId?: string }> {
  const images: string[] = []
  let firstMediaId: string | undefined
  let content = markdown
  
  // 找出所有本地图片
  const matches: Array<{full: string, alt: string, path: string, index: number}> = []
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(markdown)) !== null) {
    const imgPath = match[2]
    if (!imgPath.startsWith('http://') && !imgPath.startsWith('https://')) {
      matches.push({
        full: match[0],
        alt: match[1],
        path: imgPath,
        index: match.index
      })
    }
  }
  
  console.log(`   发现 ${matches.length} 张本地图片`)
  
  // 按顺序处理（先上传第一张作为封面）
  for (let i = 0; i < matches.length; i++) {
    const { full, alt, path: imgPath } = matches[i]
    const fullPath = path.resolve(mdDir, imgPath)
    
    if (!fs.existsSync(fullPath)) {
      console.log(`   ⚠️  图片不存在: ${imgPath}`)
      continue
    }
    
    try {
      console.log(`   📤 上传图片 ${i+1}/${matches.length}: ${path.basename(imgPath)}...`)
      const { url, mediaId } = await uploadImage(accessToken, fullPath)
      images.push(url)
      
      // 第一张作为封面
      if (i === 0) {
        firstMediaId = mediaId
        console.log(`   ✅ 上传成功 (将作为封面)`)
      } else {
        console.log(`   ✅ 上传成功`)
      }
      
      // 替换内容
      content = content.replace(full, `![${alt}](${url})`)
    } catch (error: any) {
      console.log(`   ❌ 上传失败: ${error.message}`)
    }
  }
  
  return { content, images, firstMediaId }
}

// 更健壮的内联样式添加函数
function addInlineStyles(html: string): string {
  let styledHtml = html

  const styleReplacements = [
    // 带 class 的特殊处理（doocs/md 生成的结构）
    { pattern: /<h1[^>]*class="h1"[^>]*>/g, style: STYLES.h1 },
    { pattern: /<h2[^>]*class="h2"[^>]*>/g, style: STYLES.h2 },
    { pattern: /<h3[^>]*class="h3"[^>]*>/g, style: STYLES.h3 },
    { pattern: /<h4[^>]*class="h4"[^>]*>/g, style: STYLES.h4 },
    { pattern: /<p[^>]*class="p"[^>]*>/g, style: STYLES.p },
    { pattern: /<p[^>]*class="footnotes"[^>]*>/g, style: STYLES.footnotes },
    { pattern: /<blockquote[^>]*class="blockquote"[^>]*>/g, style: STYLES.blockquote },
    { pattern: /<ul[^>]*class="ul"[^>]*>/g, style: STYLES.ul },
    { pattern: /<ol[^>]*class="ol"[^>]*>/g, style: STYLES.ol },
    { pattern: /<li[^>]*class="listitem"[^>]*>/g, style: STYLES.li },
    { pattern: /<code[^>]*class="codespan"[^>]*>/g, style: STYLES.code },
    { pattern: /<code[^>]*class="language-[^"]*"[^>]*>/g, style: 'color:#c9d1d9;background:none;padding:0;font-family:Monaco,Consolas,monospace;' },
    { pattern: /<strong[^>]*class="strong"[^>]*>/g, style: STYLES.strong },
    { pattern: /<pre[^>]*class="hljs code__pre"[^>]*>/g, style: 'font-size:90%;overflow-x:auto;border-radius:8px;padding:16px !important;line-height:1.5;margin:10px 8px;background:#0d1117;display:block;' },
    { pattern: /<span[^>]*class="mac-sign"[^>]*>/g, style: 'display:block;width:100%;padding:10px 14px 8px;' },
    { pattern: /<figure[^>]*>/g, style: 'margin:0.35em 0;width:100%;box-sizing:border-box;padding:0 8px;' },
    { pattern: /<img[^>]*src="[^"]*"[^>]*>/g, style: 'width:100%;max-width:100%;height:auto;margin:0;border-radius:4px;display:block;' },
    { pattern: /<figcaption[^>]*class="figcaption"[^>]*>/g, style: STYLES.figcaption },
    { pattern: /<table[^>]*class="preview-table"[^>]*>/g, style: STYLES.table },
    { pattern: /<th[^>]*class="th"[^>]*>/g, style: STYLES.th },
    { pattern: /<td[^>]*class="td"[^>]*>/g, style: STYLES.td },
    // 无 class 的基础标签
    { pattern: /<p(?![^>]*style)[^>]*>/g, style: STYLES.p },
    { pattern: /<h1(?![^>]*style)[^>]*>/g, style: STYLES.h1 },
    { pattern: /<h2(?![^>]*style)[^>]*>/g, style: STYLES.h2 },
    { pattern: /<h3(?![^>]*style)[^>]*>/g, style: STYLES.h3 },
    { pattern: /<h4(?![^>]*style)[^>]*>/g, style: STYLES.h4 },
    { pattern:/<blockquote(?![^>]*style)[^>]*>/g, style: STYLES.blockquote },
    { pattern: /<ul(?![^>]*style)[^>]*>/g, style: STYLES.ul },
    { pattern: /<ol(?![^>]*style)[^>]*>/g, style: STYLES.ol },
    { pattern: /<li(?![^>]*style)[^>]*>/g, style: STYLES.li },
    { pattern: /<code(?![^>]*style)(?![^>]*class="language-")[^>]*>/g, style: STYLES.code },
    { pattern: /<strong(?![^>]*style)[^>]*>/g, style: STYLES.strong },
    { pattern: /<a(?![^>]*style)[^>]*>/g, style: STYLES.a },
    { pattern: /<img(?![^>]*style)[^>]*>/g, style: STYLES.img },
    { pattern: /<figcaption(?![^>]*style)[^>]*>/g, style: STYLES.figcaption },
    { pattern: /<hr(?![^>]*style)[^>]*>/g, style: STYLES.hr },
    { pattern: /<table(?![^>]*style)[^>]*>/g, style: STYLES.table },
    { pattern: /<th(?![^>]*style)[^>]*>/g, style: STYLES.th },
    { pattern: /<td(?![^>]*style)[^>]*>/g, style: STYLES.td },
    { pattern: /<section(?![^>]*style)[^>]*>/g, style: STYLES.section },
  ]

  for (const { pattern, style } of styleReplacements) {
    styledHtml = styledHtml.replace(pattern, (match) => {
      // 如果已经有 style 属性，追加到后面
      if (match.includes('style="')) {
        return match.replace(/style="([^"]*)"/, `style="$1${style}"`)
      }
      // 否则添加 style 属性
      return match.replace(/>$/, ` style="${style}">`)
    })
  }

  // 特殊处理：blockquote 内的 p 标签使用更紧凑的样式 (14px, 0.4em margin)
  styledHtml = styledHtml.replace(
    /<blockquote[^>]*style="[^"]*"[^>]*>.*?<p[^>]*style="[^"]*"[^>]*>/g,
    (match) => match.replace(/<p[^>]*style="[^"]*"/, '<p style="margin:0.4em 0;font-size:14px;"')
  )

  // 确保 figcaption 内容为空
  styledHtml = styledHtml.replace(/<figcaption[^>]*>.*?<\/figcaption>/g, (match) => {
    return match.replace(/>[^<]*</, '><')
  })

  return styledHtml
}

function extractTitle(markdown: string): string {
  const fmMatch = markdown.match(/^---\s*\n[\s\S]*?title:\s*(.+?)\n[\s\S]*?---/)
  if (fmMatch) return fmMatch[1].trim()
  const h1Match = markdown.match(/^#\s+(.+)$/m)
  if (h1Match) return h1Match[1].trim()
  return '未命名文章'
}

function normalizeLeadingCover(html: string): string {
  let normalized = html

  // 如果正文第一项是 figure+img，就把它改成纯 img，避免微信对 figure/figcaption 产生额外留白
  normalized = normalized.replace(
    /^<figure[^>]*>\s*(<img[^>]*>)\s*<figcaption[^>]*><\/figcaption>\s*<\/figure>/,
    '$1'
  )

  // 首图作为封面：压掉上下间距，并与正文同宽
  normalized = normalized.replace(
    /^<img([^>]*)style="([^"]*)"([^>]*)>/,
    (_match, before, style, after) => `<img${before}style="${style};margin:0 0 0.35em;width:100%;max-width:100%;box-sizing:border-box;"${after}>`
  )

  // 紧跟首图后的第一段正文取消顶部边距，避免图下出现明显空白
  normalized = normalized.replace(
    /(<\/img>|^<img[^>]*>)(\s*<p([^>]*)style="([^"]*)"([^>]*)>)/,
    (_match, imgPart, pOpen, before, style, after) => `${imgPart}<p${before}style="${style};margin-top:0;"${after}>`
  )

  return normalized
}

function convertToHTML(markdown: string): string {
  const renderer = initRenderer({
    legend: 'alt',
    citeStatus: true,
    countStatus: false,
    isMacCodeBlock: true,
    isShowLineNumber: false,
    themeMode: 'light',
  })
  
  // 轻度清理图片周围的多余空行，避免图片块前后被额外段落撑开
  let cleanMarkdown = markdown.replace(/\n\n(!\[.*?\]\(.*?\))\n\n/g, '\n$1\n')
  cleanMarkdown = cleanMarkdown.replace(/\n(!\[.*?\]\(.*?\))\n\n/g, '\n$1\n')
  cleanMarkdown = cleanMarkdown.replace(/\n\n(!\[.*?\]\(.*?\))\n/g, '\n$1\n')
  
  const { markdownContent, readingTime } = renderer.parseFrontMatterAndContent(cleanMarkdown)
  marked.setOptions({ breaks: true })
  const rawHtml = marked.parse(markdownContent) as string

  // 表格处理
  let htmlContent = rawHtml.replace(
    /<table>([\s\S]*?)<\/table>/g,
    (match, content) => {
      const processed = content
        .replace(/<th>/g, `<th style="${STYLES.th}">`)
        .replace(/<td>/g, `<td style="${STYLES.td}">`)
      return `<section style="max-width:100%;overflow:auto"><table style="${STYLES.table}">${processed}</table></section>`
    }
  )

  // 移除 figcaption 内容但保留标签
  htmlContent = htmlContent.replace(/<figcaption[^>]*>.*?<\/figcaption>/g, `<figcaption style="${STYLES.figcaption}"></figcaption>`)

  // 根据截图特判正文首图：作为封面块处理，压掉上下空白并对齐后续正文
  htmlContent = normalizeLeadingCover(htmlContent)

  const bodyHTML = renderer.createContainer([
    renderer.buildReadingTime(readingTime),
    htmlContent,
    renderer.buildFootnotes(),
    renderer.buildAddition(),
  ].join('\n'))

  const styledHTML = addInlineStyles(bodyHTML)

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system-font,BlinkMacSystemFont,Helvetica Neue,PingFang SC,Hiragino Sans GB,Microsoft YaHei UI,Microsoft YaHei,Arial,sans-serif;font-size:16px;line-height:1.75;color:#333;margin:0;padding:20px;">
  <div style="max-width:750px;margin:auto;">
    <section style="text-align:left;">${styledHTML}</section>
  </div>
</body>
</html>`
}

// ============ 主程序 ============

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    console.log('\n📝 Markdown → 微信公众号草稿（完整内联样式版）\n')
    console.log('用法: vite-node publish-md.ts <article.md> [选项]\n')
    console.log('选项:')
    console.log('  -t, --title <标题>     指定文章标题')
    console.log('  -a, --author <作者>    指定作者')
    console.log('  -d, --digest <摘要>    指定摘要')
    console.log('  -h, --help             显示帮助\n')
    console.log('示例:')
    console.log('  vite-node publish-md.ts article.md')
    console.log('  vite-node publish-md.ts article.md -t "标题" -a "作者"\n')
    process.exit(0)
  }

  if (!WECHAT_APPID || !WECHAT_APPSECRET) {
    console.error('\n❌ 错误: 未配置微信公众号 AppID 或 AppSecret')
    console.error('   请编辑 config.yaml 文件填写 wechat.appId 和 wechat.appSecret')
    console.error('   或设置环境变量 WECHAT_APPID 和 WECHAT_APPSECRET\n')
    process.exit(1)
  }

  const mdFile = args[0]
  if (!fs.existsSync(mdFile)) {
    console.error(`❌ 错误: 文件不存在: ${mdFile}`)
    process.exit(1)
  }

  const titleIndex = args.findIndex(a => a === '-t' || a === '--title')
  const authorIndex = args.findIndex(a => a === '-a' || a === '--author')
  const digestIndex = args.findIndex(a => a === '-d' || a === '--digest')
  const author = authorIndex !== -1 ? args[authorIndex + 1] : DEFAULT_AUTHOR
  const digest = digestIndex !== -1 ? args[digestIndex + 1] : undefined

  console.log('\n🚀 开始处理...\n')
  const markdown = fs.readFileSync(mdFile, 'utf-8')
  const mdDir = path.dirname(path.resolve(mdFile))
  const extractedTitle = extractTitle(markdown)
  const title = titleIndex !== -1 ? args[titleIndex + 1] : extractedTitle

  console.log(`📄 文件: ${mdFile}`)
  console.log(`📰 标题: ${title}`)
  console.log(`📝 原文: ${markdown.length} 字符\n`)

  console.log('🔑 连接微信公众平台...')
  const accessToken = await getAccessToken()
  console.log('   ✅ 已连接\n')

  console.log('🖼️  处理图片...')
  const { content: processedMarkdown, images, firstMediaId } = await processImages(markdown, mdDir, accessToken)
  if (images.length > 0) {
    console.log(`   ✅ 共上传 ${images.length} 张图片到微信素材库`)
  } else {
    console.log('   ℹ️  没有本地图片需要上传')
  }
  console.log('')

  console.log('🎨 转换 Markdown → HTML...')
  console.log('   使用样式: 完整内联样式')
  const html = convertToHTML(processedMarkdown)
  console.log(`   ✅ 转换完成 (${html.length} 字符)`)
  console.log('')

  // 使用文章中的第一张图作为封面，如果没有则去素材库获取
  let thumbMediaId = firstMediaId
  if (thumbMediaId) {
    console.log('📷 使用文章第一张图作为封面')
    console.log('   ✅ 已设置')
  } else {
    console.log('📷 从素材库获取封面图...')
    thumbMediaId = await getCoverImage(accessToken) || ''
    if (thumbMediaId) {
      console.log('   ✅ 已获取')
    } else {
      console.log('   ⚠️  没有可用封面图')
    }
  }
  console.log('')

  console.log('📤 发布到草稿箱...')
  const mediaId = await publishDraft(accessToken, title, html, thumbMediaId || '', { author, digest })
  console.log('   ✅ 发布成功')
  console.log('')

  console.log('🎉 完成!')
  console.log('')
  console.log(`   Media ID: ${mediaId}`)
  console.log(`   标题: ${title}`)
  if (images.length > 0) {
    console.log(`   图片: ${images.length} 张已上传`)
  }
  console.log('')
  console.log('👉 请在微信公众平台「草稿箱」中查看并发布')
  console.log('')
}

main().catch((error: Error) => {
  console.error('\n❌ 错误:', error.message)
  console.error('')
  process.exit(1)
})
