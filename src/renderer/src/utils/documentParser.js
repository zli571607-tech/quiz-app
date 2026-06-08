/**
 * 文档解析工具
 * PDF → 服务端解析（稳定可靠）
 * DOCX/TXT/PPTX → 浏览器解析
 */

import { extractRawText } from 'mammoth'
import JSZip from 'jszip'

export async function parseDocument(file) {
  const fileName = file.name
  const ext = fileName.split('.').pop().toLowerCase()

  try {
    let content = ''
    switch (ext) {
      case 'txt':  content = await parseTxt(file); break
      case 'pdf':  content = await parsePdfServer(file); break
      case 'docx': content = await parseDocx(file); break
      case 'pptx': content = await parsePptx(file); break
      default: return { success: false, fileName, error: `不支持的文件格式: .${ext}` }
    }
    content = content.trim()
    if (!content) return { success: false, fileName, error: '未能提取到文本内容' }
    return { success: true, content, fileName }
  } catch (err) {
    return { success: false, fileName, error: err.message || '解析失败' }
  }
}

// PDF → 发送到服务端用 pdf-parse 解析（100% 可靠）
async function parsePdfServer(file) {
  const res = await fetch('/api/parse-pdf', {
    method: 'POST',
    body: file,
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'PDF解析失败')
  return data.content
}

// TXT
async function parseTxt(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('TXT 文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

// DOCX
async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await extractRawText({ arrayBuffer })
  return result.value
}

// PPTX
async function parsePptx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      return parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1])
    })
  if (slideFiles.length === 0) throw new Error('PPTX 未找到幻灯片')
  const texts = []
  for (const f of slideFiles) {
    const xml = await zip.files[f].async('text')
    let m
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g
    while ((m = re.exec(xml)) !== null) if (m[1].trim()) texts.push(m[1].trim())
  }
  return texts.join('\n')
}
