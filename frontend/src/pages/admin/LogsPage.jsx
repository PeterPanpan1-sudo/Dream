import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, RefreshCw, Shield } from 'lucide-react'
import './AdminPage.css'

function LogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setLogs(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionBadgeClass = (action) => {
    const map = {
      login: 'login',
      logout: 'logout',
      create: 'create',
      update: 'update',
      delete: 'delete'
    }
    return map[action] || 'default'
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="header-left">
          <div className="admin-title"><FileText size={28} /> 操作日志</div>
          <div className="admin-subtitle">查看系统操作记录和用户行为日志</div>
        </div>
        <div className="header-actions">
          <button className="action-btn" onClick={fetchLogs}><RefreshCw size={16} /> 刷新</button>
        </div>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <p>暂无日志记录</p>
          </div>
        ) : (
          <div className="logs-list">
            {logs.map(log => (
              <div key={log.id} className="log-item">
                <div className="log-header">
                  <span className={`action-badge ${getActionBadgeClass(log.action)}`}>{log.action}</span>
                  <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div className="log-body">
                  <div className="log-info">
                    <span className="log-label">用户:</span>
                    <span className="log-value">{log.username || '-'}</span>
                  </div>
                  {log.details && (
                    <div className="log-info">
                      <span className="log-label">详情:</span>
                      <span className="log-value">{log.details}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LogsPage
