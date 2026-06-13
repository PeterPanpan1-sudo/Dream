import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Edit2, Trash2, Search, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import './AdminPage.css'

function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({ username: '', password: '', email: '', role: 'user', credits: 100 })
  const [allowRegistration, setAllowRegistration] = useState(true)
  const [regLoading, setRegLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchRegistrationSetting()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRegistrationSetting = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAllowRegistration(data.allow_registration === '1')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleRegistration = async () => {
    setRegLoading(true)
    try {
      const token = localStorage.getItem('token')
      const newValue = allowRegistration ? '0' : '1'
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'allow_registration', value: newValue })
      })
      if (res.ok) {
        setAllowRegistration(!allowRegistration)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setRegLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      if (editingUser) {
        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (response.ok) {
          fetchUsers()
          setShowModal(false)
        }
      } else {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (response.ok) {
          fetchUsers()
          setShowModal(false)
        }
      }
    } catch (error) {
      console.error('Failed to save user:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除该用户吗？')) return
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="header-left">
          <div className="admin-title"><Users size={28} /> 用户管理</div>
          <div className="admin-subtitle">管理系统用户，编辑权限和积分</div>
        </div>
        <div className="header-actions">
          <button className="action-btn" onClick={handleToggleRegistration} disabled={regLoading} title="切换注册开关">
            {allowRegistration ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            <span>{allowRegistration ? '注册已开启' : '注册已关闭'}</span>
          </button>
          <button className="action-btn" onClick={fetchUsers}><RefreshCw size={16} /> 刷新</button>
          <button className="action-btn primary" onClick={() => { setEditingUser(null); setFormData({ username: '', password: '', email: '', role: 'user', credits: 100 }); setShowModal(true) }}>
            <Plus size={16} /> 新增用户
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总用户数</div>
          <div className="stat-value">{users.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">管理员</div>
          <div className="stat-value">{users.filter(u => u.role === 'admin').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">活跃用户</div>
          <div className="stat-value">{users.filter(u => u.status === 'active').length}</div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input type="text" placeholder="搜索用户..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="toolbar-info">共 {filteredUsers.length} 条记录</div>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : (
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户名</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>积分</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td className="username-cell">{u.username}</td>
                    <td className="email-cell">{u.email || '-'}</td>
                    <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                    <td><span className={`status-badge ${u.status}`}>{u.status}</span></td>
                    <td className="quota-cell">{u.credits}</td>
                    <td>
                      <div className="actions-cell">
                        <button className="icon-btn" onClick={() => { setEditingUser(u); setFormData({ ...u, password: '' }); setShowModal(true) }} title="编辑">
                          <Edit2 size={14} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDelete(u.id)} title="删除">
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
              <div className="modal-title">{editingUser ? '编辑用户' : '新增用户'}</div>
              <form className="modal-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>用户名</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                </div>
                {!editingUser && (
                  <div className="form-group">
                    <label>密码</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                  </div>
                )}
                <div className="form-group">
                  <label>邮箱</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>角色</label>
                  <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                    <option value="user">用户</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>积分</label>
                  <input type="number" value={formData.credits} onChange={e => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })} />
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

export default UsersPage
