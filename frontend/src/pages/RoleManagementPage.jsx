import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, Plus, Edit, Trash2, X } from 'lucide-react'
import './RoleManagementPage.css'

const API_BASE = ''

// 所有可用的菜单项
const ALL_MENUS = [
  { id: 'home', label: '首页' },
  { id: 'create', label: '创作' },
  { id: 'gallery', label: '画廊' },
  { id: 'account', label: '我的' },
  { id: 'settings', label: '设置' },
  { id: 'admin-users', label: '用户管理' },
  { id: 'admin-accounts', label: '账号池' },
  { id: 'admin-roles', label: '角色管理' },
  { id: 'admin-logs', label: '日志管理' }
]

function RoleManagementPage() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    menus: []
  })
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setRoles(data)
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '获取角色列表失败' })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingRole(null)
    setFormData({
      name: '',
      description: '',
      menus: ['home', 'create', 'gallery', 'account', 'settings'] // 默认菜单
    })
    setShowModal(true)
    setMessage(null)
  }

  const handleEdit = (role) => {
    setEditingRole(role)
    const permissions = role.permissions ? JSON.parse(role.permissions) : []
    setFormData({
      name: role.name,
      description: role.description || '',
      menus: permissions
    })
    setShowModal(true)
    setMessage(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个角色吗？')) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin/roles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        alert('✅ 角色已删除')
        fetchRoles()
      } else {
        const err = await res.json()
        alert('❌ ' + (err.error || '删除失败'))
      }
    } catch (e) {
      alert('❌ 网络错误')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) {
      alert('角色名称不能为空')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const payload = {
        name: formData.name,
        description: formData.description,
        permissions: JSON.stringify(formData.menus)
      }

      let res
      if (editingRole) {
        res = await fetch(`${API_BASE}/api/admin/roles/${editingRole.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch(`${API_BASE}/api/admin/roles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      }

      if (res.ok) {
        alert(editingRole ? '✅ 角色已更新' : '✅ 角色已创建')
        setShowModal(false)
        fetchRoles()
      } else {
        const err = await res.json()
        alert('❌ ' + (err.error || '操作失败'))
      }
    } catch (e) {
      alert('❌ 网络错误')
    }
  }

  const toggleMenu = (menuId) => {
    setFormData(prev => ({
      ...prev,
      menus: prev.menus.includes(menuId)
        ? prev.menus.filter(m => m !== menuId)
        : [...prev.menus, menuId]
    }))
  }

  return (
    <div className="role-management-page">
      <div className="page-header">
        <div className="header-left">
          <h2><Shield size={32} /> 角色管理</h2>
          <p className="page-subtitle">管理角色和菜单权限</p>
        </div>
        <button className="add-btn" onClick={handleAdd}>
          <Plus size={18} /> 添加角色
        </button>
      </div>

      <div className="roles-grid">
        {loading ? (
          <div className="loading-text">加载中...</div>
        ) : roles.length === 0 ? (
          <div className="empty-text">暂无角色</div>
        ) : (
          roles.map(role => {
            const menus = role.permissions ? JSON.parse(role.permissions) : []
            return (
              <motion.div
                key={role.id}
                className="role-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="role-header">
                  <div className="role-icon">
                    <Shield size={24} />
                  </div>
                  <div className="role-info">
                    <h3 className="role-name">{role.name}</h3>
                    <p className="role-description">{role.description || '无描述'}</p>
                  </div>
                </div>
                <div className="role-menus">
                  <div className="menus-label">可见菜单：</div>
                  <div className="menu-tags">
                    {menus.length > 0 ? (
                      menus.map(menuId => {
                        const menu = ALL_MENUS.find(m => m.id === menuId)
                        return menu ? (
                          <span key={menuId} className="menu-tag">{menu.label}</span>
                        ) : null
                      })
                    ) : (
                      <span className="no-menus">无菜单权限</span>
                    )}
                  </div>
                </div>
                <div className="role-actions">
                  <button className="edit-btn" onClick={() => handleEdit(role)}>
                    <Edit size={16} /> 编辑
                  </button>
                  <button className="delete-btn" onClick={() => handleDelete(role.id)}>
                    <Trash2 size={16} /> 删除
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
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
              <h3>{editingRole ? '编辑角色' : '添加角色'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>角色名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：普通用户、VIP用户"
                  required
                />
              </div>
              <div className="form-group">
                <label>角色描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="角色的功能说明"
                />
              </div>
              <div className="form-group">
                <label>菜单权限 *</label>
                <div className="menu-checkboxes">
                  {ALL_MENUS.map(menu => (
                    <label key={menu.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.menus.includes(menu.id)}
                        onChange={() => toggleMenu(menu.id)}
                      />
                      <span>{menu.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="submit-btn">
                  {editingRole ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default RoleManagementPage
