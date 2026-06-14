import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, ExternalLink, Inbox, KeyRound, MailPlus, Play, RefreshCw, Save, Settings2, Square, Trash2, UserPlus } from 'lucide-react'
import './RegistrarPage.css'

const API_BASE = ''

const FIRST_NAMES = ['James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Charles','Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Joshua','Kenneth','Kevin','Brian','George','Edward','Mary','Patricia','Jennifer','Linda','Elizabeth','Barbara','Susan','Jessica','Sarah','Karen','Nancy','Lisa','Betty','Margaret','Sandra','Ashley','Kimberly','Emily','Donna','Michelle','Dorothy','Carol','Amanda','Melissa','Deborah']
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts']

function RegistrarPage() {
  const [config, setConfig] = useState(null)
  const [mailboxes, setMailboxes] = useState([])
  const [selectedMailbox, setSelectedMailbox] = useState(null)
  const [mails, setMails] = useState([])
  const [signals, setSignals] = useState({ code: '', link: '' })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addressForm, setAddressForm] = useState({
    name: '',
    domain: 'edu.peterlinux.com',
    enablePrefix: true
  })
  const [accountForm, setAccountForm] = useState({
    session_token: '',
    access_token: '',
    status: 'active'
  })
  const [randomIdentity, setRandomIdentity] = useState({ name: '', age: '' })

  // Auto register state
  const [activeTab, setActiveTab] = useState('manual')
  const [autoConfig, setAutoConfig] = useState(null)
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoLogs, setAutoLogs] = useState([])
  const [autoStats, setAutoStats] = useState({ success: 0, fail: 0, done: 0, running: 0, threads: 1, elapsed_seconds: 0, avg_seconds: 0, success_rate: 0 })
  const [autoForm, setAutoForm] = useState({
    total: 10,
    threads: 1,
    proxy: '',
    waitTimeout: 60,
    waitInterval: 3,
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (config?.domain) {
      setAddressForm(prev => ({ ...prev, domain: prev.domain || config.domain }))
    }
  }, [config])

  const selectedSignals = useMemo(() => ({
    code: signals.code || selectedMailbox?.verification_code || '',
    link: signals.link || selectedMailbox?.verification_link || ''
  }), [signals, selectedMailbox])

  const authHeaders = (json = false) => {
    const token = localStorage.getItem('token')
    return {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`
    }
  }

  const parseError = async (res, fallback) => {
    try {
      const data = await res.json()
      return data.error || data.message || fallback
    } catch {
      return fallback
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    window.clearTimeout(showMessage.timer)
    showMessage.timer = window.setTimeout(() => setMessage(null), 4500)
  }

  const loadInitialData = async () => {
    setLoading(true)
    await Promise.all([fetchConfig(), fetchMailboxes()])
    setLoading(false)
  }

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/registrar/config`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error(await parseError(res, '读取注册机配置失败'))
      const data = await res.json()
      setConfig(data)
      setAddressForm(prev => ({
        ...prev,
        domain: prev.domain || data.domain || 'edu.peterlinux.com',
        enablePrefix: data.enablePrefix ?? true
      }))
    } catch (err) {
      showMessage('error', err.message || '读取注册机配置失败')
    }
  }

  const fetchMailboxes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/registrar/mailboxes`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error(await parseError(res, '读取邮箱列表失败'))
      const data = await res.json()
      const items = data.items || []
      setMailboxes(items)
      setSelectedMailbox(prev => {
        if (!prev) return items[0] || null
        return items.find(item => item.id === prev.id) || prev
      })
    } catch (err) {
      showMessage('error', err.message || '读取邮箱列表失败')
    }
  }

  const createMailbox = async (e) => {
    e.preventDefault()
    setCreating(true)
    setMails([])
    setSignals({ code: '', link: '' })
    try {
      const payload = {
        name: addressForm.name,
        domain: addressForm.domain,
        enablePrefix: addressForm.enablePrefix
      }
      const res = await fetch(`${API_BASE}/api/admin/registrar/address`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(await parseError(res, '创建临时邮箱失败'))
      const data = await res.json()
      setSelectedMailbox(data.mailbox)
      setAddressForm(prev => ({ ...prev, name: '' }))
      showMessage('success', `临时邮箱已创建：${data.mailbox.email}`)
      await fetchMailboxes()
    } catch (err) {
      showMessage('error', err.message || '创建临时邮箱失败')
    } finally {
      setCreating(false)
    }
  }

  const selectMailbox = (mailbox) => {
    setSelectedMailbox(mailbox)
    setSignals({ code: mailbox.verification_code || '', link: mailbox.verification_link || '' })
    setMails([])
  }

  const refreshMails = async (mailbox = selectedMailbox) => {
    if (!mailbox) {
      showMessage('error', '请先选择一个临时邮箱')
      return
    }
    setRefreshing(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/registrar/mails?mailboxId=${encodeURIComponent(mailbox.id)}&limit=20&offset=0`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error(await parseError(res, '读取收件箱失败'))
      const data = await res.json()
      setMails(data.items || [])
      setSignals(data.signals || { code: '', link: '' })
      setSelectedMailbox(data.mailbox || mailbox)
      await fetchMailboxes()
      if (data.signals?.code || data.signals?.link) {
        showMessage('success', '已从邮件中提取到验证信息')
      } else {
        showMessage('success', `已刷新收件箱，共 ${data.items?.length || 0} 封邮件`)
      }
    } catch (err) {
      showMessage('error', err.message || '读取收件箱失败')
    } finally {
      setRefreshing(false)
    }
  }

  const extractCode = async () => {
    if (!selectedMailbox) {
      showMessage('error', '请先选择一个临时邮箱')
      return
    }
    setRefreshing(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/registrar/extract-code`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ mailboxId: selectedMailbox.id, limit: 20 })
      })
      if (!res.ok) throw new Error(await parseError(res, '提取验证码失败'))
      const data = await res.json()
      setMails(data.items || [])
      setSignals(data.signals || { code: '', link: '' })
      setSelectedMailbox(data.mailbox || selectedMailbox)
      await fetchMailboxes()
      showMessage(data.success ? 'success' : 'error', data.success ? '验证码/验证链接已提取' : '暂未找到验证码或验证链接')
    } catch (err) {
      showMessage('error', err.message || '提取验证码失败')
    } finally {
      setRefreshing(false)
    }
  }

  const saveAccount = async (e) => {
    e.preventDefault()
    if (!selectedMailbox) {
      showMessage('error', '请先选择一个临时邮箱')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/registrar/save-account`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          email: selectedMailbox.email,
          session_token: accountForm.session_token,
          access_token: accountForm.access_token,
          status: accountForm.status
        })
      })
      if (!res.ok) throw new Error(await parseError(res, '保存账号池失败'))
      const data = await res.json()
      showMessage('success', data.updated ? '账号池记录已更新' : '账号已加入账号池')
      setAccountForm({ session_token: '', access_token: '', status: 'active' })
    } catch (err) {
      showMessage('error', err.message || '保存账号池失败')
    } finally {
      setSaving(false)
    }
  }

  const deleteMailbox = async (mailbox) => {
    if (!mailbox || !confirm(`确定删除本地邮箱记录 ${mailbox.email} 吗？Cloudflare 端地址不会被删除。`)) return
    try {
      const res = await fetch(`${API_BASE}/api/admin/registrar/mailboxes/${mailbox.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      if (!res.ok) throw new Error(await parseError(res, '删除邮箱记录失败'))
      showMessage('success', '本地邮箱记录已删除')
      setSelectedMailbox(prev => prev?.id === mailbox.id ? null : prev)
      setMails([])
      setSignals({ code: '', link: '' })
      await fetchMailboxes()
    } catch (err) {
      showMessage('error', err.message || '删除邮箱记录失败')
    }
  }

  const copyText = async (text, label = '内容') => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      console.log(`✅ 复制成功: ${label}`)
      showMessage('success', `${label}已复制到剪贴板`)
    } catch (err) {
      console.error('复制失败:', err)
      showMessage('error', '复制失败，请手动复制')
    }
  }

  const genRandomMailboxName = () => {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const birthYear = Math.floor(Math.random() * 31) + 1975
    const year2 = String(birthYear).slice(-2)
    const formats = [
      `${first.toLowerCase()}.${last.toLowerCase()}${year2}`,
      `${first[0].toLowerCase()}.${last.toLowerCase()}${year2}`,
      `${first.toLowerCase()}_${last.toLowerCase()}_${year2}`,
      `${first[0].toLowerCase()}${last.toLowerCase()}${birthYear}`,
      `${last.toLowerCase()}.${first.toLowerCase()}${year2}`,
    ]
    const prefix = formats[Math.floor(Math.random() * formats.length)]
    setAddressForm(prev => ({ ...prev, name: prefix }))
    const age = new Date().getFullYear() - birthYear
    setRandomIdentity({ name: `${first} ${last}`, age })
  }

  const genRandomIdentity = () => {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const age = Math.floor(Math.random() * 48) + 18
    setRandomIdentity({ name: `${first} ${last}`, age })
  }

  // ---------- Auto register logic ----------
  const fetchAutoConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auto-register`, { headers: authHeaders() })
      if (!res.ok) throw new Error(await parseError(res, '读取自动注册配置失败'))
      const data = await res.json()
      setAutoConfig(data)
      setAutoStats(data.stats || autoStats)
      setAutoLogs(data.logs || [])
      setAutoForm({
        total: data.total ?? 10,
        threads: data.threads ?? 1,
        proxy: data.proxy ?? '',
        waitTimeout: data.waitTimeout ?? 60,
        waitInterval: data.waitInterval ?? 3,
      })
    } catch (err) {
      showMessage('error', err.message || '读取自动注册配置失败')
    }
  }

  const saveAutoConfig = async () => {
    setAutoLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auto-register`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(autoForm),
      })
      if (!res.ok) throw new Error(await parseError(res, '保存配置失败'))
      const data = await res.json()
      setAutoConfig(data)
      setAutoStats(data.stats || autoStats)
      showMessage('success', '配置已保存')
    } catch (err) {
      showMessage('error', err.message || '保存配置失败')
    } finally {
      setAutoLoading(false)
    }
  }

  const toggleAuto = async () => {
    setAutoLoading(true)
    try {
      const action = autoConfig?.enabled ? 'stop' : 'start'
      const res = await fetch(`${API_BASE}/api/auto-register/${action}`, {
        method: 'POST',
        headers: authHeaders(true),
      })
      if (!res.ok) throw new Error(await parseError(res, '操作失败'))
      const data = await res.json()
      setAutoConfig(data)
      setAutoStats(data.stats || autoStats)
      setAutoLogs(data.logs || [])
      showMessage('success', action === 'start' ? '自动注册已启动' : '自动注册已停止')
    } catch (err) {
      showMessage('error', err.message || '操作失败')
    } finally {
      setAutoLoading(false)
    }
  }

  const resetAuto = async () => {
    setAutoLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auto-register/reset`, {
        method: 'POST',
        headers: authHeaders(true),
      })
      if (!res.ok) throw new Error(await parseError(res, '重置失败'))
      const data = await res.json()
      setAutoConfig(data)
      setAutoStats(data.stats || autoStats)
      setAutoLogs(data.logs || [])
      showMessage('success', '已重置')
    } catch (err) {
      showMessage('error', err.message || '重置失败')
    } finally {
      setAutoLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'auto') return
    fetchAutoConfig()
    let eventSource = null
    const token = localStorage.getItem('token')
    if (token) {
      eventSource = new EventSource(`${API_BASE}/api/auto-register/events?token=${token}`, { withCredentials: false })
      eventSource.onopen = () => {
        console.log('[SSE] auto-register events connected')
      }
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setAutoConfig(data)
          setAutoStats(data.stats || autoStats)
          setAutoLogs(data.logs || [])
        } catch {}
      }
      eventSource.onerror = (err) => {
        console.error('[SSE] auto-register events error', err)
      }
    }
    return () => { if (eventSource) eventSource.close() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  return (
    <div className="registrar-page">
      <div className="registrar-header">
        <div>
          <h2><UserPlus size={32} /> ChatGPT 注册机</h2>
          <p>使用 Cloudflare 临时域名邮箱创建 <span>edu.peterlinux.com</span> 注册邮箱，自动读取验证邮件并辅助加入账号池。</p>
        </div>
        <button className="registrar-refresh-btn" onClick={loadInitialData} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinning' : ''} /> 刷新
        </button>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          transition={{ duration: 0.25 }}
          className={`registrar-message ${message.type}`}
        >
          {message.text}
        </motion.div>
      )}

      <div className="registrar-config-grid">
        <div className="registrar-config-card">
          <span>邮箱域名</span>
          <strong>{config?.domain || 'edu.peterlinux.com'}</strong>
        </div>
        <div className="registrar-config-card">
          <span>Worker 地址</span>
          <strong className={config?.workerUrlConfigured ? 'ok' : 'missing'}>{config?.workerUrlConfigured ? '已配置' : '未配置'}</strong>
        </div>
        <div className="registrar-config-card">
          <span>Admin Auth</span>
          <strong className={config?.adminAuthConfigured ? 'ok' : 'missing'}>{config?.adminAuthMasked || '未配置'}</strong>
        </div>
        <div className="registrar-config-card">
          <span>地址前缀</span>
          <strong>{config?.enablePrefix ? '启用' : '关闭'}</strong>
        </div>
      </div>

      {config && !config.configured && (
        <div className="registrar-warning">
          后端临时邮箱配置未完整设置。请在后端环境变量中配置 <code>TEMP_MAIL_WORKER_URL</code> 和 <code>TEMP_MAIL_ADMIN_AUTH</code>，并保持 <code>TEMP_MAIL_DOMAIN=edu.peterlinux.com</code>。
        </div>
      )}

      <div className="registrar-tabs">
        <button className={`registrar-tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>
          <Settings2 size={16} /> 手动注册
        </button>
        <button className={`registrar-tab ${activeTab === 'auto' ? 'active' : ''}`} onClick={() => setActiveTab('auto')}>
          <Play size={16} /> 自动注册
        </button>
      </div>

      {activeTab === 'manual' && (
        <div className="registrar-layout">
          <section className="registrar-panel registrar-create-panel">
            <div className="panel-title">
              <MailPlus size={22} />
              <div>
                <h3>创建临时邮箱</h3>
                <p>留空会自动生成随机邮箱名前缀。</p>
              </div>
            </div>

            <form className="registrar-form" onSubmit={createMailbox}>
              <label>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>邮箱名称</span>
                  <button type="button" className="registrar-icon-btn" onClick={genRandomMailboxName} style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                    <RefreshCw size={14} /> <span>随机生成</span>
                  </button>
                </span>
                <input
                  value={addressForm.name}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如 dd-research-001"
                />
              </label>
              <label>
                邮箱域名
                <input
                  value={addressForm.domain}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder="edu.peterlinux.com"
                />
              </label>
              <label className="registrar-checkbox">
                <input
                  type="checkbox"
                  checked={addressForm.enablePrefix}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, enablePrefix: e.target.checked }))}
                />
                <span>启用 Worker 地址前缀策略</span>
              </label>
              <button className="registrar-primary-btn" type="submit" disabled={creating || !config?.configured}>
                {creating ? <RefreshCw size={18} className="spinning" /> : <MailPlus size={18} />}
                {creating ? '创建中...' : '创建邮箱'}
              </button>
            </form>

            <div className="registrar-workflow">
              <h4>注册流程</h4>
              <ol>
                <li>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    打开 <b>chatgpt.com</b> 开始注册
                    <button type="button" className="registrar-icon-btn" onClick={() => copyText('https://chatgpt.com', '网址')} style={{ padding: '4px 8px', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <Copy size={14} /> <span>复制网址</span>
                    </button>
                  </span>
                </li>
                <li>创建 <b>@edu.peterlinux.com</b> 临时邮箱。</li>
                <li>用该邮箱在 ChatGPT/OpenAI 注册并触发验证邮件。</li>
                <li>刷新收件箱，复制验证码或打开验证链接。</li>
                <li>注册完成后粘贴 <b>session_token</b>，保存到账号池。</li>
              </ol>
            </div>

            <div className="registrar-workflow" style={{ marginTop: 12 }}>
              <h4>随机身份信息</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div className="signal-card" style={{ flex: 1, minWidth: 120, padding: 12, cursor: 'pointer' }} onClick={() => copyText(randomIdentity.name, '名字')}>
                  <span>名字</span>
                  <strong style={{ fontSize: 18 }}>{randomIdentity.name || '-'}</strong>
                </div>
                <div className="signal-card" style={{ flex: 1, minWidth: 60, padding: 12, cursor: 'pointer' }} onClick={() => copyText(String(randomIdentity.age), '年龄')}>
                  <span>年龄</span>
                  <strong style={{ fontSize: 18 }}>{randomIdentity.age || '-'}</strong>
                </div>
                <button type="button" className="registrar-secondary-btn" onClick={genRandomIdentity} style={{ whiteSpace: 'nowrap', padding: '8px 16px' }}>
                  <RefreshCw size={16} /> <span>随机生成</span>
                </button>
              </div>
            </div>

            <div className="registrar-mailbox-list">
              <div className="list-title">
                <h3>最近邮箱</h3>
                <span>{mailboxes.length}</span>
              </div>
              {mailboxes.length === 0 ? (
                <div className="registrar-empty">暂无邮箱记录</div>
              ) : mailboxes.map(mailbox => (
                <button
                  type="button"
                  key={mailbox.id}
                  className={`mailbox-item ${selectedMailbox?.id === mailbox.id ? 'active' : ''}`}
                  onClick={() => selectMailbox(mailbox)}
                >
                  <span>{mailbox.email}</span>
                  <small>{mailbox.created_at ? new Date(mailbox.created_at).toLocaleString('zh-CN') : '-'}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="registrar-panel registrar-inbox-panel">
            <div className="panel-title with-actions">
              <div className="panel-title-main">
                <Inbox size={22} />
                <div>
                  <h3>收件箱与验证信息</h3>
                  <p>{selectedMailbox ? selectedMailbox.email : '请选择或创建一个临时邮箱'}</p>
                </div>
              </div>
              {selectedMailbox && (
                <button className="registrar-icon-btn danger" onClick={() => deleteMailbox(selectedMailbox)} title="删除本地记录">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {selectedMailbox ? (
              <>
                <div className="selected-mailbox-card">
                  <div>
                    <span>当前邮箱</span>
                    <strong>{selectedMailbox.email}</strong>
                  </div>
                  <button onClick={() => copyText(selectedMailbox.email, '邮箱地址')}>
                    <Copy size={16} /> 复制
                  </button>
                </div>

                <div className="registrar-signal-grid">
                  <div className="signal-card">
                    <span>验证码</span>
                    <strong>{selectedSignals.code || '等待邮件'}</strong>
                    <button onClick={() => copyText(selectedSignals.code, '验证码')} disabled={!selectedSignals.code}>
                      <Copy size={14} /> 复制验证码
                    </button>
                  </div>
                  <div className="signal-card link-card">
                    <span>验证链接</span>
                    <strong>{selectedSignals.link ? '已提取' : '等待邮件'}</strong>
                    <div className="signal-actions">
                      <button onClick={() => copyText(selectedSignals.link, '验证链接')} disabled={!selectedSignals.link}>
                        <Copy size={14} /> 复制链接
                      </button>
                      {selectedSignals.link && <a href={selectedSignals.link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 打开</a>}
                    </div>
                  </div>
                </div>

                <div className="registrar-actions-row">
                  <button className="registrar-secondary-btn" onClick={() => refreshMails()} disabled={refreshing}>
                    <RefreshCw size={17} className={refreshing ? 'spinning' : ''} /> 刷新收件箱
                  </button>
                  <button className="registrar-secondary-btn" onClick={extractCode} disabled={refreshing}>
                    <KeyRound size={17} /> 提取验证码
                  </button>
                </div>

                <form className="registrar-account-form" onSubmit={saveAccount}>
                  <div className="panel-title compact">
                    <Save size={20} />
                    <div>
                      <h3>加入 ChatGPT 账号池</h3>
                      <p>注册完成并登录后，粘贴从浏览器获取的 Token。</p>
                    </div>
                  </div>
                  <label>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Session Token</span>
                      <button type="button" className="registrar-icon-btn" onClick={() => copyText('https://chatgpt.com/api/auth/session', 'Token 获取网址')} style={{ padding: '4px 8px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        <Copy size={14} /> <span>复制获取网址</span>
                      </button>
                    </span>
                    <textarea
                      value={accountForm.session_token}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, session_token: e.target.value }))}
                      placeholder="必填，新账号加入账号池需要 session_token"
                      rows={4}
                    />
                  </label>
                  <label>
                    Access Token（可选）
                    <textarea
                      value={accountForm.access_token}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, access_token: e.target.value }))}
                      placeholder="可选，留空也可以后续由链路刷新/补充"
                      rows={3}
                    />
                  </label>
                  <label>
                    状态
                    <select value={accountForm.status} onChange={(e) => setAccountForm(prev => ({ ...prev, status: e.target.value }))}>
                      <option value="active">正常</option>
                      <option value="limited">受限</option>
                      <option value="invalid">失效</option>
                    </select>
                  </label>
                  <button className="registrar-primary-btn" type="submit" disabled={saving}>
                    {saving ? <RefreshCw size={18} className="spinning" /> : <Save size={18} />}
                    {saving ? '保存中...' : '保存到账号池'}
                  </button>
                </form>

                <div className="mail-list">
                  <div className="list-title">
                    <h3>邮件列表</h3>
                    <span>{mails.length}</span>
                  </div>
                  {mails.length === 0 ? (
                    <div className="registrar-empty">暂未读取到邮件。触发 ChatGPT 验证邮件后点击刷新。</div>
                  ) : mails.map(mail => (
                    <article className="mail-card" key={mail.id}>
                      <div className="mail-card-header">
                        <strong>{mail.subject || '无主题'}</strong>
                        <small>{mail.date || '-'}</small>
                      </div>
                      <p className="mail-from">{mail.from || '未知发件人'}</p>
                      <p>{mail.preview || '无预览内容'}</p>
                      {(mail.code || mail.link) && (
                        <div className="mail-signals">
                          {mail.code && <button onClick={() => copyText(mail.code, '验证码')}><KeyRound size={14} /> {mail.code}</button>}
                          {mail.link && <button onClick={() => copyText(mail.link, '验证链接')}><ExternalLink size={14} /> 验证链接</button>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="registrar-empty big">还没有选择邮箱。先在左侧创建一个临时邮箱。</div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'auto' && (
        <div className="registrar-layout auto-layout">
          <section className="registrar-panel registrar-create-panel">
            <div className="panel-title">
              <Settings2 size={22} />
              <div>
                <h3>自动注册配置</h3>
                <p>设置线程数、注册数量等参数后启动自动注册。</p>
              </div>
            </div>

            <div className="registrar-form auto-form">
              <label>
                注册总数
                <input
                  type="number"
                  min={1}
                  value={autoForm.total}
                  onChange={(e) => setAutoForm(prev => ({ ...prev, total: Number(e.target.value) }))}
                  disabled={autoConfig?.enabled || autoLoading}
                />
              </label>
              <label>
                线程数
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={autoForm.threads}
                  onChange={(e) => setAutoForm(prev => ({ ...prev, threads: Number(e.target.value) }))}
                  disabled={autoConfig?.enabled || autoLoading}
                />
              </label>
              <label>
                注册代理
                <input
                  value={autoForm.proxy}
                  onChange={(e) => setAutoForm(prev => ({ ...prev, proxy: e.target.value }))}
                  placeholder="http://127.0.0.1:7890"
                  disabled={autoConfig?.enabled || autoLoading}
                />
              </label>
              <label>
                验证码等待超时（秒）
                <input
                  type="number"
                  min={10}
                  value={autoForm.waitTimeout}
                  onChange={(e) => setAutoForm(prev => ({ ...prev, waitTimeout: Number(e.target.value) }))}
                  disabled={autoConfig?.enabled || autoLoading}
                />
              </label>
              <label>
                轮询间隔（秒）
                <input
                  type="number"
                  min={1}
                  value={autoForm.waitInterval}
                  onChange={(e) => setAutoForm(prev => ({ ...prev, waitInterval: Number(e.target.value) }))}
                  disabled={autoConfig?.enabled || autoLoading}
                />
              </label>
            </div>

            <div className="registrar-actions-row auto-actions">
              <button
                className="registrar-primary-btn"
                onClick={saveAutoConfig}
                disabled={autoConfig?.enabled || autoLoading}
              >
                {autoLoading ? <RefreshCw size={18} className="spinning" /> : <Save size={18} />}
                保存配置
              </button>
              <button
                className="registrar-primary-btn"
                onClick={toggleAuto}
                disabled={autoLoading}
                style={{ background: autoConfig?.enabled ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : undefined }}
              >
                {autoLoading ? <RefreshCw size={18} className="spinning" /> : autoConfig?.enabled ? <Square size={18} /> : <Play size={18} />}
                {autoConfig?.enabled ? '停止' : '启动'}
              </button>
              <button
                className="registrar-secondary-btn"
                onClick={resetAuto}
                disabled={autoLoading || autoConfig?.enabled}
              >
                <RefreshCw size={17} /> 重置
              </button>
            </div>

            <div className="registrar-workflow">
              <h4>自动注册流程</h4>
              <ol>
                <li>自动创建临时邮箱。</li>
                <li>自动完成 OpenAI 注册协议（Sentinel/PoW/Auth0）。</li>
                <li>自动等待并提取验证码。</li>
                <li>自动登录换 token 并保存到账号池。</li>
              </ol>
            </div>
          </section>

          <section className="registrar-panel registrar-inbox-panel">
            <div className="panel-title">
              <Inbox size={22} />
              <div>
                <h3>运行状态</h3>
                <p>{autoConfig?.enabled ? '正在自动注册中...' : '未启动'}</p>
              </div>
            </div>

            <div className="registrar-config-grid auto-stats">
              <div className="registrar-config-card">
                <span>成功 / 成功率</span>
                <strong>{autoStats.success} / {autoStats.success_rate || 0}%</strong>
              </div>
              <div className="registrar-config-card">
                <span>失败</span>
                <strong>{autoStats.fail}</strong>
              </div>
              <div className="registrar-config-card">
                <span>完成</span>
                <strong>{autoStats.done}</strong>
              </div>
              <div className="registrar-config-card">
                <span>运行 / 线程</span>
                <strong>{autoStats.running} / {autoStats.threads}</strong>
              </div>
              <div className="registrar-config-card">
                <span>运行时间</span>
                <strong>{autoStats.elapsed_seconds || 0}s</strong>
              </div>
              <div className="registrar-config-card">
                <span>平均耗时</span>
                <strong>{autoStats.avg_seconds || 0}s</strong>
              </div>
            </div>

            <div className="mail-list auto-logs">
              <div className="list-title">
                <h3>实时日志</h3>
                <span>{autoLogs.length}</span>
              </div>
              <div className="registrar-empty">{autoLogs.length === 0 ? '暂无日志' : (
                <div className="log-scroll">
                  {autoLogs.slice().reverse().map((item, i) => (
                    <div key={i} className={`log-line ${item.level || ''}`}>
                      <span className="log-time">{new Date(item.time).toLocaleTimeString()}</span>
                      <span className="log-text">{item.text}</span>
                    </div>
                  ))}
                </div>
              )}</div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default RegistrarPage
