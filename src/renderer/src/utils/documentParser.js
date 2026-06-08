/**
 * 文档解析 - 双模式
 * 有服务端时：PDF 走服务端 pdf2json（最稳定）
 * 无服务端时：PDF 走客户端 pdfjs-dist
 * DOCX/TXT/PPTX 始终客户端解析
 */
import { extractRawText } from 'mammoth'
import JSZip from 'jszip'

let hasServer = null

// 检测服务端是否可用
async function checkServer() {
  if (hasServer !== null) return hasServer
  try {
    const res = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(2000) })
    hasServer = res.ok
  } catch {
    hasServer = false
  }
  return hasServer
}

export async function parseDocument(file) {
  const fileName = file.name
  const ext = fileName.split('.').pop().toLowerCase()
  try {
    let content = ''
    switch (ext) {
      case 'txt':  content = await parseTxt(file); break
      case 'pdf':  content = await parsePdf(file); break
      case 'docx': content = await parseDocx(file); break
      case 'pptx': content = await parsePptx(file); break
      default: return { success: false, fileName, error: '不支持 .' + ext }
    }
    content = content.trim()
    if (!content) return { success: false, fileName, error: '未提取到文字' }
    return { success: true, content, fileName }
  } catch (err) {
    return { success: false, fileName, error: err.message || '解析失败' }
  }
}

// PDF → 优先服务端，不可用时客户端
async function parsePdf(file) {
  const server = await checkServer()
  if (server) {
    return parsePdfServer(file)
  }
  return parsePdfClient(file)
}

// 服务端解析（发送文件到 /api/parse-pdf）
async function parsePdfServer(file) {
  const res = await fetch('/api/parse-pdf', {
    method: 'POST',
    body: file,
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '服务端解析失败')
  }
  const data = await res.json()
  if (!data.success) throw new Error(data.error || '解析失败')
  return data.content
}

// 客户端解析（pdfjs-dist，仅在无服务端时使用）
async function parsePdfClient(file) {
  const { default: pdfjsLib } = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', location.origin).href

  const buf = await file.arrayBuffer()
  const data = new Uint8Array(buf.slice(0))

  const pdf = await pdfjsLib.getDocument({
    data,
    disableAutoFetch: true,
    disableStream: true,
    useWorkerFetch: false,
  }).promise

  const parts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    const text = tc.items.map(it => it.str).filter(s => s.trim()).join(' ')
    if (text.trim()) parts.push(text.trim())
  }
  if (!parts.length) throw new Error('PDF无文字（扫描图片）')
  return parts.join('\n\n')
}

// TXT
function parseTxt(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('读取失败'))
    r.readAsText(file, 'UTF-8')
  })
}

// DOCX
async function parseDocx(file) {
  const buf = await file.arrayBuffer()
  const result = await extractRawText({ arrayBuffer: buf })
  return result.value
}

// PPTX
async function parsePptx(file) {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  const slides = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1]))
  if (!slides.length) throw new Error('无幻灯片')
  const texts = []
  for (const s of slides) {
    const xml = await zip.files[s].async('text')
    let m; const re = /<a:t[^>]*>([^<]*)<\/a:t>/g
    while ((m = re.exec(xml)) !== null) if (m[1].trim()) texts.push(m[1].trim())
  }
  return texts.join('\n')
}
