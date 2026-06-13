import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import './LoginPage.css'

const API_BASE = 'http://localhost:8000'

function LoginPage({ onLogin, onEmailLogin, theme, onThemeChange }) {
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [loginType, setLoginType] = useState('password') // 'password' | 'email'
  const [forgotStep, setForgotStep] = useState(1)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const resetFields = () => {
    setError('')
    setUsername('')
    setPassword('')
    setEmail('')
    setCode('')
    setNewPassword('')
    setConfirmPassword('')
    setForgotStep(1)
  }

  const switchMode = (mode) => {
    setAuthMode(mode)
    resetFields()
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await onLogin(username, password)
    if (!result.success) {
      setError(result.error || '登录失败，请检查用户名和密码')
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await onEmailLogin(email, code)
    if (!result.success) {
      setError(result.error || '登录失败，请检查验证码')
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址')
      return
    }
    setError('')
    setSendingCode(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await response.json()
      if (response.ok) {
        setCountdown(60)
      } else {
        setError(data.error || '发送失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyForgot = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-code-only`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      })
      if (response.ok) {
        setForgotStep(2)
      } else {
        const data = await response.json()
        setError(data.error || '验证码无效')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setError('密码长度至少为6位')
      return
    }
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      })
      const data = await response.json()
      if (response.ok) {
        alert('密码重置成功，请使用新密码登录')
        switchMode('login')
        setLoginType('password')
      } else {
        setError(data.error || '重置失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const headerMap = {
    login: { label: 'SIGN IN', title: '欢迎回来', subtitle: '回到你的创作空间，继续解锁灵感。作品与帐用记录。' },
    register: { label: 'SIGN UP', title: '创建账号', subtitle: '加入我们，开启你的创作之旅。' },
    forgot: { label: 'RESET', title: '重置密码', subtitle: '验证身份后，设置你的新密码。' }
  }
  const hc = headerMap[authMode]

  const renderEmailForm = (btnText) => (
    <form onSubmit={handleEmailSubmit} className="login-form">
      <div className="form-group">
        <input
          type="email"
          className="form-input"
          placeholder="请输入邮箱地址"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="form-group">
        <div className="input-with-btn">
          <input
            type="text"
            className="form-input"
            placeholder="请输入6位验证码"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            required
          />
          <button
            type="button"
            className="send-code-btn"
            onClick={handleSendCode}
            disabled={sendingCode || countdown > 0}
          >
            {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码'}
          </button>
        </div>
      </div>
      <motion.button
        type="submit"
        className="login-btn"
        disabled={loading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {loading ? '处理中...' : btnText}
      </motion.button>
    </form>
  )

  return (
    <div className={`login-page ${theme}`}>
      <button className="theme-toggle-btn" onClick={onThemeChange}>
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="login-container"
      >
        <div className="login-card">
          <div className="login-header">
            <div className="sign-in-label">{hc.label}</div>
            <h1 className="login-title">{hc.title}</h1>
            <p className="login-subtitle">{hc.subtitle}</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="error-message"
            >
              {error}
            </motion.div>
          )}

          {authMode === 'login' && (
            <div className="login-mode-switch">
              <p className="mode-hint">尚未拥有账号，请直接新登录</p>
              <div className="mode-tabs">
                <button
                  className={`mode-tab ${loginType === 'password' ? 'active' : ''}`}
                  onClick={() => { setLoginType('password'); setError('') }}
                >
                  密码登录
                </button>
                <button
                  className={`mode-tab-link ${loginType === 'email' ? 'active' : ''}`}
                  onClick={() => { setLoginType('email'); setError('') }}
                >
                  邮箱验证码
                </button>
              </div>
            </div>
          )}

          {authMode === 'login' && loginType === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="login-form">
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="邮箱 / 手机号 / 用户名"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  className="form-input"
                  placeholder="密码"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>记住我</span>
                </label>
                <button type="button" className="forgot-password" onClick={() => switchMode('forgot')}>
                  忘记密码?
                </button>
              </div>

              <motion.button
                type="submit"
                className="login-btn"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? '登录中...' : '登录'}
              </motion.button>
            </form>
          )}

          {authMode === 'login' && loginType === 'email' && renderEmailForm('登录')}

          {authMode === 'register' && renderEmailForm('注册')}

          {authMode === 'forgot' && forgotStep === 1 && (
            <form onSubmit={handleVerifyForgot} className="login-form">
              <div className="form-group">
                <input
                  type="email"
                  className="form-input"
                  placeholder="请输入邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <div className="input-with-btn">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="请输入6位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="send-code-btn"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0}
                  >
                    {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码'}
                  </button>
                </div>
              </div>
              <motion.button
                type="submit"
                className="login-btn"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? '验证中...' : '验证邮箱'}
              </motion.button>
              <button type="button" className="back-to-login" onClick={() => switchMode('login')}>
                返回登录
              </button>
            </form>
          )}

          {authMode === 'forgot' && forgotStep === 2 && (
            <form onSubmit={handleResetPassword} className="login-form">
              <div className="form-group">
                <input
                  type="password"
                  className="form-input"
                  placeholder="请输入新密码"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  className="form-input"
                  placeholder="请再次输入新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <motion.button
                type="submit"
                className="login-btn"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? '处理中...' : '重置密码'}
              </motion.button>
            </form>
          )}

          {authMode === 'login' && (
            <div className="login-footer">
              <p className="register-hint">
                还没有账号？<button type="button" className="register-link" onClick={() => switchMode('register')}>立即注册</button>
              </p>
              <p className="login-hint">
                登录后同时绑定你统筹续订账阅和帐面信
              </p>
            </div>
          )}

          {(authMode === 'register' || authMode === 'forgot') && (
            <div className="login-footer">
              <p className="register-hint">
                已有账号？<button type="button" className="register-link" onClick={() => switchMode('login')}>立即登录</button>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage
