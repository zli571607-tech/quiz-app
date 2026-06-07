import { useState } from 'react'
import { useDB } from '../utils/dbContext'
import {
  getQuestionsByDeck, deleteDeck, deleteQuestion,
  updateQuestion, addQuestion,
} from '../utils/database'
import {
  Trash2, Edit3, ChevronDown, ChevronUp, Plus, Search,
  FolderOpen, X,
} from 'lucide-react'

export default function QuestionsPage() {
  const { decks, refresh } = useDB()
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [questions, setQuestions] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // 编辑中的表单数据
  const [editForm, setEditForm] = useState({
    topic: '', options: ['', '', '', ''], answer: 'A',
  })

  // 选择题套
  const handleSelectDeck = (deck) => {
    setSelectedDeck(deck)
    const qs = getQuestionsByDeck(deck.id)
    setQuestions(qs)
    setSearchTerm('')
    setEditingId(null)
    setShowAddForm(false)
  }

  // 删除题套
  const handleDeleteDeck = (deckId) => {
    if (!confirm('确定要删除这个题套及其所有题目吗？此操作不可撤销。')) return
    deleteDeck(deckId)
    if (selectedDeck?.id === deckId) {
      setSelectedDeck(null)
      setQuestions([])
    }
    refresh()
  }

  // 开始编辑
  const startEdit = (q) => {
    setEditingId(q.id)
    setEditForm({
      topic: q.topic,
      options: [...q.options],
      answer: q.answer,
    })
    setShowAddForm(false)
  }

  // 保存编辑
  const saveEdit = () => {
    if (!editForm.topic.trim()) return
    updateQuestion(editingId, editForm.topic, editForm.options, editForm.answer)
    setEditingId(null)
    // 刷新题目列表
    handleSelectDeck(selectedDeck)
  }

  // 删除题目
  const handleDeleteQuestion = (id) => {
    if (!confirm('确定删除这道题目吗？')) return
    deleteQuestion(id)
    handleSelectDeck(selectedDeck)
    refresh()
  }

  // 添加新题目
  const saveNewQuestion = () => {
    if (!editForm.topic.trim()) return
    addQuestion(
      editForm.topic,
      editForm.options,
      editForm.answer,
      selectedDeck?.id || null,
      selectedDeck?.source_file || '',
    )
    setShowAddForm(false)
    setEditForm({ topic: '', options: ['', '', '', ''], answer: 'A' })
    handleSelectDeck(selectedDeck)
    refresh()
  }

  // 搜索过滤
  const filteredQuestions = searchTerm
    ? questions.filter(q =>
        q.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.options.some(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : questions

  return (
    <div className="flex h-full">
      {/* 左侧题套列表 */}
      <div className="w-64 border-r border-border bg-card shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">题套列表</h3>
        </div>
        <div className="p-2">
          {decks.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
              暂无题套
            </div>
          ) : (
            decks.map(deck => (
              <div
                key={deck.id}
                onClick={() => handleSelectDeck(deck)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-btn mb-1 cursor-pointer transition-colors group
                  ${selectedDeck?.id === deck.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-100 border border-transparent'
                  }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{deck.name}</p>
                  <p className="text-xs text-text-secondary">
                    {deck.question_count} 题 · {deck.source_file || '手动录入'}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id) }}
                  className="p-1 text-text-secondary hover:text-wrong opacity-0 group-hover:opacity-100 transition-all"
                  title="删除题套"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧题目列表 */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!selectedDeck ? (
          <div className="flex items-center justify-center h-full text-text-secondary">
            <div className="text-center">
              <FolderOpen size={48} className="mx-auto mb-3 opacity-50" />
              <p>请从左侧选择一个题套查看题目</p>
            </div>
          </div>
        ) : (
          <>
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{selectedDeck.name}</h2>
              <button
                onClick={() => {
                  setShowAddForm(true)
                  setEditingId(null)
                  setEditForm({ topic: '', options: ['', '', '', ''], answer: 'A' })
                }}
                className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-btn text-sm hover:bg-primary-hover transition-colors"
              >
                <Plus size={16} />
                添加题目
              </button>
            </div>

            {/* 搜索 */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索题目..."
                className="w-full pl-9 pr-3 py-2 border border-border rounded-btn text-sm outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* 添加/编辑表单 */}
            {(showAddForm || editingId) && (
              <div className="mb-4 bg-white border border-border rounded-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    {showAddForm ? '添加新题目' : '编辑题目'}
                  </h4>
                  <button
                    onClick={() => { setShowAddForm(false); setEditingId(null) }}
                    className="p-1 text-text-secondary hover:text-text-primary"
                  >
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={editForm.topic}
                  onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                  placeholder="输入题目内容"
                  className="w-full px-3 py-2 border border-border rounded-btn text-sm outline-none focus:border-primary resize-none"
                  rows={2}
                />
                {['A', 'B', 'C', 'D'].map((letter, i) => (
                  <div key={letter} className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-5">{letter}</span>
                    <input
                      value={editForm.options[i]}
                      onChange={(e) => {
                        const opts = [...editForm.options]
                        opts[i] = e.target.value
                        setEditForm({ ...editForm, options: opts })
                      }}
                      placeholder={`选项 ${letter}`}
                      className="flex-1 px-3 py-1.5 border border-border rounded-btn text-sm outline-none focus:border-primary"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">正确答案</span>
                  <select
                    value={editForm.answer}
                    onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                    className="px-3 py-1.5 border border-border rounded-btn text-sm outline-none"
                  >
                    {['A', 'B', 'C', 'D'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={showAddForm ? saveNewQuestion : saveEdit}
                  className="bg-primary text-white px-4 py-2 rounded-btn text-sm hover:bg-primary-hover transition-colors"
                >
                  {showAddForm ? '添加' : '保存'}
                </button>
              </div>
            )}

            {/* 题目列表 */}
            {filteredQuestions.length === 0 ? (
              <div className="text-center text-text-secondary py-12">
                <p>暂无题目</p>
                <p className="text-sm mt-1">
                  {questions.length > 0 ? '没有匹配的搜索结果' : '点击"添加题目"手动录入'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map((q, idx) => (
                  <div key={q.id} className="bg-card border border-border rounded-card p-3 flex items-start gap-3 group">
                    <span className="text-xs text-text-secondary mt-0.5">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{q.topic}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {q.options.map((opt, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              String.fromCharCode(65 + i) === q.answer
                                ? 'bg-green-100 text-correct font-medium'
                                : 'bg-gray-100 text-text-secondary'
                            }`}
                          >
                            {String.fromCharCode(65 + i)}. {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <button
                        onClick={() => startEdit(q)}
                        className="p-1 text-text-secondary hover:text-primary"
                        title="编辑"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1 text-text-secondary hover:text-wrong"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
