/**
 * Vercel Serverless Function - DeepSeek API 代理
 * 并行生成题目，速度优化
 */

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-708338bd12a646b88521bd29a868b052'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { content, count = 10, difficulty = '中等' } = req.body || {}
    if (!content) return res.status(400).json({ error: '请先导入文档' })

    // 并行分批生成
    const batchSize = 6
    const batches = []
    let remaining = count
    while (remaining > 0) {
      batches.push(Math.min(remaining, batchSize))
      remaining -= batchSize
    }

    const results = await Promise.all(
      batches.map(n => callDeepSeek(buildPrompt(content, n, difficulty)))
    )

    const questions = results.flatMap((qs, i) =>
      qs.map((q, j) => ({ ...q, id: Date.now() + i * 1000 + j }))
    )

    res.status(200).json({ success: true, questions })
  } catch (err) {
    res.status(500).json({ error: err.message || '生成失败' })
  }
}

async function callDeepSeek(prompt, retry = 3) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.7,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 429 && i < retry - 1) {
          await new Promise(r => setTimeout(r, (i + 1) * 1000))
          continue
        }
        throw new Error(err.error?.message || `API 错误 (${res.status})`)
      }
      const data = await res.json()
      return parseQuestions(data.choices[0].message.content)
    } catch (e) {
      if (i === retry - 1) throw e
      await new Promise(r => setTimeout(r, 500))
    }
  }
  return []
}

function buildPrompt(content, count, difficulty) {
  const text = content.length > 8000 ? content.slice(0, 8000) : content
  return `根据文档生成${count}道${difficulty}难度单选题。每题4个选项(A/B/C/D)，1个正确答案。必须有解题思路和知识点标签。只输出JSON：

[{"topic":"题","options":["A.xx","B.xx","C.xx","D.xx"],"answer":"A","explanation":"思路","knowledgePoint":"知识点"}]

文档：
${text}`
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
    id: Date.now() + i,
    topic: q.topic || '',
    options: (Array.isArray(q.options) ? q.options : ['', '', '', '']).slice(0, 4),
    answer: ['A', 'B', 'C', 'D'].includes(q.answer) ? q.answer : 'A',
    explanation: q.explanation || q.analysis || '',
    knowledgePoint: q.knowledgePoint || q.knowledge_point || q.knowledge || '',
  }))
}
