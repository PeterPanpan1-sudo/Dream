import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, ExternalLink, Inbox, KeyRound, MailPlus, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react'
import './RegistrarPage.css'

const API_BASE = ''

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
      showMessage('success', `${label}已复制`)
    } catch {
      showMessage('error', '复制失败，请手动复制')
    }
  }

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
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
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
              邮箱名称
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
              <li>创建 <b>@edu.peterlinux.com</b> 临时邮箱。</li>
              <li>用该邮箱在 ChatGPT/OpenAI 注册并触发验证邮件。</li>
              <li>刷新收件箱，复制验证码或打开验证链接。</li>
              <li>注册完成后粘贴 <b>session_token</b>，保存到账号池。</li>
            </ol>
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
                  {selectedSignals.code && <button onClick={() => copyText(selectedSignals.code, '验证码')}><Copy size={14} /> 复制</button>}
                </div>
                <div className="signal-card link-card">
                  <span>验证链接</span>
                  <strong>{selectedSignals.link ? '已提取' : '等待邮件'}</strong>
                  <div className="signal-actions">
                    {selectedSignals.link && <button onClick={() => copyText(selectedSignals.link, '验证链接')}><Copy size={14} /> 复制</button>}
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
                  Session Token
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
    </div>
  )
}

export default RegistrarPage
