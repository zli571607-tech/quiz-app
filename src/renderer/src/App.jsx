import { Component, Suspense, lazy, useState } from 'react'
import { Routes, Route, NavLink, useLocation, HashRouter } from 'react-router-dom'
import { Home, FileUp, Library, PenLine, BarChart3, BookX, AlertTriangle, Loader2, Menu, X } from 'lucide-react'
import { DBProvider, useDB } from './utils/dbContext'
import { getStats } from './utils/database'

const ImportPage = lazy(() => import('./pages/ImportPage'))
const QuestionsPage = lazy(() => import('./pages/QuestionsPage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))
const WrongPage = lazy(() => import('./pages/WrongPage'))

function PageLoading() { return <div className="flex items-center justify-center py-20"><Loader2 size={32} className="text-primary animate-spin" /></div> }

class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { e: null } }
  static getDerivedStateFromError(e) { return { e } }
  render() {
    if (this.state.e) return (<div className="p-8 flex items-center justify-center min-h-full"><div className="max-w-md text-center"><AlertTriangle size={48} className="text-wrong mx-auto mb-4" /><h2 className="text-lg font-semibold mb-2">页面出错</h2><p className="text-sm text-text-secondary mb-4">{this.state.e?.message || '未知错误'}</p><button onClick={() => { this.setState({ e: null }); window.location.reload() }} className="bg-primary text-white px-4 py-2 rounded-btn text-sm hover:bg-primary-hover">刷新重试</button></div></div>)
    return this.props.children
  }
}

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/import', icon: FileUp, label: '导入生成' },
  { path: '/questions', icon: Library, label: '题库管理' },
  { path: '/quiz', icon: PenLine, label: '开始刷题' },
  { path: '/result', icon: BarChart3, label: '成绩' },
  { path: '/wrong', icon: BookX, label: '错题本' },
]

function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation()
  const { dbReady } = useDB()
  const nav = (<>
    <div className="px-5 py-6 border-b border-border flex items-center justify-between">
      <div><h1 className="text-lg font-semibold text-primary">📝 刷题软件</h1><p className="text-xs text-text-secondary mt-1">{dbReady ? 'AI 驱动的学习工具' : '⏳ 加载中...'}</p></div>
      <button onClick={onClose} className="md:hidden p-1 text-text-secondary hover:text-text-primary"><X size={20} /></button>
    </div>
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname === path
        return (<NavLink key={path} to={path} onClick={onClose} className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:bg-white hover:text-text-primary'}`}><Icon size={18} />{label}</NavLink>)
      })}
    </nav>
    <div className="px-5 py-4 border-t border-border mt-auto"><p className="text-xs text-text-secondary">v1.0.1</p></div>
  </>)
  return (<>
    <aside className="hidden md:flex w-56 bg-sidebar min-h-screen border-r border-border flex-col shrink-0">{nav}</aside>
    {mobileOpen && (<div className="md:hidden fixed inset-0 z-50 flex"><div className="fixed inset-0 bg-black/50" onClick={onClose} /><aside className="relative w-64 bg-sidebar min-h-full border-r border-border flex flex-col z-50">{nav}</aside></div>)}
  </>)
}

function HomePage() {
  const { dbReady, dbError } = useDB()
  const stats = dbReady ? getStats() : { totalQuestions: 0, totalSessions: 0, totalAnswers: 0, accuracy: 0 }
  if (dbError) return (<div className="p-8 flex items-center justify-center min-h-full"><div className="max-w-md text-center"><AlertTriangle size={48} className="text-wrong mx-auto mb-4" /><h2 className="text-lg font-semibold mb-2">数据库加载失败</h2><p className="text-sm text-text-secondary mb-4">{dbError}</p><button onClick={() => window.location.reload()} className="bg-primary text-white px-4 py-2 rounded-btn text-sm">刷新页面</button></div></div>)
  return (<div className="p-4 md:p-8"><h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">欢迎回来 👋</h2>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
      {[{ label: '题库总数', value: stats.totalQuestions, unit: '题' }, { label: '累计刷题', value: stats.totalSessions, unit: '次' }, { label: '平均正确率', value: stats.totalAnswers > 0 ? stats.accuracy : '--', unit: '%' }].map(({ label, value, unit }) => (<div key={label} className="bg-card rounded-card p-4 md:p-5 border border-border"><p className="text-xs md:text-sm text-text-secondary">{label}</p><p className="text-2xl md:text-3xl font-semibold mt-2">{value}<span className="text-base md:text-lg text-text-secondary ml-1">{unit}</span></p></div>))}
    </div>
    <div className="flex flex-col md:flex-row gap-3 mb-6">
      <NavLink to="/import" className="bg-primary text-white px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-primary-hover transition-colors text-center">📂 导入文档生成题目</NavLink>
      <NavLink to="/quiz" className="bg-white border border-primary text-primary px-5 py-2.5 rounded-btn text-sm font-medium hover:bg-blue-50 transition-colors text-center">✍️ 开始刷题</NavLink>
    </div>
    <BackupSection />
  </div>)
}

// ============ 备份组件（Word 文档） ============
function BackupSection() {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const doExport = async () => {
    setLoading(true)
    try {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } = await import('docx')

      // 读取所有题目
      const dbModule = await import('./utils/database')
      const questions = dbModule.getAllQuestions()

      if (questions.length === 0) { alert('题库为空，请先生成题目'); setLoading(false); return }

      // 构建 Word 文档
      const children = [
        new Paragraph({ children: [new TextRun({ text: '刷题软件 - 题库导出', bold: true, size: 32 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: `导出日期：${new Date().toLocaleDateString('zh-CN')}  共 ${questions.length} 题`, size: 20, color: '666666' })], spacing: { after: 400 } }),
      ]

      questions.forEach((q, idx) => {
        // 题目标题
        children.push(new Paragraph({
          children: [new TextRun({ text: `${idx + 1}. ${q.topic}`, bold: true, size: 22 })],
          spacing: { before: 300, after: 100 },
        }))
        // 选项
        const optLabels = ['A', 'B', 'C', 'D']
        q.options.forEach((opt, i) => {
          const isAnswer = optLabels[i] === q.answer
          children.push(new Paragraph({
            children: [new TextRun({ text: `    ${optLabels[i]}. ${opt}`, size: 20, color: isAnswer ? '008000' : '333333', bold: isAnswer })],
            spacing: { after: 50 },
          }))
        })
        // 答案
        children.push(new Paragraph({
          children: [new TextRun({ text: `    正确答案：${q.answer}`, size: 18, color: '008000', italics: true })],
          spacing: { after: 50 },
        }))
        // 解题思路
        if (q.explanation) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `    解题思路：${q.explanation}`, size: 18, color: '666666' })],
            spacing: { after: 50 },
          }))
        }
        // 知识点
        if (q.knowledge_point) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `    知识点：${q.knowledge_point}`, size: 18, color: '3366CC' })],
            spacing: { after: 50 },
          }))
        }
      })

      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      })

      const blob = await Packer.toBlob(doc)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `题库_${new Date().toLocaleDateString('zh-CN')}.docx`
      a.click()
      setMsg('✅ 题库已导出为 Word 文档！')
    } catch (e) {
      setMsg('导出失败：' + e.message)
    }
    setLoading(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const doImport = async (file) => {
    if (!file) return
    setLoading(true)
    setMsg('')
    try {
      const arrayBuffer = await file.arrayBuffer()
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ arrayBuffer })
      const text = result.value

      if (!text.trim()) { setMsg('Word 文档为空，无法导入'); setLoading(false); return }

      // 尝试解析题目
      const questions = parseQuestionsFromText(text)

      if (questions.length === 0) {
        // 如果不是题库格式，就当作普通文档导入（只存文本，让用户自己处理）
        setMsg('未识别到题目格式。请使用"导出题库"生成的 Word 文件导入。')
        setLoading(false)
        return
      }

      if (!confirm(`识别到 ${questions.length} 道题目，将添加到当前题库，确定？`)) { setLoading(false); return }

      const dbModule = await import('./utils/database')
      for (const q of questions) {
        dbModule.addQuestion(q.topic, q.options, q.answer, null, file.name, q.explanation || '', q.knowledgePoint || '')
      }

      setMsg(`✅ 成功导入 ${questions.length} 道题目！`)
      // 触发刷新
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      setMsg('导入失败：' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="bg-card border border-border rounded-card p-4">
      <h3 className="text-sm font-medium mb-3">📄 题库备份（Word 文档）</h3>
      <p className="text-xs text-text-secondary mb-3">导出为 Word(.docx) 文件 → 发送到另一台设备 → 导入</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={doExport} disabled={loading} className="bg-primary text-white px-4 py-2 rounded-btn text-sm disabled:opacity-50">
          {loading ? '处理中...' : '📤 导出 Word'}
        </button>
        <label className="bg-correct text-white px-4 py-2 rounded-btn text-sm cursor-pointer hover:bg-green-600 disabled:opacity-50">
          📥 导入 Word
          <input type="file" accept=".docx" className="hidden" disabled={loading} onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
        </label>
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.startsWith('✅') ? 'text-correct' : 'text-wrong'}`}>{msg}</p>}
    </div>
  )
}

// 从文本解析题目
function parseQuestionsFromText(text) {
  const questions = []
  // 匹配题目编号：数字 + 点 + 内容
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let current = null
  for (const line of lines) {
    // 匹配 "1. 题目内容" 或 "1、题目内容"
    const topicMatch = line.match(/^(\d+)[\.、\s]+(.+)/)
    if (topicMatch && !line.startsWith('    ') && topicMatch[1].length <= 3) {
      if (current && current.topic) questions.push(current)
      current = { topic: topicMatch[2].trim(), options: [], answer: '', explanation: '', knowledgePoint: '' }
      continue
    }
    if (!current) continue

    // 匹配选项 A. B. C. D.
    const optMatch = line.match(/^\s*([A-D])[\.\、\s]+(.+)/)
    if (optMatch && optMatch[2].length > 1) {
      current.options.push(optMatch[2].trim())
      continue
    }

    // 匹配正确答案
    const ansMatch = line.match(/正确答案[：:]\s*([A-D])/i)
    if (ansMatch) { current.answer = ansMatch[1].toUpperCase(); continue }

    // 匹配解题思路
    const expMatch = line.match(/解题思路[：:]\s*(.+)/)
    if (expMatch) { current.explanation = expMatch[1].trim(); continue }

    // 匹配知识点
    const kpMatch = line.match(/知识点[：:]\s*(.+)/)
    if (kpMatch) { current.knowledgePoint = kpMatch[1].trim(); continue }
  }
  if (current && current.topic) questions.push(current)

  return questions.filter(q => q.options.length >= 2 && q.answer)
}

function AppContent() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="flex h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-white sticky top-0 z-10">
          <button onClick={() => setMobileOpen(true)} className="p-1 text-text-primary"><Menu size={24} /></button>
          <h1 className="text-base font-semibold text-primary">📝 刷题软件</h1>
        </div>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/questions" element={<QuestionsPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/result" element={<ResultPage />} />
              <Route path="/wrong" element={<WrongPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() { return (<HashRouter><DBProvider><AppContent /></DBProvider></HashRouter>) }
