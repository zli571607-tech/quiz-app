import { useState, useEffect, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useDB } from '../utils/dbContext'
import { getAllQuestions, getQuestionsByDeck, saveRecord } from '../utils/database'
import { PenLine, CheckCircle, XCircle, ArrowRight, ArrowLeft, Lightbulb, Tag } from 'lucide-react'

const AUTO_ADVANCE_MS = 1500

export default function QuizPage() {
  const { decks } = useDB()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [startTime, setStartTime] = useState(null)
  const [finished, setFinished] = useState(false)
  const [answers, setAnswers] = useState([])
  const [mode, setMode] = useState('select')
  const [selectedDeckId, setSelectedDeckId] = useState(null)
  const [autoTimer, setAutoTimer] = useState(null)

  // 清理定时器
  useEffect(() => () => { if (autoTimer) clearTimeout(autoTimer) }, [autoTimer])

  const startAllQuestions = () => {
    const all = getAllQuestions()
    if (all.length === 0) return
    setQuestions(shuffleArray([...all]))
    setMode('quiz')
    setSessionId('quiz_' + Date.now())
    setStartTime(Date.now())
    setCurrentIndex(0); setSelectedAnswer(null); setAnswered(false)
    setAnswers([]); setFinished(false)
  }

  const startDeckQuestions = () => {
    if (!selectedDeckId) return
    const qs = getQuestionsByDeck(selectedDeckId)
    if (qs.length === 0) return
    setQuestions(shuffleArray([...qs]))
    setMode('quiz')
    setSessionId('quiz_' + Date.now())
    setStartTime(Date.now())
    setCurrentIndex(0); setSelectedAnswer(null); setAnswered(false)
    setAnswers([]); setFinished(false)
  }

  const handleSelectAnswer = (letter) => {
    if (answered) return
    setSelectedAnswer(letter)
    setAnswered(true)

    const currentQ = questions[currentIndex]
    const isCorrect = letter === currentQ.answer
    const record = { questionId: currentQ.id, userAnswer: letter, isCorrect }
    setAnswers(prev => [...prev, record])
    saveRecord(sessionId, currentQ.id, letter, isCorrect)

    // 自动跳转下一题
    if (currentIndex < questions.length - 1) {
      const timer = setTimeout(() => {
        setCurrentIndex(prev => prev + 1)
        setSelectedAnswer(null)
        setAnswered(false)
      }, AUTO_ADVANCE_MS)
      setAutoTimer(timer)
    } else {
      // 最后一题，延迟后完成
      const timer = setTimeout(() => setFinished(true), AUTO_ADVANCE_MS)
      setAutoTimer(timer)
    }
  }

  const goNext = () => {
    if (autoTimer) clearTimeout(autoTimer)
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setSelectedAnswer(null)
      setAnswered(false)
    } else {
      setFinished(true)
    }
  }

  const goPrev = () => {
    if (autoTimer) clearTimeout(autoTimer)
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      const prevA = answers[currentIndex - 1]
      if (prevA) { setSelectedAnswer(prevA.userAnswer); setAnswered(true) }
      else { setSelectedAnswer(null); setAnswered(false) }
    }
  }

  const viewResults = () => {
    navigate('/result', { state: { sessionId, answers, questions, startTime, endTime: Date.now() } })
  }

  // 键盘快捷键
  const handleKeyDown = useCallback((e) => {
    const key = e.key.toUpperCase()
    if (['A', 'B', 'C', 'D'].includes(key) && !answered) handleSelectAnswer(key)
    else if ((key === 'ENTER' || key === 'ARROWRIGHT') && answered) goNext()
    else if (key === 'ARROWLEFT') goPrev()
  }, [answered, currentIndex, questions, autoTimer])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ============ 选择模式 ============
  if (mode === 'select') {
    const allQuestions = getAllQuestions()
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-full">
        <div className="max-w-md w-full">
          <PenLine size={48} className="text-text-secondary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-center mb-2">开始刷题</h2>
          <p className="text-text-secondary text-center text-sm mb-6">
            {allQuestions.length === 0 ? '还没有题目，请先导入文档生成' : `题库共 ${allQuestions.length} 题`}
          </p>
          {allQuestions.length === 0 ? (
            <div className="text-center">
              <NavLink to="/import" className="bg-primary text-white px-5 py-2.5 rounded-btn text-sm font-medium inline-block">去导入文档</NavLink>
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={startAllQuestions}
                className="w-full bg-primary text-white px-5 py-3.5 rounded-card font-medium hover:bg-primary-hover transition-colors text-center">
                🎲 全部题库随机刷（{allQuestions.length} 题）
              </button>
              <div className="bg-card border border-border rounded-card p-4">
                <p className="text-sm font-medium mb-3">按题套刷题</p>
                <div className="space-y-2 mb-4">
                  {decks.filter(d => d.question_count > 0).map(deck => (
                    <button key={deck.id} onClick={() => setSelectedDeckId(deck.id)}
                      className={`w-full text-left px-3 py-2 rounded-btn text-sm transition-colors
                        ${selectedDeckId === deck.id ? 'bg-blue-50 border border-blue-200 text-primary font-medium' : 'border border-border hover:bg-gray-50'}`}>
                      {deck.name} <span className="text-text-secondary">({deck.question_count}题)</span>
                    </button>
                  ))}
                </div>
                <button onClick={startDeckQuestions} disabled={!selectedDeckId}
                  className="w-full bg-white border border-primary text-primary px-4 py-2 rounded-btn text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-30">
                  开始刷此套题
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============ 完成 ============
  if (finished) {
    const correctCount = answers.filter(a => a.isCorrect).length
    const accuracy = Math.round((correctCount / answers.length) * 100) || 0
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-full">
        <div className="max-w-md w-full text-center">
          <CheckCircle size={64} className="text-correct mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">刷题完成！</h2>
          <div className="bg-card border border-border rounded-card p-6 my-6">
            <div className="text-5xl font-bold text-primary mb-2">{accuracy}%</div>
            <p className="text-text-secondary text-sm">正确率</p>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div><p className="text-2xl font-semibold">{answers.length}</p><p className="text-xs text-text-secondary">总题数</p></div>
              <div><p className="text-2xl font-semibold text-correct">{correctCount}</p><p className="text-xs text-text-secondary">正确</p></div>
              <div><p className="text-2xl font-semibold text-wrong">{answers.length - correctCount}</p><p className="text-xs text-text-secondary">错误</p></div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-3 justify-center">
            <button onClick={viewResults} className="bg-primary text-white px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-primary-hover">查看详情</button>
            <button onClick={() => setMode('select')} className="bg-white border border-border px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-gray-50">再来一次</button>
          </div>
        </div>
      </div>
    )
  }

  // ============ 答题界面 ============
  const currentQ = questions[currentIndex]
  const progress = ((currentIndex + (answered ? 1 : 0)) / questions.length) * 100

  return (
    <div className="p-3 md:p-8 max-w-2xl mx-auto">
      {/* 进度条 */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">第 {currentIndex + 1} / {questions.length} 题</span>
          <span className="text-sm text-text-secondary">已答 {answers.length} 题</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 题目 */}
      <div className="bg-card border border-border rounded-card p-4 md:p-6 mb-3 md:mb-4">
        <p className="text-base md:text-lg font-medium leading-relaxed">{currentQ.topic}</p>
      </div>

      {/* 选项 */}
      <div className="space-y-2 mb-4">
        {['A', 'B', 'C', 'D'].map((letter, i) => {
          const text = currentQ.options?.[i]
          if (!text) return null
          let cls = 'border border-border bg-white hover:border-primary hover:bg-blue-50'
          if (answered) {
            if (letter === currentQ.answer) cls = 'border-2 border-correct bg-green-50'
            else if (letter === selectedAnswer && letter !== currentQ.answer) cls = 'border-2 border-wrong bg-red-50'
            else cls = 'border border-border bg-white opacity-50'
          }
          return (
            <button key={letter} onClick={() => handleSelectAnswer(letter)} disabled={answered}
              className={`w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 rounded-btn text-left transition-all option-btn ${cls}`}>
              <span className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
                ${answered && letter === currentQ.answer ? 'bg-correct text-white' : ''}
                ${answered && letter === selectedAnswer && letter !== currentQ.answer ? 'bg-wrong text-white' : ''}
                ${!answered || (letter !== currentQ.answer && letter !== selectedAnswer) ? 'bg-gray-100 text-text-secondary' : ''}`}>
                {letter}
              </span>
              <span className="text-sm">{text}</span>
              {answered && letter === currentQ.answer && <CheckCircle size={16} className="text-correct ml-auto shrink-0" />}
              {answered && letter === selectedAnswer && letter !== currentQ.answer && <XCircle size={16} className="text-wrong ml-auto shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* 答题反馈 + 解题思路 */}
      {answered && (
        <div className={`p-3 md:p-4 rounded-card mb-4 space-y-3 ${selectedAnswer === currentQ.answer ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {selectedAnswer === currentQ.answer ? (
              <><CheckCircle size={18} className="text-correct" /><span className="text-sm font-medium text-correct">回答正确！</span></>
            ) : (
              <><XCircle size={18} className="text-wrong" /><span className="text-sm font-medium text-wrong">回答错误！正确答案是 {currentQ.answer}</span></>
            )}
            <span className="text-xs text-text-secondary ml-auto">{AUTO_ADVANCE_MS / 1000}秒后自动跳转</span>
          </div>

          {/* 解题思路 */}
          {currentQ.explanation && (
            <div className="bg-white/70 rounded-btn p-3 flex items-start gap-2">
              <Lightbulb size={16} className="text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary">{currentQ.explanation}</p>
            </div>
          )}

          {/* 知识点 */}
          {currentQ.knowledge_point && (
            <div className="bg-white/70 rounded-btn p-3 flex items-start gap-2">
              <Tag size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary">{currentQ.knowledge_point}</p>
            </div>
          )}
        </div>
      )}

      {/* 导航按钮 */}
      <div className="flex items-center justify-between">
        <button onClick={goPrev} disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 md:px-4 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-30">
          <ArrowLeft size={16} />上一题
        </button>
        {answered && (
          <button onClick={goNext}
            className="flex items-center gap-1 bg-primary text-white px-4 md:px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-primary-hover">
            {currentIndex < questions.length - 1 ? <><>下一题</><ArrowRight size={16} /></> : '查看成绩'}
          </button>
        )}
      </div>

      {/* 键盘提示 */}
      <div className="mt-6 text-center hidden md:block">
        <p className="text-xs text-text-secondary">💡 A/B/C/D 选择 · Enter/→ 下一题 · ← 上一题</p>
      </div>
    </div>
  )
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
