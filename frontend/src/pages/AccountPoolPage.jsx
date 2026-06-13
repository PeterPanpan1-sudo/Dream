import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Database, Plus, Edit, Trash2, Search, X, Eye, EyeOff } from 'lucide-react'
import './AccountPoolPage.css'

const API_BASE = ''

function AccountPoolPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    session_token: '',
    access_token: '',
    status: 'active'
  })
  const [showTokens, setShowTokens] = useState({})
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAccounts(data)
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '获取账号列表失败' })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingAccount(null)
    setFormData({
      email: '',
      session_token: '',
      access_token: '',
      status: 'active'
    })
    setShowModal(true)
    setMessage(null)
  }

  const handleEdit = (account) => {
    setEditingAccount(account)
    setFormData({
      email: account.email,
      session_token: '',
      access_token: '',
      status: account.status
    })
    setShowModal(true)
    setMessage(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个账号吗？')) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setMessage({ type: 'success', text: '账号已删除' })
        fetchAccounts()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || '删除失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '网络错误' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)

    try {
      const token = localStorage.getItem('token')
      let res

      if (editingAccount) {
        // 编辑账号 - 只更新提供的字段
        const payload = { status: formData.status }
        if (formData.email && formData.email !== editingAccount.email) {
          payload.email = formData.email
        }
        if (formData.session_token) {
          payload.session_token = formData.session_token
        }
        if (formData.access_token) {
          payload.access_token = formData.access_token
        }

        res = await fetch(`${API_BASE}/api/admin/accounts/${editingAccount.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      } else {
        // 新建账号
        if (!formData.email || !formData.session_token) {
          setMessage({ type: 'error', text: '邮箱和 Session Token 不能为空' })
          return
        }
        res = await fetch(`${API_BASE}/api/admin/accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
      }

      if (res.ok) {
        setMessage({ type: 'success', text: editingAccount ? '账号已更新' : '账号已添加' })
        setShowModal(false)
        fetchAccounts()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || '操作失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '网络错误' })
    }
  }

  const toggleTokenVisibility = (id) => {
    setShowTokens(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredAccounts = accounts.filter(acc =>
    acc.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { label: '正常', class: 'active' },
      limited: { label: '受限', class: 'limited' },
      invalid: { label: '失效', class: 'invalid' }
    }
    const s = statusMap[status] || { label: status, class: '' }
    return <span className={`status-badge ${s.class}`}>{s.label}</span>
  }

  return (
    <div className="account-pool-page">
      <div className="page-header">
        <div className="header-left">
          <h2><Database size={32} /> 账号池管理</h2>
          <p className="page-subtitle">管理 ChatGPT 账号池</p>
        </div>
        <button className="add-btn" onClick={handleAdd}>
          <Plus size={18} /> 添加账号
        </button>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`message-banner ${message.type}`}
        >
          {message.text}
        </motion.div>
      )}

      <div className="search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="搜索邮箱..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>邮箱</th>
              <th>状态</th>
              <th>调用次数</th>
              <th>最后使用</th>
              <th>Session Token</th>
              <th>Access Token</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>加载中...</td></tr>
            ) : filteredAccounts.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>暂无数据</td></tr>
            ) : (
              filteredAccounts.map(acc => (
                <tr key={acc.id}>
                  <td>{acc.id}</td>
                  <td><span className="email">{acc.email}</span></td>
                  <td>{getStatusBadge(acc.status)}</td>
                  <td><span className="usage-count">{acc.usage_count || 0}</span></td>
                  <td>{acc.last_used_at ? new Date(acc.last_used_at).toLocaleString('zh-CN') : '-'}</td>
                  <td>
                    <div className="token-cell">
                      {acc.hasSessionToken ? (
                        <span className="token-status has">✓ 已配置</span>
                      ) : (
                        <span className="token-status missing">✗ 未配置</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="token-cell">
                      {acc.hasAccessToken ? (
                        <span className="token-status has">✓ 已配置</span>
                      ) : (
                        <span className="token-status missing">✗ 未配置</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="edit-btn" onClick={() => handleEdit(acc)} title="编辑">
                        <Edit size={14} />
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(acc.id)} title="删除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editingAccount ? '编辑账号' : '添加账号'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>邮箱 *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingAccount}
                  required={!editingAccount}
                />
              </div>
              <div className="form-group">
                <label>Session Token {editingAccount ? '(留空则不修改)' : '*'}</label>
                <textarea
                  rows="3"
                  value={formData.session_token}
                  onChange={(e) => setFormData({ ...formData, session_token: e.target.value })}
                  placeholder="粘贴 __Secure-next-auth.session-token"
                  required={!editingAccount}
                />
              </div>
              <div className="form-group">
                <label>Access Token (可选)</label>
                <textarea
                  rows="3"
                  value={formData.access_token}
                  onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                  placeholder="粘贴 Access Token"
                />
              </div>
              <div className="form-group">
                <label>状态</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  <option value="active">正常</option>
                  <option value="limited">受限</option>
                  <option value="invalid">失效</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="submit-btn">
                  {editingAccount ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default AccountPoolPage
