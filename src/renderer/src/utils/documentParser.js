/**
 * 文档解析 - PDF 用 Uint8Array 传给 pdfjs（避免 detached 错误）
 * DOCX/TXT/PPTX 浏览器原生解析
 */
import { extractRawText } from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

// Worker 直接用文件路径（不依赖 Vite ?url 解析）
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', location.origin).href

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
      default: return { success: false, fileName, error: '不支持 .' + ext + ' 格式' }
    }
    content = content.trim()
    if (!content) return { success: false, fileName, error: '未能提取文字内容' }
    return { success: true, content, fileName }
  } catch (err) {
    return { success: false, fileName, error: err.message || '解析失败' }
  }
}

// PDF → Uint8Array 传给 pdfjs，加超时保护
async function parsePdf(file) {
  const buf = await file.arrayBuffer()
  const data = new Uint8Array(buf.slice(0))

  // 超时保护：60秒还没完成就报错
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('PDF解析超时，请尝试较小文件')), 60000)
  )

  const parseTask = (async () => {
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
    if (parts.length === 0) throw new Error('PDF中无文字（可能为扫描图片）')
    return parts.join('\n\n')
  })()

  return Promise.race([parseTask, timeout])
}

function parseTxt(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('读取失败'))
    r.readAsText(file, 'UTF-8')
  })
}

async function parseDocx(file) {
  const buf = await file.arrayBuffer()
  const result = await extractRawText({ arrayBuffer: buf })
  return result.value
}

async function parsePptx(file) {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1]))
  if (!slides.length) throw new Error('PPTX无幻灯片')
  const texts = []
  for (const s of slides) {
    const xml = await zip.files[s].async('text')
    let m; const re = /<a:t[^>]*>([^<]*)<\/a:t>/g
    while ((m = re.exec(xml)) !== null) if (m[1].trim()) texts.push(m[1].trim())
  }
  return texts.join('\n')
}
