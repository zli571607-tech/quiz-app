/**
 * 文档解析 - PDF 用 Uint8Array 传给 pdfjs（避免 detached 错误）
 * DOCX/TXT/PPTX 浏览器原生解析
 */
import { extractRawText } from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'

// 设置 Worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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

// PDF → Uint8Array 传给 pdfjs，根本不碰 ArrayBuffer transfer
async function parsePdf(file) {
  // 读取为 ArrayBuffer，立即转为 Uint8Array 副本
  const buf = await file.arrayBuffer()
  const data = new Uint8Array(buf.slice(0)) // slice 创建独立副本

  const pdf = await pdfjsLib.getDocument({ data }).promise
  const parts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    const text = tc.items.map(it => it.str).filter(s => s.trim()).join(' ')
    if (text.trim()) parts.push(text.trim())
  }
  if (parts.length === 0) throw new Error('PDF中无文字（可能为扫描图片）')
  return parts.join('\n\n')
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
