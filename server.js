/**
 * 刷题软件 - 独立服务器
 * 启动后电脑手机都能访问
 * 用法: node server.js
 */
import express from 'express'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { networkInterfaces } from 'os'
import { exec } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3456
const KEY = 'sk-708338bd12a646b88521bd29a868b052'

// CORS - 允许所有来源
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.use(express.json({ limit: '50mb' }))
app.use(express.static(join(__dirname, 'dist')))

// PDF 解析（pdf2json 替代 pdf-parse，避免 toHex bug）
app.post('/api/parse-pdf', async (req, res) => {
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', async () => {
    try {
      const buffer = Buffer.concat(chunks)
      const text = await new Promise(async (resolve, reject) => {
        const { default: PDFParser } = await import('pdf2json')
        const parser = new PDFParser()
        parser.on('pdfParser_dataReady', (data) => {
          const texts = []
          data.Pages?.forEach(page => {
            page.Texts?.forEach(t => {
              const str = decodeURIComponent(t.R?.[0]?.T || '')
              if (str.trim()) texts.push(str.trim())
            })
          })
          resolve(texts.join(' '))
        })
        parser.on('pdfParser_dataError', (e) => reject(new Error(e?.parserError || '解析失败')))
        parser.parseBuffer(buffer)
      })
      if (!text.trim()) {
        res.json({ success: false, error: 'PDF中未找到文字内容，可能是扫描版' })
      } else {
        res.json({ success: true, content: text })
      }
    } catch (e) {
      res.status(500).json({ error: 'PDF解析失败: ' + e.message })
    }
  })
})

// 生成题目
app.post('/api/generate', async (req, res) => {
  try {
    const { content, count = 10, mode = '原题' } = req.body
    if (!content) return res.status(400).json({ error: '请先导入文档' })

    const batchSize = 6
    const batches = []
    let r = count
    while (r > 0) { batches.push(Math.min(r, batchSize)); r -= batchSize }

    const results = await Promise.all(batches.map(n => generateBatch(content, n, mode)))
    const questions = results.flatMap((qs, i) => qs.map((q, j) => ({ ...q, id: Date.now() + i * 1000 + j })))
    res.json({ success: true, questions })
  } catch (err) {
    console.error('生成失败:', err)
    res.status(500).json({ error: err.message })
  }
})

async function generateBatch(content, count, mode) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat', max_tokens: 4096, temperature: 0.7,
      messages: [{ role: 'user', content: buildPrompt(content, count, mode) }],
    }),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `API ${res.status}`) }
  const data = await res.json()
  return parseQuestions(data.choices[0].message.content)
}

app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))

// 获取本机局域网 IP
function getLocalIPs() {
  const ips = []
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address)
    }
  }
  return ips
}

app.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs()
  console.log('')
  console.log('╔══════════════════════════════════════╗')
  console.log('║        📝 刷题软件 已启动           ║')
  console.log('╠══════════════════════════════════════╣')
  console.log('║                                      ║')
  console.log('║  💻 电脑打开:                        ║')
  console.log(`║  http://localhost:${PORT}              ║`)
  ips.forEach(ip => {
    console.log('║                                      ║')
    console.log('║  📱 手机打开(同WiFi):                ║')
    console.log(`║  http://${ip}:${PORT}                  ║`)
  })
  console.log('║                                      ║')
  console.log('╚══════════════════════════════════════╝')
  console.log('')

  // 自动打开浏览器
  exec(`start http://localhost:${PORT}`)
})

function buildPrompt(content, count, mode) {
  const text = content.length > 8000 ? content.slice(0, 8000) : content

  if (mode === '原题') {
    return `你是出题老师。请根据以下文档内容，严格按原文知识点出${count}道单选题。每题4选项，1个正确答案。每题必须包含解题思路和知识点标签。只输出JSON：[{"topic":"题目","options":["A.xx","B.xx","C.xx","D.xx"],"answer":"A","explanation":"解题思路","knowledgePoint":"知识点"}]文档：${text}`
  } else {
    return `你是出题老师。请根据以下文档的知识点，拓展出${count}道同类知识的单选题。题目可以超出原文但必须基于原文知识点进行延伸。每题4选项，1个正确答案。必须有详细解题思路和知识点标签。只输出JSON：[{"topic":"题目","options":["A.xx","B.xx","C.xx","D.xx"],"answer":"A","explanation":"解题思路","knowledgePoint":"知识点"}]文档：${text}`
  }
}

function parseQuestions(text) {
  try { const r = JSON.parse(text); if (Array.isArray(r)) return validate(r) } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (m) { try { const r = JSON.parse(m[1]); if (Array.isArray(r)) return validate(r) } catch {} }
  const am = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (am) { try { const r = JSON.parse(am[0]); if (Array.isArray(r)) return validate(r) } catch {} }
  throw new Error('AI 返回格式无法解析，请重试')
}

function validate(qs) {
  return qs.map((q, i) => ({
    id: Date.now() + i, topic: q.topic || '',
    options: (Array.isArray(q.options) ? q.options : ['', '', '', '']).slice(0, 4),
    answer: ['A', 'B', 'C', 'D'].includes(q.answer) ? q.answer : 'A',
    explanation: q.explanation || q.analysis || '',
    knowledgePoint: q.knowledgePoint || q.knowledge_point || q.knowledge || '',
  }))
}
