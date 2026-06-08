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
    <div className="px-5 py-4 border-t border-border mt-auto"><p className="text-xs text-text-secondary">v1.0.0</p></div>
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

// ============ 备份组件 ============
function BackupSection() {
  const [show, setShow] = useState(null) // null | 'export' | 'import'
  const [data, setData] = useState('')
  const [msg, setMsg] = useState('')

  const getData = () => {
    const obj = {}
    for (let i = 0; i < localStorage.length; i++) obj[localStorage.key(i)] = localStorage.getItem(localStorage.key(i))
    return JSON.stringify(obj, null, 2)
  }

  if (show === 'export') return (
    <div className="bg-card border border-border rounded-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">📤 导出题库</h3>
        <button onClick={() => setShow(null)} className="text-xs text-text-secondary">关闭</button>
      </div>
      <textarea readOnly value={data} onClick={e => e.target.select()} className="w-full h-40 p-3 border border-border rounded-btn text-xs font-mono resize-none bg-white mb-3" />
      <div className="flex flex-wrap gap-2">
        <button onClick={async () => { try { await navigator.clipboard.writeText(data); setMsg('✅ 已复制！可粘贴发送到另一台设备'); setTimeout(() => setMsg(''), 3000) } catch { setMsg('复制失败请手动全选'); setTimeout(() => setMsg(''), 3000) } }} className="bg-primary text-white px-4 py-2 rounded-btn text-sm">📋 一键复制</button>
        <button onClick={() => { const b = new Blob([data], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `题库备份_${new Date().toLocaleDateString()}.json`; a.click() }} className="bg-white border px-4 py-2 rounded-btn text-sm">📥 下载文件</button>
      </div>
      {msg && <p className="text-xs text-correct mt-2">{msg}</p>}
    </div>
  )

  if (show === 'import') return (
    <div className="bg-card border border-border rounded-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">📥 导入题库</h3>
        <button onClick={() => { setShow(null); setData('') }} className="text-xs text-text-secondary">关闭</button>
      </div>
      <textarea value={data} onChange={e => setData(e.target.value)} placeholder="把从另一台设备复制的备份数据粘贴到这里..." className="w-full h-40 p-3 border border-border rounded-btn text-xs font-mono resize-none bg-white mb-3" />
      <div className="flex flex-wrap gap-2">
        <button onClick={() => {
          if (!data.trim()) { setMsg('请先粘贴数据'); return }
          try {
            const obj = JSON.parse(data)
            if (!obj || !Object.keys(obj).length) { setMsg('数据为空'); return }
            if (!confirm(`导入 ${Object.keys(obj).length} 条记录，覆盖当前数据？`)) return
            Object.entries(obj).forEach(([k, v]) => { if (typeof v === 'string') localStorage.setItem(k, v) })
            alert('导入成功！正在刷新...')
            window.location.reload()
          } catch { setMsg('格式错误，请确保完整复制'); setTimeout(() => setMsg(''), 3000) }
        }} className="bg-correct text-white px-4 py-2 rounded-btn text-sm">✅ 确认导入</button>
        <label className="bg-white border px-4 py-2 rounded-btn text-sm cursor-pointer">📂 选择文件导入
          <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setData(r.result); r.readAsText(f) }} />
        </label>
      </div>
      {msg && <p className="text-xs text-wrong mt-2">{msg}</p>}
    </div>
  )

  return (
    <div className="bg-card border border-border rounded-card p-4">
      <h3 className="text-sm font-medium mb-3">💾 题库同步（手机 ↔ 电脑）</h3>
      <p className="text-xs text-text-secondary mb-3">导出 → 复制文字 → 发到另一台设备 → 粘贴导入</p>
      <div className="flex gap-2">
        <button onClick={() => { setData(getData()); setShow('export') }} className="bg-primary text-white px-4 py-2 rounded-btn text-sm">📤 导出题库</button>
        <button onClick={() => { setData(''); setShow('import'); setMsg('') }} className="bg-correct text-white px-4 py-2 rounded-btn text-sm">📥 导入题库</button>
      </div>
    </div>
  )
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
