import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, Moon, Sun, Save } from 'lucide-react'
import './SettingsPage.css'

const API_BASE = ''

function SettingsPage({ theme, onThemeChange }) {
  const [user, setUser] = useState(null)
  const [nickname, setNickname] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        setNickname(data.nickname || data.username)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      alert('昵称不能为空')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nickname: nickname.trim() })
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        alert('✅ 昵称修改成功')
      } else {
        const err = await res.json()
        alert('❌ ' + (err.error || '修改失败'))
      }
    } catch (e) {
      alert('❌ 网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('请填写所有密码字段')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的新密码不一致')
      return
    }
    if (newPassword.length < 6) {
      alert('新密码长度至少为6位')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      })
      if (res.ok) {
        alert('✅ 密码修改成功！即将退出登录...')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        // 2秒后自动退出登录
        setTimeout(() => {
          localStorage.removeItem('token')
          window.location.reload()
        }, 2000)
      } else {
        const err = await res.json()
        alert('❌ ' + (err.error || '修改失败'))
      }
    } catch (e) {
      alert('❌ 网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>设置</h2>
        <p className="settings-subtitle">管理你的账户设置和偏好</p>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="section-header">
            <User size={20} />
            <h3>个人资料</h3>
          </div>
          <div className="setting-item">
            <label className="setting-label">昵称</label>
            <div className="setting-input-group">
              <input
                type="text"
                className="setting-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入你的昵称"
              />
              <button
                className="save-btn"
                onClick={handleSaveNickname}
                disabled={loading}
              >
                <Save size={16} /> 保存
              </button>
            </div>
          </div>
          <div className="setting-item">
            <label className="setting-label">用户名</label>
            <input
              type="text"
              className="setting-input"
              value={user?.username || ''}
              disabled
            />
          </div>
          <div className="setting-item">
            <label className="setting-label">邮箱</label>
            <input
              type="text"
              className="setting-input"
              value={user?.email || '未绑定'}
              disabled
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Lock size={20} />
            <h3>修改密码</h3>
          </div>
          <div className="setting-item">
            <label className="setting-label">当前密码</label>
            <input
              type="password"
              className="setting-input"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="输入当前密码"
            />
          </div>
          <div className="setting-item">
            <label className="setting-label">新密码</label>
            <input
              type="password"
              className="setting-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码（至少6位）"
            />
          </div>
          <div className="setting-item">
            <label className="setting-label">确认新密码</label>
            <input
              type="password"
              className="setting-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
            />
          </div>
          <button
            className="change-password-btn"
            onClick={handleChangePassword}
            disabled={loading}
          >
            修改密码
          </button>
        </div>

        <div className="settings-section">
          <div className="section-header">
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            <h3>外观设置</h3>
          </div>
          <div className="setting-item">
            <label className="setting-label">主题模式</label>
            <div className="theme-switch-group">
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                <Sun size={18} /> 亮色模式
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                <Moon size={18} /> 暗色模式
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
