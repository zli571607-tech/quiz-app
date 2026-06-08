import express from 'express'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3456
const KEY = 'sk-708338bd12a646b88521bd29a868b052'

// CORS - 允许任何来源访问 API
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})
app.use(express.json({ limit: '50mb' }))
app.use(express.static(join(__dirname, 'dist')))

// PDF 解析
app.post('/api/parse-pdf', async (req, res) => {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', async () => {
      const data = await pdfParse(Buffer.concat(chunks))
      res.json({ success: true, content: data.text })
    })
  } catch (e) {
    res.status(500).json({ error: 'PDF解析失败: ' + e.message })
  }
})

// 生成题目
app.post('/api/generate', async (req, res) => {
  try {
    const { content, count = 10, difficulty = '中等' } = req.body
    if (!content) return res.status(400).json({ error: '请先导入文档' })

    // 并行分批
    const batchSize = 6
    const batches = []
    let r = count
    while (r > 0) { batches.push(Math.min(r, batchSize)); r -= batchSize }

    const promises = batches.map(n => generateBatch(content, n, difficulty))
    const results = await Promise.all(promises)

    const questions = results.flatMap((qs, i) =>
      qs.map((q, j) => ({ ...q, id: Date.now() + i * 1000 + j }))
    )
    res.json({ success: true, questions })
  } catch (err) {
    console.error('生成失败:', err)
    res.status(500).json({ error: err.message })
  }
})

async function generateBatch(content, count, difficulty) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{ role: 'user', content: buildPrompt(content, count, difficulty) }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API ${res.status}`)
  }
  const data = await res.json()
  return parseQuestions(data.choices[0].message.content)
}

app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))

app.listen(PORT, () => console.log(`Server ready: http://localhost:${PORT}`))

function buildPrompt(content, count, difficulty) {
  const text = content.length > 8000 ? content.slice(0, 8000) : content
  return `根据文档生成${count}道${difficulty}难度单选题。每题4个选项(A/B/C/D)，1个正确答案。必须有解题思路和知识点。只输出JSON：[{"topic":"题","options":["A.xx","B.xx","C.xx","D.xx"],"answer":"A","explanation":"思路","knowledgePoint":"知识点"}]文档：${text}`
}

function parseQuestions(text) {
  try { const r = JSON.parse(text); if (Array.isArray(r)) return validate(r) } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (m) { try { const r = JSON.parse(m[1]); if (Array.isArray(r)) return validate(r) } catch {} }
  const am = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (am) { try { const r = JSON.parse(am[0]); if (Array.isArray(r)) return validate(r) } catch {} }
  throw new Error('AI 返回格式无法解析')
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
