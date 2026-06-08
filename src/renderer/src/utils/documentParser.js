/**
 * 文档解析工具
 * 支持 TXT / PDF / DOCX / PPTX 四种格式的文本提取
 * 在浏览器环境和 Electron 环境均可使用
 */

import { extractRawText } from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

// 关闭 Worker，主线程运行 —— 彻底避免 ArrayBuffer detached 错误
pdfjsLib.GlobalWorkerOptions.workerSrc = ''

/**
 * 从 File 对象中解析文本
 * @param {File} file - 用户选择的文件
 * @returns {Promise<{success: boolean, content?: string, fileName?: string, error?: string}>}
 */
export async function parseDocument(file) {
  const fileName = file.name
  const ext = fileName.split('.').pop().toLowerCase()

  try {
    let content = ''

    switch (ext) {
      case 'txt':
        content = await parseTxt(file)
        break
      case 'pdf':
        content = await parsePdf(file)
        break
      case 'docx':
        content = await parseDocx(file)
        break
      case 'pptx':
        content = await parsePptx(file)
        break
      default:
        return { success: false, fileName, error: `不支持的文件格式: .${ext}` }
    }

    // 清理空白
    content = content.trim()
    if (!content) {
      return { success: false, fileName, error: '未能从文件中提取到文本内容' }
    }

    return { success: true, content, fileName }
  } catch (err) {
    return { success: false, fileName, error: err.message || '解析失败' }
  }
}

/**
 * 解析 TXT 文件
 */
async function parseTxt(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('TXT 文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * 解析 PDF 文件（使用 pdfjs-dist）
 */
async function parsePdf(file) {
  // 用 Object URL 方式加载，彻底避免 ArrayBuffer detached 问题
  const url = URL.createObjectURL(file)
  try {
    const pdf = await pdfjsLib.getDocument({
      url,
      disableAutoFetch: true,
      disableStream: true,
    }).promise

    const textParts = []
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map(item => item.str)
          .filter(str => str && str.trim())
          .join(' ')
        if (pageText.trim()) textParts.push(pageText.trim())
      } catch {
        // 跳过损坏页
      }
    }

    if (textParts.length === 0) {
      throw new Error('PDF 中未找到可提取的文字（可能是扫描版图片PDF）')
    }

    return textParts.join('\n\n')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 解析 DOCX 文件（使用 mammoth）
 */
async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await extractRawText({ arrayBuffer })
  return result.value
}

/**
 * 解析 PPTX 文件（使用 jszip）
 * PPTX 本质是 ZIP 包，幻灯片内容在 ppt/slides/slide*.xml 中
 */
async function parsePptx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // 找到所有幻灯片文件
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)[1])
      const numB = parseInt(b.match(/slide(\d+)/)[1])
      return numA - numB
    })

  if (slideFiles.length === 0) {
    throw new Error('PPTX 文件中未找到幻灯片内容')
  }

  const textParts = []
  for (const slideFile of slideFiles) {
    const xmlContent = await zip.files[slideFile].async('text')
    // 提取 XML 中所有 <a:t> 标签内的文本
    const texts = []
    const regex = /<a:t[^>]*>([^<]*)<\/a:t>/g
    let match
    while ((match = regex.exec(xmlContent)) !== null) {
      const text = match[1].trim()
      if (text) texts.push(text)
    }
    if (texts.length > 0) {
      textParts.push(texts.join(' '))
    }
  }

  return textParts.join('\n\n')
}
