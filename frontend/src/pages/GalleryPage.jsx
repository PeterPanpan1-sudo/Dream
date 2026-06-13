import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Heart, Eye, EyeOff, Trash2, Download } from 'lucide-react'
import './GalleryPage.css'

const API_BASE = ''

function GalleryPage({ user, theme }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [likeLoading, setLikeLoading] = useState({})
  const [deleteLoading, setDeleteLoading] = useState({})
  const [downloadProgress, setDownloadProgress] = useState(null) // { id, percent }
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/api/images/gallery?limit=50`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (response.ok) {
        const data = await response.json()
        setImages(data.items || [])
      }
    } catch (err) {
      console.error('Failed to fetch images:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleVisibility = async (image) => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const response = await fetch(`${API_BASE}/api/images/${image.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_public: !image.is_public })
      })
      if (response.ok) {
        setImages(prev => prev.map(img => img.id === image.id ? { ...img, is_public: !img.is_public } : img))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleLike = async (image) => {
    const token = localStorage.getItem('token')
    if (!token) return
    const isLiked = image.is_liked
    const method = isLiked ? 'DELETE' : 'POST'
    setLikeLoading(prev => ({ ...prev, [image.id]: true }))
    try {
      const response = await fetch(`${API_BASE}/api/images/${image.id}/like`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setImages(prev => prev.map(img => {
          if (img.id !== image.id) return img
          return { ...img, is_liked: !isLiked, likes_count: (img.likes_count || 0) + (isLiked ? -1 : 1) }
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLikeLoading(prev => ({ ...prev, [image.id]: false }))
    }
  }

  const handleDelete = async (image) => {
    if (!confirm('确定要删除这张图片吗？')) return
    const token = localStorage.getItem('token')
    setDeleteLoading(prev => ({ ...prev, [image.id]: true }))
    try {
      const response = await fetch(`${API_BASE}/api/images/${image.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== image.id))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeleteLoading(prev => ({ ...prev, [image.id]: false }))
    }
  }

  const handleCopyPrompt = (prompt, id) => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleDownload = async (image) => {
    try {
      setDownloadProgress({ id: image.id, percent: 0 })

      const downloadUrl = `${API_BASE}/api/images/download/${image.id}`

      // 使用 XMLHttpRequest 来跟踪下载进度
      const xhr = new XMLHttpRequest()
      xhr.open('GET', downloadUrl, true)
      xhr.responseType = 'blob'

      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          setDownloadProgress({ id: image.id, percent })
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `daydream-${image.id}-${Date.now()}.png`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)

          setDownloadProgress({ id: image.id, percent: 100 })
          setTimeout(() => setDownloadProgress(null), 1000)
        } else {
          throw new Error(`下载失败: ${xhr.status}`)
        }
      }

      xhr.onerror = () => {
        throw new Error('网络错误')
      }

      xhr.send()
    } catch (err) {
      console.error('Download failed:', err)
      alert('下载失败: ' + err.message)
      setDownloadProgress(null)
    }
  }

  const getImageUrl = (url) => {
    if (!url) return ''
    return url.startsWith('http') ? url : `${API_BASE}${url}`
  }

  if (loading) return <div className="gallery-page"><div className="gallery-loading">加载中...</div></div>

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <h2>画廊</h2>
        <p className="gallery-subtitle">探索社区创作的精彩作品</p>
      </div>
      {images.length === 0 ? (
        <div className="gallery-empty">暂无图片</div>
      ) : (
        <div className="gallery-grid">
          {images.map(image => (
            <motion.div key={image.id} className="gallery-item" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="image-container">
                <img src={getImageUrl(image.url)} alt={image.prompt} loading="lazy" />
                <div className="image-overlay">
                  <div className="overlay-top">
                    <span className="model-badge">{image.model}</span>
                    {image.is_public ? (
                      <span className="public-badge">公开</span>
                    ) : (
                      <span className="private-badge">隐藏</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="image-meta-bar">
                <div className="meta-left">
                  <span className="author-name">{image.author || '匿名'}</span>
                  <span className="image-date">{new Date(image.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="image-actions-bar">
                <div className="action-group">
                  <button className={`action-btn like-btn ${image.is_liked ? 'liked' : ''}`} onClick={() => handleLike(image)} disabled={likeLoading[image.id]}>
                    <Heart size={14} fill={image.is_liked ? 'currentColor' : 'none'} />
                    <span>{image.likes_count || 0}</span>
                  </button>
                  <button className={`copy-prompt-btn ${copiedId === image.id ? 'copied' : ''}`} onClick={() => handleCopyPrompt(image.prompt, image.id)}>
                    {copiedId === image.id ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制提示词</>}
                  </button>
                  <button
                    className="download-btn"
                    onClick={() => handleDownload(image)}
                    disabled={downloadProgress?.id === image.id}
                    title="下载图片"
                  >
                    <Download size={14} />
                    {downloadProgress?.id === image.id ? '下载中...' : '下载'}
                  </button>
                </div>
                {isAdmin && (
                  <div className="admin-actions">
                    <button className="visibility-toggle" onClick={() => handleToggleVisibility(image)} title={image.is_public ? '设为私有' : '设为公开'}>
                      {image.is_public ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(image)} disabled={deleteLoading[image.id]} title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 下载进度提示 */}
      {downloadProgress && (
        <motion.div
          className="download-progress-modal"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="progress-content">
            <Download size={20} />
            <div className="progress-info">
              <span className="progress-text">正在下载图片...</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${downloadProgress.percent}%` }}
                ></div>
              </div>
              <span className="progress-percent">{downloadProgress.percent}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default GalleryPage
