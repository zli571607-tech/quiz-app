import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, ArrowLeft, RotateCcw, Lightbulb, Tag } from 'lucide-react'

export default function ResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state

  if (!state || !state.answers) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-full">
        <div className="text-center max-w-md">
          <Clock size={48} className="text-text-secondary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">暂无成绩</h2>
          <p className="text-text-secondary mb-6">完成一次刷题后查看</p>
          <NavLink to="/quiz" className="bg-primary text-white px-5 py-2.5 rounded-btn text-sm font-medium inline-block">去刷题</NavLink>
        </div>
      </div>
    )
  }

  const { answers, questions, startTime, endTime } = state
  const correctCount = answers.filter(a => a.isCorrect).length
  const wrongCount = answers.length - correctCount
  const accuracy = Math.round((correctCount / answers.length) * 100) || 0
  const totalTime = Math.round(((endTime || Date.now()) - startTime) / 1000)
  const minutes = Math.floor(totalTime / 60)
  const seconds = totalTime % 60

  const answerDetails = answers.map(a => {
    const q = questions.find(q => q.id === a.questionId)
    return { ...a, question: q }
  })

  const wrongAnswers = answerDetails.filter(a => !a.isCorrect)

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm mb-4 md:mb-6">
        <ArrowLeft size={16} />返回
      </button>
      <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">成绩报告</h2>

      {/* 正确率圆环 */}
      <div className="bg-card border border-border rounded-card p-4 md:p-6 mb-4 md:mb-6 flex flex-col items-center">
        <div className="relative w-28 h-28 md:w-36 md:h-36 mb-3 md:mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none"
              stroke={accuracy >= 60 ? '#22C55E' : accuracy >= 30 ? '#F59E0B' : '#EF4444'}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${accuracy * 3.267} 326.7`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl md:text-3xl font-bold">{accuracy}%</span>
            <span className="text-xs text-text-secondary">正确率</span>
          </div>
        </div>
        <p className="text-sm text-text-secondary">{accuracy >= 80 ? '🎉 非常棒！' : accuracy >= 60 ? '👍 不错！' : '💪 继续加油！'}</p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
        {[
          { label: '总题数', value: answers.length, color: 'text-text-primary' },
          { label: '正确', value: correctCount, color: 'text-correct' },
          { label: '错误', value: wrongCount, color: 'text-wrong' },
          { label: '用时', value: `${minutes}:${String(seconds).padStart(2, '0')}`, color: 'text-text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-card p-3 md:p-4 text-center">
            <p className={`text-lg md:text-xl font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-text-secondary mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* 错题汇总 */}
      {wrongAnswers.length > 0 && (
        <div className="mb-4 md:mb-6">
          <h3 className="font-medium mb-3">📕 错题回顾（{wrongAnswers.length} 题）</h3>
          <div className="space-y-2 md:space-y-3">
            {wrongAnswers.map((a, idx) => (
              <div key={idx} className="bg-card border border-red-200 rounded-card p-3 md:p-4">
                <div className="flex items-start gap-2">
                  <XCircle size={16} className="text-wrong shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-2">{a.question?.topic || '(题目已删除)'}</p>
                    <p className="text-xs text-text-secondary">
                      你的答案：<span className="text-wrong font-medium">{a.userAnswer}</span>
                      {' · '}正确答案：<span className="text-correct font-medium">{a.question?.answer}</span>
                    </p>
                    {a.question?.explanation && (
                      <div className="mt-2 bg-orange-50 rounded-btn p-2 flex items-start gap-1.5">
                        <Lightbulb size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-text-primary">{a.question.explanation}</p>
                      </div>
                    )}
                    {a.question?.knowledge_point && (
                      <div className="mt-1.5 flex items-start gap-1.5">
                        <Tag size={14} className="text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-primary">{a.question.knowledge_point}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全部答题详情 */}
      <div className="mb-4 md:mb-6">
        <h3 className="font-medium mb-3">全部答题详情</h3>
        <div className="space-y-2">
          {answerDetails.map((a, idx) => (
            <div key={idx} className={`bg-card border rounded-card p-3 ${a.isCorrect ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-start gap-2">
                {a.isCorrect ? <CheckCircle size={14} className="text-correct shrink-0 mt-0.5" /> : <XCircle size={14} className="text-wrong shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm">{a.question?.topic || '(题目已删除)'}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span>你的答案：<span className={a.isCorrect ? 'text-correct font-medium' : 'text-wrong font-medium'}>{a.userAnswer || '未作答'}</span></span>
                    {!a.isCorrect && a.question && <span className="text-correct font-medium">正确答案：{a.question.answer}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col md:flex-row gap-3 justify-center">
        <button onClick={() => navigate('/quiz')} className="bg-primary text-white px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-primary-hover flex items-center justify-center gap-1">
          <RotateCcw size={16} />再来一次
        </button>
        <NavLink to="/wrong" className="bg-white border border-border px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-gray-50 transition-colors text-center">查看错题本</NavLink>
      </div>
    </div>
  )
}
