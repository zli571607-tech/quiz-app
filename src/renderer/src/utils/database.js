/**
 * 数据库模块 - 使用 sql.js (SQLite compiled to WASM)
 * 数据通过 localStorage 持久化
 */

import initSqlJs from 'sql.js'

let db = null
let SQL = null
const DB_STORAGE_KEY = 'quiz_app_db'

// ============ 初始化 ============

export async function initDatabase() {
  if (db) return db

  // 尝试多种方式加载 WASM
  const wasmSources = [
    '/sql-wasm.wasm',
    './sql-wasm.wasm',
    'sql-wasm.wasm',
  ]

  let lastError = null

  for (const wasmPath of wasmSources) {
    try {
      SQL = await initSqlJs({
        locateFile: () => wasmPath,
      })
      lastError = null
      break
    } catch (err) {
      lastError = err
      console.warn(`sql.js WASM 加载失败 (${wasmPath}):`, err.message)
    }
  }

  if (lastError || !SQL) {
    throw new Error(
      'SQLite 引擎加载失败，请检查网络连接后刷新页面。' +
      (lastError ? ' 错误详情：' + lastError.message : '')
    )
  }

  // 尝试从 localStorage 恢复，加多层保护
  let restored = false
  try {
    const saved = localStorage.getItem(DB_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        try {
          const uint8 = new Uint8Array(parsed)
          db = new SQL.Database(uint8)
          restored = true
        } catch (e) {
          console.warn('数据库恢复失败，将创建新数据库:', e.message)
          localStorage.removeItem(DB_STORAGE_KEY)
        }
      } else {
        console.warn('localStorage 数据格式异常，已清除')
        localStorage.removeItem(DB_STORAGE_KEY)
      }
    }
  } catch (e) {
    console.warn('localStorage 读取失败，已清除:', e.message)
    localStorage.removeItem(DB_STORAGE_KEY)
  }

  if (!restored) {
    db = new SQL.Database()
  }

  // 创建表结构（使用 try-catch 逐条执行，避免一条失败全部失败）
  const tables = [
    `CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_file TEXT,
      question_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER REFERENCES decks(id) ON DELETE SET NULL,
      topic TEXT NOT NULL,
      options TEXT NOT NULL,
      answer TEXT NOT NULL,
      explanation TEXT DEFAULT '',
      knowledge_point TEXT DEFAULT '',
      source_file TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      user_answer TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0,
      answered_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`,
  ]

  for (const sql of tables) {
    try {
      db.run(sql)
    } catch (e) {
      console.error('建表失败:', e.message)
      throw new Error('数据库初始化失败：' + e.message)
    }
  }

  // 迁移：为旧表添加新字段（如果不存在）
  const migrations = [
    'ALTER TABLE questions ADD COLUMN explanation TEXT DEFAULT \'\'',
    'ALTER TABLE questions ADD COLUMN knowledge_point TEXT DEFAULT \'\'',
  ]
  for (const sql of migrations) {
    try { db.run(sql) } catch { /* 字段已存在，忽略 */ }
  }

  // 保存初始状态
  try {
    saveDatabase()
  } catch (e) {
    console.warn('数据库首次保存失败（可能是 localStorage 空间不足）:', e.message)
  }

  return db
}

// 持久化到 localStorage
function saveDatabase() {
  if (!db) return
  try {
    const uint8 = db.export()
    const arr = Array.from(uint8)
    const json = JSON.stringify(arr)
    localStorage.setItem(DB_STORAGE_KEY, json)
  } catch (err) {
    // localStorage 可能满了，尝试清理
    if (err.name === 'QuotaExceededError' || err.message?.includes('quota')) {
      console.warn('localStorage 空间不足，尝试清理旧数据...')
      // 保留当前数据，清理其他可能占用空间的项
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key !== DB_STORAGE_KEY && key !== 'claude_api_key') {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
      // 重试
      try {
        const uint8 = db.export()
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(Array.from(uint8)))
      } catch (e2) {
        console.error('保存数据库最终失败:', e2.message)
      }
    } else {
      console.error('保存数据库失败:', err.message)
    }
  }
}

// ============ 题套操作 ============

export function getAllDecks() {
  if (!db) return []
  try {
    const stmt = db.prepare('SELECT * FROM decks ORDER BY created_at DESC')
    const results = []
    while (stmt.step()) results.push(stmt.getAsObject())
    stmt.free()
    return results
  } catch (e) { console.error('getAllDecks error:', e); return [] }
}

export function createDeck(name, sourceFile = '') {
  if (!db) throw new Error('数据库未初始化')
  db.run('INSERT INTO decks (name, source_file) VALUES (?, ?)', [name, sourceFile || ''])
  saveDatabase()
  return getLastInsertId()
}

export function updateDeckName(id, name) {
  if (!db) return
  db.run('UPDATE decks SET name = ? WHERE id = ?', [name, id])
  saveDatabase()
}

export function deleteDeck(id) {
  if (!db) return
  db.run('DELETE FROM questions WHERE deck_id = ?', [id])
  db.run('DELETE FROM decks WHERE id = ?', [id])
  saveDatabase()
}

function updateDeckQuestionCount(deckId) {
  if (!db) return
  try {
    const result = db.exec('SELECT COUNT(*) as c FROM questions WHERE deck_id = ?', [deckId])
    const count = result[0]?.values?.[0]?.[0] || 0
    db.run('UPDATE decks SET question_count = ? WHERE id = ?', [count, deckId])
    saveDatabase()
  } catch (e) { console.error('updateDeckQuestionCount error:', e) }
}

// ============ 题目操作 ============

export function getQuestionsByDeck(deckId) {
  if (!db) return []
  try {
    const stmt = db.prepare('SELECT * FROM questions WHERE deck_id = ? ORDER BY created_at DESC', [deckId])
    const results = []
    while (stmt.step()) {
      const q = stmt.getAsObject()
      try { q.options = JSON.parse(q.options) } catch { q.options = ['', '', '', ''] }
      results.push(q)
    }
    stmt.free()
    return results
  } catch (e) { console.error('getQuestionsByDeck error:', e); return [] }
}

export function getAllQuestions() {
  if (!db) return []
  try {
    const stmt = db.prepare('SELECT * FROM questions ORDER BY created_at DESC')
    const results = []
    while (stmt.step()) {
      const q = stmt.getAsObject()
      try { q.options = JSON.parse(q.options) } catch { q.options = ['', '', '', ''] }
      results.push(q)
    }
    stmt.free()
    return results
  } catch (e) { console.error('getAllQuestions error:', e); return [] }
}

export function addQuestion(topic, options, answer, deckId = null, sourceFile = '', explanation = '', knowledgePoint = '') {
  if (!db) throw new Error('数据库未初始化')
  const now = datetime()
  db.run(
    'INSERT INTO questions (deck_id, topic, options, answer, explanation, knowledge_point, source_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [deckId, topic, JSON.stringify(options), answer, explanation || '', knowledgePoint || '', sourceFile || '', now, now]
  )
  if (deckId) updateDeckQuestionCount(deckId)
  saveDatabase()
}

export function addQuestionsBatch(questions, deckId = null, sourceFile = '') {
  if (!db) throw new Error('数据库未初始化')
  const now = datetime()
  const stmt = db.prepare(
    'INSERT INTO questions (deck_id, topic, options, answer, explanation, knowledge_point, source_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  for (const q of questions) {
    stmt.run([
      deckId, q.topic || '', JSON.stringify(q.options || []), q.answer || 'A',
      q.explanation || '', q.knowledgePoint || q.knowledge_point || '', sourceFile || '', now, now,
    ])
  }
  stmt.free()
  if (deckId) updateDeckQuestionCount(deckId)
  saveDatabase()
}

export function updateQuestion(id, topic, options, answer) {
  if (!db) return
  const now = datetime()
  db.run('UPDATE questions SET topic = ?, options = ?, answer = ?, updated_at = ? WHERE id = ?',
    [topic, JSON.stringify(options), answer, now, id])
  saveDatabase()
}

export function deleteQuestion(id) {
  if (!db) return
  try {
    const r = db.exec('SELECT deck_id FROM questions WHERE id = ?', [id])
    const deckId = r[0]?.values?.[0]?.[0] || null
    db.run('DELETE FROM questions WHERE id = ?', [id])
    if (deckId) updateDeckQuestionCount(deckId)
    saveDatabase()
  } catch (e) { console.error('deleteQuestion error:', e) }
}

// ============ 答题记录 ============

export function saveRecord(sessionId, questionId, userAnswer, isCorrect) {
  if (!db) return
  const now = datetime()
  db.run(
    'INSERT INTO records (session_id, question_id, user_answer, is_correct, answered_at) VALUES (?, ?, ?, ?, ?)',
    [sessionId, questionId, userAnswer || '', isCorrect ? 1 : 0, now]
  )
  saveDatabase()
}

export function getWrongQuestions() {
  if (!db) return []
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT q.* FROM questions q
      INNER JOIN records r ON q.id = r.question_id
      WHERE r.is_correct = 0 ORDER BY r.answered_at DESC
    `)
    const results = []
    while (stmt.step()) {
      const q = stmt.getAsObject()
      try { q.options = JSON.parse(q.options) } catch { q.options = ['', '', '', ''] }
      results.push(q)
    }
    stmt.free()
    return results
  } catch (e) { console.error('getWrongQuestions error:', e); return [] }
}

export function getStats() {
  if (!db) return { totalQuestions: 0, totalSessions: 0, totalAnswers: 0, accuracy: 0 }
  try {
    const tq = db.exec('SELECT COUNT(*) FROM questions')?.[0]?.values?.[0]?.[0] || 0
    const ts = db.exec('SELECT COUNT(DISTINCT session_id) FROM records')?.[0]?.values?.[0]?.[0] || 0
    const ta = db.exec('SELECT COUNT(*) FROM records')?.[0]?.values?.[0]?.[0] || 0
    const ca = db.exec('SELECT COUNT(*) FROM records WHERE is_correct = 1')?.[0]?.values?.[0]?.[0] || 0
    return {
      totalQuestions: tq,
      totalSessions: ts,
      totalAnswers: ta,
      accuracy: ta > 0 ? Math.round((ca / ta) * 100) : 0,
    }
  } catch (e) { return { totalQuestions: 0, totalSessions: 0, totalAnswers: 0, accuracy: 0 } }
}

// ============ 工具函数 ============

function getLastInsertId() {
  try {
    const r = db.exec('SELECT last_insert_rowid()')
    return r[0]?.values?.[0]?.[0] || 0
  } catch { return 0 }
}

function datetime() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
