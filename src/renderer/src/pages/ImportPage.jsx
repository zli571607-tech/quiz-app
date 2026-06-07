import { useState, useRef, useCallback } from 'react'
import { FileUp, CheckCircle, XCircle, Loader2, Trash2, Sparkles, ChevronDown, ChevronUp, Lightbulb, Tag } from 'lucide-react'
import { parseDocument } from '../utils/documentParser'
import { generateQuestions } from '../utils/aiService'
import { useDB } from '../utils/dbContext'

const ACCEPTED_TYPES = '.pdf,.docx,.txt,.pptx'

export default function ImportPage() {
  const { saveQuestions, dbReady, dbError } = useDB()
  const [dragOver, setDragOver] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState([])
  const [genError, setGenError] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState('中等')
  const [expandedIndex, setExpandedIndex] = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    setFile({ name: file.name, size: file.size })
    setError(''); setContent(''); setQuestions([]); setGenError(''); setSaved(false)
    setParsing(true)
    const result = await parseDocument(file)
    setParsing(false)
    if (result.success) setContent(result.content)
    else setError(result.error)
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false) }
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }
  const onClick = () => fileInputRef.current?.click()
  const onFileChange = (e) => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = '' }

  const handleGenerate = async () => {
    setGenError(''); setGenerating(true); setSaved(false)
    const result = await generateQuestions(content, { count: questionCount, difficulty })
    setGenerating(false)
    if (result.success) setQuestions(result.questions)
    else setGenError(result.error)
  }

  const updateQuestion = (i, f, v) => { const u = [...questions]; u[i] = { ...u[i], [f]: v }; setQuestions(u) }
  const updateOption = (qi, oi, v) => { const u = [...questions]; const o = [...u[qi].options]; o[oi] = v; u[qi] = { ...u[qi], options: o }; setQuestions(u) }
  const deleteQuestion = (i) => setQuestions(questions.filter((_, idx) => idx !== i))

  const formatSize = (b) => {
    if (!b) return ''; if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h2 className="text-xl md:text-2xl font-semibold mb-2">导入文档 & 生成题目</h2>
      <p className="text-text-secondary text-sm mb-4 md:mb-6">支持 PDF、Word(.docx)、TXT、PPT(.pptx) · AI 自动生成选择题</p>

      {/* 拖拽上传 */}
      <div
        className={`drop-zone flex flex-col items-center justify-center py-12 md:py-16 bg-card rounded-card cursor-pointer ${dragOver ? 'drag-over' : ''} ${parsing ? 'pointer-events-none opacity-50' : ''}`}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}
      >
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={onFileChange} className="hidden" />
        {parsing ? (
          <><Loader2 size={48} className="text-primary animate-spin mb-4" /><p className="text-text-primary font-medium">解析文档中...</p><p className="text-text-secondary text-sm mt-2">{file?.name}</p></>
        ) : file ? (
          <><CheckCircle size={48} className="text-correct mb-4" /><p className="text-text-primary font-medium">{file.name}</p><p className="text-text-secondary text-sm mt-1">{formatSize(file.size)} · {content.length} 字 · 点击重新选择</p></>
        ) : (
          <><FileUp size={48} className="text-text-secondary mb-4" /><p className="text-text-primary font-medium">拖拽文件或点击选择</p><p className="text-text-secondary text-sm mt-2">PDF / Word / TXT / PPT</p></>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-card flex items-start gap-3">
          <XCircle size={20} className="text-wrong shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-wrong">解析失败</p><p className="text-sm text-text-secondary mt-1">{error}</p></div>
        </div>
      )}

      {/* 生成设置 */}
      {content && (
        <div className="mt-4 md:mt-6 space-y-4">
          <div className="bg-card border border-border rounded-card p-4 md:p-5">
            <h3 className="font-medium mb-3">生成设置</h3>
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-secondary">题目数量</label>
                <input type="number" value={questionCount} onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1" className="w-20 px-3 py-1.5 border border-border rounded-btn text-sm outline-none focus:border-primary" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-secondary">难度</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-btn text-sm outline-none focus:border-primary">
                  {['简单', '中等', '困难'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={generating}
            className="bg-primary text-white px-6 py-2.5 rounded-btn text-sm font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2">
            {generating ? <><Loader2 size={16} className="animate-spin" />并行生成中（每批6题同时请求，请耐心等待）...</> : <><Sparkles size={16} />生成 {questionCount} 道{difficulty}难度选择题</>}
          </button>
        </div>
      )}

      {genError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-card flex items-start gap-3">
          <XCircle size={20} className="text-wrong shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-wrong">生成失败</p><p className="text-sm text-text-secondary mt-1">{genError}</p></div>
        </div>
      )}

      {/* 题目预览 */}
      {questions.length > 0 && (
        <div className="mt-4 md:mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">生成题目（{questions.length} 题）</h3>
            <span className="text-xs text-text-secondary">点击展开编辑</span>
          </div>
          <div className="space-y-2">
            {questions.map((q, qi) => (
              <div key={q.id} className="bg-card border border-border rounded-card overflow-hidden">
                <div className="flex items-start gap-2 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedIndex(expandedIndex === qi ? null : qi)}>
                  <span className="text-xs font-semibold text-primary bg-blue-50 px-2 py-0.5 rounded mt-0.5 shrink-0">{qi + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{q.topic}</p>
                    <p className="text-xs text-text-secondary mt-1">答案：{q.answer} · {q.options?.length || 0}选项</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); deleteQuestion(qi) }} className="p-1 text-text-secondary hover:text-wrong"><Trash2 size={14} /></button>
                    {expandedIndex === qi ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {expandedIndex === qi && (
                  <div className="px-3 pb-3 border-t border-border pt-3 space-y-3 bg-gray-50/50">
                    <div>
                      <label className="text-xs text-text-secondary block mb-1">题目</label>
                      <textarea value={q.topic} onChange={(e) => updateQuestion(qi, 'topic', e.target.value)} className="w-full px-3 py-2 border border-border rounded-btn text-sm outline-none focus:border-primary resize-none" rows={2} />
                    </div>
                    {['A', 'B', 'C', 'D'].map((l, oi) => (
                      <div key={l} className="flex items-center gap-2">
                        <span className="text-xs font-semibold w-5">{l}</span>
                        <input value={q.options?.[oi] || ''} onChange={(e) => updateOption(qi, oi, e.target.value)} className="flex-1 px-3 py-1.5 border border-border rounded-btn text-sm outline-none focus:border-primary" placeholder={`选项 ${l}`} />
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-text-secondary">正确答案</label>
                      <select value={q.answer} onChange={(e) => updateQuestion(qi, 'answer', e.target.value)} className="px-3 py-1.5 border border-border rounded-btn text-sm">
                        {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary flex items-center gap-1 mb-1"><Lightbulb size={12} />解题思路</label>
                      <textarea value={q.explanation || ''} onChange={(e) => updateQuestion(qi, 'explanation', e.target.value)} className="w-full px-3 py-2 border border-border rounded-btn text-sm outline-none focus:border-primary resize-none" rows={2} />
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary flex items-center gap-1 mb-1"><Tag size={12} />知识点</label>
                      <input value={q.knowledgePoint || ''} onChange={(e) => updateQuestion(qi, 'knowledgePoint', e.target.value)} className="w-full px-3 py-2 border border-border rounded-btn text-sm outline-none focus:border-primary" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {saveError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-card flex items-start gap-3">
              <XCircle size={20} className="text-wrong shrink-0 mt-0.5" />
              <div><p className="text-sm font-medium text-wrong">保存失败</p><p className="text-sm text-text-secondary mt-1">{saveError}</p></div>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-3">
            {saved ? (
              <div className="flex items-center gap-2 text-correct text-sm font-medium"><CheckCircle size={18} />已保存 {questions.length} 题</div>
            ) : (
              <button onClick={() => { setSaveError(''); const r = saveQuestions(questions, file?.name || ''); if (r.success) setSaved(true); else setSaveError(r.error || '保存失败') }}
                disabled={!dbReady} className="bg-correct text-white px-6 py-2.5 rounded-btn text-sm font-medium hover:bg-green-600 disabled:opacity-50">
                {dbReady ? `✅ 确认入库（${questions.length} 题）` : '⏳ 数据库加载中...'}
              </button>
            )}
          </div>
          {dbError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-card text-sm text-wrong">⚠️ {dbError}</div>}
        </div>
      )}
    </div>
  )
}
