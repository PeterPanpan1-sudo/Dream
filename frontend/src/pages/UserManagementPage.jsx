import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Plus, Edit, Trash2, Search, X } from 'lucide-react'
import './UserManagementPage.css'

const API_BASE = ''

function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nickname: '',
    email: '',
    role: 'user',
    credits: 100
  })
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '获取用户列表失败' })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      password: '',
      nickname: '',
      email: '',
      role: 'user',
      credits: 100
    })
    setShowModal(true)
    setMessage(null)
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      password: '',
      nickname: user.nickname || '',
      email: user.email || '',
      role: user.role,
      credits: user.credits
    })
    setShowModal(true)
    setMessage(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个用户吗？此操作不可恢复。')) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setMessage({ type: 'success', text: '用户已删除' })
        fetchUsers()
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

      if (editingUser) {
        // 编辑用户
        const payload = {
          nickname: formData.nickname,
          email: formData.email,
          role: formData.role,
          credits: parseInt(formData.credits)
        }
        res = await fetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      } else {
        // 新建用户
        if (!formData.username || !formData.password) {
          setMessage({ type: 'error', text: '用户名和密码不能为空' })
          return
        }
        res = await fetch(`${API_BASE}/api/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
      }

      if (res.ok) {
        setMessage({ type: 'success', text: editingUser ? '用户已更新' : '用户已创建' })
        setShowModal(false)
        fetchUsers()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || '操作失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '网络错误' })
    }
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.nickname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="user-management-page">
      <div className="page-header">
        <div className="header-left">
          <h2><Users size={32} /> 用户管理</h2>
          <p className="page-subtitle">管理系统用户账号</p>
        </div>
        <button className="add-btn" onClick={handleAdd}>
          <Plus size={18} /> 添加用户
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
          placeholder="搜索用户名、昵称、邮箱..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>昵称</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>积分</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>加载中...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>暂无数据</td></tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td><span className="username">{user.username}</span></td>
                  <td>{user.nickname || '-'}</td>
                  <td>{user.email || '-'}</td>
                  <td><span className={`role-badge ${user.role}`}>{user.role === 'admin' ? '管理员' : '用户'}</span></td>
                  <td><span className="credits">{user.credits}</span></td>
                  <td>{new Date(user.created_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="edit-btn" onClick={() => handleEdit(user)} title="编辑">
                        <Edit size={14} />
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(user.id)} title="删除">
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
              <h3>{editingUser ? '编辑用户' : '添加用户'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>用户名 *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser}
                  required={!editingUser}
                />
              </div>
              {!editingUser && (
                <div className="form-group">
                  <label>密码 *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>昵称</label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>邮箱</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>角色</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                  <option value="user">用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div className="form-group">
                <label>积分</label>
                <input
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="submit-btn">
                  {editingUser ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default UserManagementPage
