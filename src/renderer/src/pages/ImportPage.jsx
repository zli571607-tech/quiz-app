import { useState, useRef, useCallback } from 'react'
import { FileUp, CheckCircle, XCircle, Loader2, Trash2, Sparkles, ChevronDown, ChevronUp, Lightbulb, Tag, FileText, FileImage } from 'lucide-react'
import { parseDocument } from '../utils/documentParser'
import { generateQuestions } from '../utils/aiService'
import { useDB } from '../utils/dbContext'

export default function ImportPage() {
  const { saveQuestions, dbReady } = useDB()
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState([])
  const [genError, setGenError] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [mode, setMode] = useState('原题')
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileInputRef = useRef(null)

  const handleFile = useCallback(async (f) => {
    setFile({ name: f.name, size: f.size })
    setError(''); setContent(''); setQuestions([]); setGenError(''); setSaved(false)
    setParsing(true)
    const result = await parseDocument(f)
    setParsing(false)
    if (result.success) setContent(result.content)
    else setError(result.error)
  }, [])

  const onFileChange = (e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }

  const handleGenerate = async () => {
    setGenError(''); setGenerating(true); setSaved(false)
    const result = await generateQuestions(content, { count: questionCount, mode })
    setGenerating(false)
    if (result.success) setQuestions(result.questions)
    else setGenError(result.error)
  }

  const updateQ = (i, f, v) => { const u = [...questions]; u[i] = { ...u[i], [f]: v }; setQuestions(u) }
  const updateOpt = (qi, oi, v) => { const u = [...questions]; const o = [...u[qi].options]; o[oi] = v; u[qi] = { ...u[qi], options: o }; setQuestions(u) }
  const delQ = (i) => setQuestions(questions.filter((_, idx) => idx !== i))

  const formatSize = (b) => {
    if (!b) return ''
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`
    return `${(b / 1024 / 1024).toFixed(1)}MB`
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h2 className="text-xl md:text-2xl font-semibold mb-1">导入文档，AI 生成题目</h2>
      <p className="text-text-secondary text-sm mb-4">支持 Word、PDF、TXT、PPT 文件</p>

      {/* ====== 步骤1：选择文件 ====== */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
          <span className="font-medium text-sm">选择文档</span>
        </div>

        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.pptx" onChange={onFileChange} className="hidden" />

        {!file ? (
          <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-primary rounded-card p-8 md:p-12 flex flex-col items-center gap-3 hover:bg-blue-50 transition-colors cursor-pointer">
            <FileUp size={48} className="text-primary" />
            <div className="text-center">
              <p className="text-base font-medium text-primary">点击这里选择文档</p>
              <p className="text-sm text-text-secondary mt-1">Word(.docx) / PDF / TXT / PPT(.pptx)</p>
            </div>
          </button>
        ) : parsing ? (
          <div className="border-2 border-primary rounded-card p-8 flex flex-col items-center gap-3 bg-blue-50">
            <Loader2 size={48} className="text-primary animate-spin" />
            <p className="font-medium">正在解析 "{file.name}"...</p>
          </div>
        ) : error ? (
          <div className="border-2 border-wrong rounded-card p-6 bg-red-50">
            <div className="flex items-center gap-2 mb-3">
              <XCircle size={24} className="text-wrong" />
              <span className="font-medium text-wrong">{error}</span>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="text-primary text-sm underline">重新选择文件</button>
          </div>
        ) : (
          <div className="bg-green-50 border-2 border-correct rounded-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle size={24} className="text-correct" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-text-secondary">{formatSize(file.size)} · {content.length} 字</p>
                </div>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="text-primary text-sm underline">更换</button>
            </div>
          </div>
        )}
      </div>

      {/* ====== 步骤2：生成设置 ====== */}
      {content && !error && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
            <span className="font-medium text-sm">生成设置</span>
          </div>
          <div className="bg-card border border-border rounded-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">题目数量</span>
                <input type="number" value={questionCount} onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1" max="200" className="w-20 px-3 py-1.5 border border-border rounded-btn text-sm outline-none focus:border-primary" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">出题模式</span>
                <select value={mode} onChange={e => setMode(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-btn text-sm outline-none focus:border-primary">
                  <option value="原题">📝 原题（根据文档直接出题）</option>
                  <option value="拓展">🔍 拓展（知识点延伸出题）</option>
                </select>
              </div>
            </div>

            <button onClick={handleGenerate} disabled={generating}
              className="w-full bg-primary text-white py-3 rounded-btn font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2">
              {generating ? <><Loader2 size={18} className="animate-spin" />AI 正在生成题目...</> : <><Sparkles size={18} />{mode === '原题' ? '根据原文' : '知识点拓展'}出 {questionCount} 道题</>}
            </button>
          </div>
        </div>
      )}

      {genError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-card flex items-start gap-3">
          <XCircle size={20} className="text-wrong shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-wrong">生成失败</p><p className="text-sm text-text-secondary mt-1">{genError}</p></div>
        </div>
      )}

      {/* ====== 步骤3：预览题目 ====== */}
      {questions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">3</span>
            <span className="font-medium text-sm">预览与入库（{questions.length} 题）</span>
          </div>

          <div className="space-y-2 mb-4">
            {questions.map((q, qi) => (
              <div key={q.id} className="bg-card border border-border rounded-card overflow-hidden">
                <div className="flex items-start gap-2 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedIndex(expandedIndex === qi ? null : qi)}>
                  <span className="text-xs font-semibold text-primary bg-blue-50 px-2 py-0.5 rounded mt-0.5 shrink-0">{qi + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{q.topic}</p>
                    <p className="text-xs text-text-secondary mt-1">答案：{q.answer}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={e => { e.stopPropagation(); delQ(qi) }} className="p-1 text-text-secondary hover:text-wrong"><Trash2 size={14} /></button>
                    {expandedIndex === qi ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {expandedIndex === qi && (
                  <div className="px-3 pb-3 border-t border-border pt-3 space-y-2 bg-gray-50/50">
                    <textarea value={q.topic} onChange={e => updateQ(qi, 'topic', e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-btn text-sm resize-none" rows={2} />
                    {['A', 'B', 'C', 'D'].map((l, oi) => (
                      <div key={l} className="flex items-center gap-2"><span className="text-xs w-5">{l}</span>
                        <input value={q.options?.[oi] || ''} onChange={e => updateOpt(qi, oi, e.target.value)} className="flex-1 px-2 py-1.5 border border-border rounded-btn text-sm" />
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <span className="text-xs">答案</span>
                      <select value={q.answer} onChange={e => updateQ(qi, 'answer', e.target.value)} className="px-2 py-1 border border-border rounded-btn text-sm">
                        {['A', 'B', 'C', 'D'].map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="flex items-start gap-1"><Lightbulb size={12} className="mt-1 text-yellow-500" />
                      <textarea value={q.explanation || ''} onChange={e => updateQ(qi, 'explanation', e.target.value)} placeholder="解题思路" className="flex-1 px-2 py-1 border border-border rounded-btn text-xs resize-none" rows={1} />
                    </div>
                    <div className="flex items-start gap-1"><Tag size={12} className="mt-1 text-primary" />
                      <input value={q.knowledgePoint || ''} onChange={e => updateQ(qi, 'knowledgePoint', e.target.value)} placeholder="知识点" className="flex-1 px-2 py-1 border border-border rounded-btn text-xs" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {saveError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-card text-sm text-wrong">{saveError}</div>
          )}

          <button onClick={() => {
            setSaveError('')
            const r = saveQuestions(questions, file?.name || '')
            if (r.success) setSaved(true)
            else setSaveError(r.error || '保存失败')
          }} disabled={!dbReady || saved} className="w-full bg-correct text-white py-3 rounded-btn font-medium hover:bg-green-600 disabled:opacity-50">
            {saved ? `✅ 已保存 ${questions.length} 道题目` : dbReady ? `✅ 确认入库（${questions.length} 题）` : '⏳ 数据库加载中...'}
          </button>
        </div>
      )}
    </div>
  )
}
