import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { initDatabase, getAllDecks, createDeck, addQuestionsBatch } from './database'

const DBContext = createContext(null)

export function DBProvider({ children }) {
  const [dbReady, setDbReady] = useState(false)
  const [decks, setDecks] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')

  // 初始化数据库
  useEffect(() => {
    initDatabase()
      .then(() => {
        setDbReady(true)
        refreshDecks()
        setError('')
      })
      .catch(err => {
        console.error('数据库初始化失败:', err)
        setError('数据库加载失败：' + err.message)
      })
  }, [])

  const refreshDecks = useCallback(() => {
    setDecks(getAllDecks())
  }, [])

  // 刷新
  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    refreshDecks()
  }, [refreshDecks])

  // 保存题目到题库（带错误处理）
  const saveQuestions = useCallback((questions, sourceFile) => {
    try {
      const deckName = sourceFile
        ? sourceFile.replace(/\.[^.]+$/, '')
        : `手动录入 ${new Date().toLocaleDateString()}`
      const deckId = createDeck(deckName, sourceFile)
      addQuestionsBatch(questions, deckId, sourceFile)
      refresh()
      return { success: true, deckId }
    } catch (err) {
      console.error('保存题目失败:', err)
      return { success: false, error: err.message || '保存失败' }
    }
  }, [refresh])

  return (
    <DBContext.Provider value={{ dbReady, decks, refresh, saveQuestions, refreshKey, dbError: error }}>
      {children}
    </DBContext.Provider>
  )
}

export function useDB() {
  const ctx = useContext(DBContext)
  if (!ctx) throw new Error('useDB must be used within DBProvider')
  return ctx
}
