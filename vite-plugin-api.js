/**
 * Vite API 插件 - 并行生成题目，大幅提速
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getConfig() {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, 'server-config.json'), 'utf-8'))
  } catch {
    return { deepseek: { apiKey: '', model: 'deepseek-chat' } }
  }
}

export default function apiPlugin() {
  return {
    name: 'vite-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/health', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })

      server.middlewares.use('/api/generate', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        try {
          const body = await readBody(req)
          const { content, count = 10, difficulty = '中等' } = body
          if (!content) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '请先导入文档' })); return }

          const config = getConfig()
          const apiKey = config.deepseek?.apiKey || ''
          if (!apiKey) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '未配置 API Key' })); return }

          // 并行生成：每批5-8题，同时发请求
          const batchSize = 6
          const batches = []
          let remaining = count
          while (remaining > 0) {
            const n = Math.min(remaining, batchSize)
            batches.push(n)
            remaining -= n
          }

          const results = await Promise.all(
            batches.map(n => callDeepSeek(buildPrompt(content, n, difficulty), apiKey))
          )

          // 合并所有题目
          const questions = results.flatMap((qs, i) =>
            qs.map((q, j) => ({ ...q, id: Date.now() + i * 1000 + j }))
          )

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, questions }))
        } catch (err) {
          console.error('AI generate error:', err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message || 'AI 生成失败' }))
        }
      })
    },
  }
}

// ============ DeepSeek API ============

async function callDeepSeek(prompt, apiKey, retry = 3) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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

// ============ 提示词（精简，加速） ============

function buildPrompt(content, count, difficulty) {
  const text = content.length > 8000 ? content.slice(0, 8000) + '\n(已截取)' : content
  return `根据文档生成${count}道${difficulty}难度单选题。每题4个选项(A/B/C/D)，1个正确答案。
必须有解题思路和知识点标签。只输出JSON数组：

[{"topic":"题","options":["A.xx","B.xx","C.xx","D.xx"],"answer":"A","explanation":"思路","knowledgePoint":"知识点"}]

文档：
${text}`
}

// ============ 解析 ============

function parseQuestions(text) {
  try { const r = JSON.parse(text); if (Array.isArray(r)) return validateQuestions(r) } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (m) { try { const r = JSON.parse(m[1]); if (Array.isArray(r)) return validateQuestions(r) } catch {} }
  const am = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (am) { try { const r = JSON.parse(am[0]); if (Array.isArray(r)) return validateQuestions(r) } catch {} }
  throw new Error('AI 返回格式无法解析')
}

function validateQuestions(qs) {
  return qs.map((q, i) => ({
    id: Date.now() + i,
    topic: q.topic || '',
    options: (Array.isArray(q.options) ? q.options : ['', '', '', '']).slice(0, 4),
    answer: ['A', 'B', 'C', 'D'].includes(q.answer) ? q.answer : 'A',
    explanation: q.explanation || q.analysis || '',
    knowledgePoint: q.knowledgePoint || q.knowledge_point || q.knowledge || '',
  }))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({}) } })
    req.on('error', reject)
  })
}
