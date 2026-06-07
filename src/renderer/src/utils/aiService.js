/**
 * AI 题目生成 - 直接调用 DeepSeek API（无需后端代理）
 */
const KEY = 'sk-708338bd12a646b88521bd29a868b052'

export async function generateQuestions(content, options = {}) {
  const { count = 10, difficulty = '中等' } = options

  // 并行分批生成
  const batchSize = 6
  const batches = []
  let r = count
  while (r > 0) { batches.push(Math.min(r, batchSize)); r -= batchSize }

  try {
    const results = await Promise.all(batches.map(async n => {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 4096, temperature: 0.7,
          messages: [{ role: 'user', content: buildPrompt(content, n, difficulty) }],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `API ${res.status}`)
      }
      const data = await res.json()
      return parseQuestions(data.choices[0].message.content)
    }))

    const questions = results.flatMap((qs, i) =>
      qs.map((q, j) => ({ ...q, id: Date.now() + i * 1000 + j }))
    )
    return { success: true, questions }
  } catch (err) {
    return { success: false, error: `生成失败: ${err.message}` }
  }
}

function buildPrompt(content, count, difficulty) {
  const text = content.length > 8000 ? content.slice(0, 8000) : content
  return `根据文档生成${count}道${difficulty}难度单选题。每题4选项(A/B/C/D)，1个正确答案。须有解题思路和知识点。只输出JSON：[{"topic":"题","options":["A.xx","B.xx","C.xx","D.xx"],"answer":"A","explanation":"思路","knowledgePoint":"知识点"}]文档：${text}`
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
