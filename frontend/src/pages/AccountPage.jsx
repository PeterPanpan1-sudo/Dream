import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Key, Gift, UserPlus, Wallet, CalendarCheck, Settings } from 'lucide-react'
import './AccountPage.css'

const API_BASE = ''

function AccountPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkinMsg, setCheckinMsg] = useState(null)
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [showBindEmail, setShowBindEmail] = useState(false)
  const [bindEmail, setBindEmail] = useState('')
  const [bindCode, setBindCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [bindMsg, setBindMsg] = useState(null)

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckin = async () => {
    setCheckinLoading(true)
    setCheckinMsg(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/checkin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCheckinMsg({ type: 'success', text: `签到成功！获得 ${data.reward} 积分` })
        fetchUser()
      } else {
        const err = await res.json()
        setCheckinMsg({ type: 'error', text: err.error || '签到失败' })
      }
    } catch (e) {
      console.error(e)
      setCheckinMsg({ type: 'error', text: '网络错误' })
    } finally {
      setCheckinLoading(false)
    }
  }

  const handleSendBindCode = async () => {
    if (!bindEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindEmail)) {
      setBindMsg({ type: 'error', text: '请输入有效的邮箱地址' })
      return
    }
    setSendingCode(true)
    setBindMsg(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/auth/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: bindEmail })
      })
      if (res.ok) {
        setCountdown(60)
        setBindMsg({ type: 'success', text: '验证码已发送' })
      } else {
        const err = await res.json()
        setBindMsg({ type: 'error', text: err.error || '发送失败' })
      }
    } catch (e) {
      setBindMsg({ type: 'error', text: '网络错误' })
    } finally {
      setSendingCode(false)
    }
  }

  const handleBindEmail = async () => {
    if (!bindCode) {
      setBindMsg({ type: 'error', text: '请输入验证码' })
      return
    }
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/auth/bind-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: bindEmail, code: bindCode })
      })
      if (res.ok) {
        setBindMsg({ type: 'success', text: '邮箱绑定成功！' })
        fetchUser()
        setTimeout(() => setShowBindEmail(false), 2000)
      } else {
        const err = await res.json()
        setBindMsg({ type: 'error', text: err.error || '绑定失败' })
      }
    } catch (e) {
      setBindMsg({ type: 'error', text: '网络错误' })
    }
  }

  if (loading) return <div className="account-page"><p>加载中...</p></div>

  return (
    <div className="account-page">
      <div className="account-header">
        <h2>我的账户</h2>
        <p className="account-subtitle">管理你的账户信息和积分</p>
      </div>

      <div className="account-stats">
        <div className="stat-card">
          <div className="stat-label">剩余积分</div>
          <div className="stat-value">{user?.credits || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">生成次数</div>
          <div className="stat-value">{user?.generated_count || 0}</div>
        </div>
      </div>

      <div className="account-content">
        <div className="task-section">
          <div className="task-card">
            <div className="task-info">
              <div className="task-title">每日任务</div>
              <div className="task-heading">每日签到</div>
              <div className="task-description">每天签到可获得随机积分奖励，连续签到奖励更丰厚。</div>
            </div>
            {checkinMsg && (
              <div className={`checkin-message ${checkinMsg.type}`}>{checkinMsg.text}</div>
            )}
            <button
              className={`task-btn ${user?.can_checkin ? 'checkin-active' : 'checkin-disabled'} ${checkinLoading ? 'disabled' : ''}`}
              onClick={handleCheckin}
              disabled={checkinLoading || !user?.can_checkin}
            >
              <CalendarCheck size={16} /> {checkinLoading ? '签到中...' : user?.can_checkin ? '立即签到' : '今日已签到'}
            </button>
          </div>
          <div className="task-card">
            <div className="task-info">
              <div className="task-title">账户设置</div>
              <div className="task-heading">绑定邮箱</div>
              <div className="task-description">
                {user?.email ? `已绑定：${user.email}` : '绑定邮箱可获得额外积分奖励，并支持邮箱验证码登录。'}
              </div>
            </div>
            {!user?.email && !showBindEmail && (
              <button className="task-btn bind-btn" onClick={() => setShowBindEmail(true)}>
                <Key size={16} /> 立即绑定
              </button>
            )}
            {showBindEmail && (
              <div className="bind-email-form">
                <div className="form-row">
                  <input
                    type="email"
                    className="bind-input"
                    placeholder="输入邮箱地址"
                    value={bindEmail}
                    onChange={(e) => setBindEmail(e.target.value)}
                  />
                  <button
                    className="send-code-btn"
                    onClick={handleSendBindCode}
                    disabled={sendingCode || countdown > 0}
                  >
                    {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中' : '获取验证码'}
                  </button>
                </div>
                <div className="form-row">
                  <input
                    type="text"
                    className="bind-input"
                    placeholder="输入验证码"
                    value={bindCode}
                    onChange={(e) => setBindCode(e.target.value)}
                    maxLength={6}
                  />
                  <button className="confirm-btn" onClick={handleBindEmail}>
                    确认绑定
                  </button>
                </div>
                {bindMsg && (
                  <div className={`bind-message ${bindMsg.type}`}>{bindMsg.text}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="action-grid">
          <div className="action-card">
            <div className="action-icon"><Wallet size={24} /></div>
            <div className="action-content">
              <div className="action-title">积分充值</div>
              <div className="action-subtitle">购买更多积分以生成更多作品</div>
            </div>
          </div>
          <div className="action-card">
            <div className="action-icon"><UserPlus size={24} /></div>
            <div className="action-content">
              <div className="action-title">邀请好友</div>
              <div className="action-subtitle">邀请好友注册，双方均可获得积分</div>
            </div>
          </div>
          <div className="action-card">
            <div className="action-icon"><Gift size={24} /></div>
            <div className="action-content">
              <div className="action-title">兑换码</div>
              <div className="action-subtitle">输入兑换码获取积分奖励</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountPage
