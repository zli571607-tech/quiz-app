import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getWrongQuestions } from '../utils/database'
import { useDB } from '../utils/dbContext'
import { BookX, CheckCircle, RotateCcw, Trash2 } from 'lucide-react'

export default function WrongPage() {
  const { refreshKey } = useDB()
  const wrongQuestions = getWrongQuestions()

  // 如果没有错题
  if (wrongQuestions.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-full">
        <div className="text-center max-w-md">
          <CheckCircle size={64} className="text-correct mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">暂无错题</h2>
          <p className="text-text-secondary mb-6">继续保持！所有题目都已掌握</p>
          <NavLink to="/quiz" className="bg-primary text-white px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-primary-hover transition-colors inline-block">
            去刷题
          </NavLink>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">错题本</h2>
        <span className="text-sm text-text-secondary">
          共 {wrongQuestions.length} 道错题
        </span>
      </div>

      <div className="space-y-3">
        {wrongQuestions.map((q, idx) => (
          <div key={q.id} className="bg-card border border-red-200 rounded-card p-4">
            <div className="flex items-start gap-3">
              <BookX size={18} className="text-wrong shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-2">{q.topic}</p>
                <div className="space-y-1">
                  {q.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i)
                    const isCorrect = letter === q.answer
                    return (
                      <div
                        key={i}
                        className={`text-xs px-3 py-1.5 rounded-btn ${
                          isCorrect
                            ? 'bg-green-100 text-correct font-medium'
                            : 'bg-gray-100 text-text-secondary'
                        }`}
                      >
                        <span className="font-semibold mr-1">{letter}.</span>
                        {opt}
                        {isCorrect && ' ✓'}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
