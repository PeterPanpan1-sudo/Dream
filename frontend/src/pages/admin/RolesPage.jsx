import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import './AdminPage.css'

const ALL_PERMISSIONS = [
  'users:read', 'users:write', 'users:delete',
  'accounts:read', 'accounts:write', 'accounts:delete',
  'roles:read', 'roles:write', 'roles:delete',
  'logs:read', 'settings:write', 'images:moderate'
]

function RolesPage() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [] })

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setRoles(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      if (editingRole) {
        const response = await fetch(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (response.ok) {
          fetchRoles()
          setShowModal(false)
        }
      } else {
        const response = await fetch('/api/roles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        })
        if (response.ok) {
          fetchRoles()
          setShowModal(false)
        }
      }
    } catch (error) {
      console.error('Failed to save role:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除该角色吗？')) return
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(`/api/roles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        fetchRoles()
      }
    } catch (error) {
      console.error('Failed to delete role:', error)
    }
  }

  const togglePermission = (perm) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }))
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="header-left">
          <div className="admin-title"><Shield size={28} /> 角色管理</div>
          <div className="admin-subtitle">管理系统角色和权限配置</div>
        </div>
        <div className="header-actions">
          <button className="action-btn" onClick={fetchRoles}><RefreshCw size={16} /> 刷新</button>
          <button className="action-btn primary" onClick={() => { setEditingRole(null); setFormData({ name: '', description: '', permissions: [] }); setShowModal(true) }}>
            <Plus size={16} /> 新增角色
          </button>
        </div>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <Shield size={48} />
            <p>暂无角色</p>
          </div>
        ) : (
          <div className="roles-grid">
            {roles.map(r => (
              <div key={r.id} className="role-card">
                <div className="role-header">
                  <div className="role-icon"><Shield size={24} /></div>
                  <div className="role-info">
                    <div className="role-name">{r.name}</div>
                    <div className="role-description">{r.description || '暂无描述'}</div>
                  </div>
                </div>
                <div className="role-permissions">
                  <div className="permissions-label">权限 ({Array.isArray(r.permissions) ? r.permissions.length : 0})</div>
                  <div className="permissions-tags">
                    {Array.isArray(r.permissions) && r.permissions.map(p => (
                      <span key={p} className="permission-tag">{p}</span>
                    ))}
                  </div>
                </div>
                <div className="role-actions">
                  <button className="role-btn" onClick={() => { setEditingRole(r); setFormData({ ...r, permissions: Array.isArray(r.permissions) ? [...r.permissions] : [] }); setShowModal(true) }}>
                    <Edit2 size={14} /> 编辑
                  </button>
                  <button className="role-btn danger" onClick={() => handleDelete(r.id)}>
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
                <div className="role-meta">ID: {r.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
            <motion.div className="modal-content large" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
              <div className="modal-title">{editingRole ? '编辑角色' : '新增角色'}</div>
              <form className="modal-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>角色名称</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>描述</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>权限</label>
                  <div className="permissions-checkboxes">
                    {ALL_PERMISSIONS.map(perm => (
                      <label key={perm} className="checkbox-label">
                        <input type="checkbox" checked={formData.permissions.includes(perm)} onChange={() => togglePermission(perm)} />
                        <span>{perm}</span>
                      </label>
                    ))}
                  </div>
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

export default RolesPage
