import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, Plus, Edit2, Trash2, Search, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import './AdminPage.css'

function AccountPoolPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [formData, setFormData] = useState({ email: '', password: '', type: 'free', quota: 0, access_token: '', refresh_token: '' })

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      if (editingAccount) {
        const response = await fetch(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (response.ok) {
          fetchAccounts()
          setShowModal(false)
        }
      } else {
        const response = await fetch('/api/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (response.ok) {
          fetchAccounts()
          setShowModal(false)
        }
      }
    } catch (error) {
      console.error('Failed to save account:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除该账号吗？')) return
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        fetchAccounts()
      }
    } catch (error) {
      console.error('Failed to delete account:', error)
    }
  }

  const handleToggleStatus = async (account) => {
    const newStatus = account.status === 'active' ? 'disabled' : 'active'
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (response.ok) {
        fetchAccounts()
      }
    } catch (error) {
      console.error('Failed to toggle status:', error)
    }
  }

  const filteredAccounts = accounts.filter(a =>
    a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="header-left">
          <div className="admin-title"><Database size={28} /> 账号池</div>
          <div className="admin-subtitle">管理 ChatGPT 账号池，配置生成额度</div>
        </div>
        <div className="header-actions">
          <button className="action-btn" onClick={fetchAccounts}><RefreshCw size={16} /> 刷新</button>
          <button className="action-btn primary" onClick={() => { setEditingAccount(null); setFormData({ email: '', password: '', type: 'free', quota: 0, access_token: '', refresh_token: '' }); setShowModal(true) }}>
            <Plus size={16} /> 新增账号
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总账号数</div>
          <div className="stat-value">{accounts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">活跃账号</div>
          <div className="stat-value">{accounts.filter(a => a.status === 'active').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Plus 账号</div>
          <div className="stat-value">{accounts.filter(a => a.type === 'plus').length}</div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input type="text" placeholder="搜索账号..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="toolbar-info">共 {filteredAccounts.length} 条记录</div>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : (
          <div className="data-table">
            <table>
              <thead>
                <tr><th>ID</th><th>邮箱</th><th>类型</th><th>额度</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {filteredAccounts.map(a => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td className="email-cell">{a.email}</td>
                    <td><span className={`type-badge ${a.type}`}>{a.type}</span></td>
                    <td className="quota-cell">{a.quota}</td>
                    <td><span className={`status-badge ${a.status}`}>{a.status}</span></td>
                    <td>
                      <div className="actions-cell">
                        <button className="icon-btn" onClick={() => handleToggleStatus(a)} title="切换状态">
                          {a.status === 'active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                        <button className="icon-btn" onClick={() => { setEditingAccount(a); setFormData({ ...a, password: '' }); setShowModal(true) }} title="编辑">
                          <Edit2 size={14} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDelete(a.id)} title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
            <motion.div className="modal-content" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
              <div className="modal-title">{editingAccount ? '编辑账号' : '新增账号'}</div>
              <form className="modal-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>邮箱</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>密码</label>
                  <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={editingAccount ? '留空表示不修改' : ''} />
                </div>
                <div className="form-group">
                  <label>类型</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                    <option value="free">免费</option>
                    <option value="plus">Plus</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>额度</label>
                  <input type="number" value={formData.quota} onChange={e => setFormData({ ...formData, quota: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Access Token</label>
                  <input type="text" value={formData.access_token} onChange={e => setFormData({ ...formData, access_token: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Refresh Token</label>
                  <input type="text" value={formData.refresh_token} onChange={e => setFormData({ ...formData, refresh_token: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                  <button type="submit" className="btn-primary">保存</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AccountPoolPage
