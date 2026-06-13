import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Sparkles, Image as ImageIcon, User, Settings, Moon, Sun, LogOut, ChevronLeft, ChevronRight, Users, Database, Shield, FileText } from 'lucide-react'
import HomePage from './pages/HomePage'
import CreatePage from './pages/CreatePage'
import GalleryPage from './pages/GalleryPage'
import AccountPage from './pages/AccountPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import UserManagementPage from './pages/UserManagementPage'
import AccountPoolPage from './pages/AccountPoolPage'
import RoleManagementPage from './pages/RoleManagementPage'
import LogsPage from './pages/admin/LogsPage'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
const [user, setUser] = useState(null)
const [loading, setLoading] = useState(true)
useEffect(() => {
    const token = localStorage.getItem('token')
if (token) {
      fetchUserInfo(token)
    } else {
      setLoading(false)
    }
  }, [])

useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])
const fetchUserInfo = async (token) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
if (response.ok) {
        const data = await response.json()
        setUser(data)
      } else {
        localStorage.removeItem('token')
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }
const handleLogin = async (username, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
if (response.ok) {
        const data = await response.json()
        localStorage.setItem('token', data.token)
        setUser(data.user)
        setCurrentPage('home')
return { success: true }
      }
const error = await response.json()
return { success: false, error: error.error || '登录失败' }
    } catch (err) {
      return { success: false, error: '网络错误' }
    }
  }
const handleEmailLogin = async (email, code) => {
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      })
if (response.ok) {
        const data = await response.json()
        localStorage.setItem('token', data.token)
        setUser(data.user)
if (data.isNewUser) {
          alert('注册成功！欢迎使用')
        }
        setCurrentPage('home')
return { success: true }
      }
const error = await response.json()
return { success: false, error: error.error || '登录失败' }
    } catch (err) {
      return { success: false, error: '网络错误' }
    }
  }
const handleLogout = () => {
    const token = localStorage.getItem('token')
if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
    }
    localStorage.removeItem('token')
    setUser(null)
    setCurrentPage('home')
  }
const toggleTheme = (newTheme) => {
    if (newTheme) {
      console.log('Setting theme to:', newTheme)
      setTheme(newTheme)
    } else {
      const nextTheme = theme === 'dark' ? 'light' : 'dark'
      console.log('Toggling theme from', theme, 'to', nextTheme)
      setTheme(nextTheme)
    }
  }
const pages = {
    home: <HomePage user={user} theme={theme} onNavigate={setCurrentPage} />,
    create: <CreatePage />,
    gallery: <GalleryPage user={user} theme={theme} />,
    account: <AccountPage user={user} theme={theme} />,
    settings: <SettingsPage user={user} theme={theme} onThemeChange={toggleTheme} />,
    'admin-users': <UserManagementPage />,
    'admin-accounts': <AccountPoolPage />,
    'admin-roles': <RoleManagementPage />,
    'admin-logs': <LogsPage />
  }
const menuItems = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'create', label: '创作', icon: Sparkles },
    { id: 'gallery', label: '画廊', icon: ImageIcon },
    { id: 'account', label: '我的', icon: User },
    { id: 'settings', label: '设置', icon: Settings },
  ]

  const adminMenuItems = [
    { id: 'admin-users', label: '用户管理', icon: Users },
    { id: 'admin-accounts', label: '账号池', icon: Database },
    { id: 'admin-roles', label: '角色管理', icon: Shield },
    { id: 'admin-logs', label: '日志', icon: FileText },
  ]

  // 根据用户权限过滤菜单
  const userPermissions = user?.permissions || []
  const visibleMenuItems = [...menuItems, ...adminMenuItems].filter(item =>
    userPermissions.includes(item.id)
  )

  // 分组：基础菜单和管理菜单
  const visibleBasicMenus = visibleMenuItems.filter(item => !item.id.startsWith('admin-'))
  const visibleAdminMenus = visibleMenuItems.filter(item => item.id.startsWith('admin-'))

  if (loading) {
    return (
      <div className={`app ${theme}`}>
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    )
  }
return (
    <div className={`app ${theme}`}>
      {!user ? (
        <LoginPage onLogin={handleLogin} onEmailLogin={handleEmailLogin} theme={theme} onThemeChange={toggleTheme} />
      ) : (
        <>
          <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
              <div className="logo">
                <Sparkles size={24} />
                <span className="logo-text">白日梦</span>
              </div>
              <button className="collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>
            <nav className="sidebar-nav">
              {visibleBasicMenus.map(item => (
                <button
                  key={item.id}
                  className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => setCurrentPage(item.id)}
                >
                  <item.icon size={20} />
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
              {visibleAdminMenus.length > 0 && (
                <>
                  <div className="nav-divider"></div>
                  {visibleAdminMenus.map(item => (
                    <button
                      key={item.id}
                      className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                      onClick={() => setCurrentPage(item.id)}
                    >
                      <item.icon size={20} />
                      <span className="nav-label">{item.label}</span>
                    </button>
                  ))}
                </>
              )}
            </nav>
            <div className="sidebar-footer">
              <button className="theme-toggle" onClick={() => toggleTheme()}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                <span>{theme === 'dark' ? '亮色模式' : '暗色模式'}</span>
              </button>
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={18} />
                <span>退出登录</span>
              </button>
              <div className="user-info">
                <div className="user-avatar">
                  <User size={16} />
                </div>
                <div className="user-details">
                  <span className="user-name">{user?.nickname || user?.username}</span>
                  <span className="user-role">{user?.role === 'admin' ? '管理员' : '用户'}</span>
                </div>
              </div>
            </div>
          </aside>
          <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="page-content"
              >
                {pages[currentPage]}
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      )}
    </div>
  )
}
export default App
