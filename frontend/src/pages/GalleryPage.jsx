import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Heart, Eye, EyeOff, Trash2, Download } from 'lucide-react'
import './GalleryPage.css'

const API_BASE = ''
const PAGE_SIZE = 9

function GalleryPage({ user, theme }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [copiedId, setCopiedId] = useState(null)
  const [likeLoading, setLikeLoading] = useState({})
  const [deleteLoading, setDeleteLoading] = useState({})
  const [downloadProgress, setDownloadProgress] = useState(null) // { id, percent }
  const isGuest = !user
  const isAdmin = user?.role === 'admin'
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    fetchImages(currentPage)
  }, [currentPage, user?.id, user?.role])

  const fetchImages = async (page = 1) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/api/images/gallery?page=${page}&limit=${PAGE_SIZE}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (response.ok) {
        const data = await response.json()
        setImages(data.items || [])
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch images:', err)
    } finally {
      setLoading(false)
    }
  }

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(1, page), totalPages)
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage)
      setDownloadProgress(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const getPaginationItems = () => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    if (start > 1) {
      pages.push(1)
      if (start > 2) pages.push('start-ellipsis')
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page)
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('end-ellipsis')
      pages.push(totalPages)
    }

    return pages
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
    if (isGuest) return
    const token = localStorage.getItem('token')
    if (!token) return
    const isLiked = Boolean(image.is_liked || image.user_liked)
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
          const currentCount = img.likes_count || img.like_count || 0
          return {
            ...img,
            is_liked: !isLiked,
            user_liked: !isLiked ? 1 : 0,
            likes_count: currentCount + (isLiked ? -1 : 1),
            like_count: currentCount + (isLiked ? -1 : 1)
          }
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
    if (isGuest) return
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const getFileExtension = (url = '', contentType = '') => {
    const normalizedType = contentType.split(';')[0].trim().toLowerCase()
    const typeMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg'
    }
    if (typeMap[normalizedType]) return typeMap[normalizedType]

    try {
      const pathname = new URL(url, window.location.origin).pathname
      const match = pathname.match(/\.([a-z0-9]+)$/i)
      if (match?.[1]) return match[1].toLowerCase().replace('jpeg', 'jpg')
    } catch (err) {
      console.warn('解析图片扩展名失败:', err)
    }

    return 'png'
  }

  const buildDownloadFilename = (image, url, contentType = '') => {
    const ext = getFileExtension(url, contentType)
    return `daydream-${image.id}-${Date.now()}.${ext}`
  }

  const saveBlob = (blob, filename) => {
    const objectUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(objectUrl)
  }

  const openDirectDownloadLink = (url, filename) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const downloadDirectlyFromUrl = (url, image) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'blob'
    xhr.withCredentials = false

    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)))
        setDownloadProgress({ id: image.id, percent, message: '正在从 R2 直连下载...' })
      } else {
        setDownloadProgress(prev => ({
          id: image.id,
          percent: Math.min((prev?.percent || 8) + 6, 90),
          message: '正在从 R2 直连下载...'
        }))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const contentType = xhr.getResponseHeader('Content-Type') || ''
        const filename = buildDownloadFilename(image, url, contentType)
        saveBlob(xhr.response, filename)
        resolve()
        return
      }
      reject(new Error(`R2 下载失败: ${xhr.status}`))
    }

    xhr.onerror = () => reject(new Error('R2 直连下载被浏览器拦截或网络失败'))
    xhr.onabort = () => reject(new Error('下载已取消'))
    xhr.send()
  })

  const handleDownload = async (image) => {
    if (isGuest) return
    const downloadUrl = getImageUrl(image.url)
    const fallbackFilename = buildDownloadFilename(image, downloadUrl)

    try {
      setDownloadProgress({ id: image.id, percent: 1, message: '正在从 R2 直连下载...' })
      await downloadDirectlyFromUrl(downloadUrl, image)
      setDownloadProgress({ id: image.id, percent: 100, message: '下载完成' })
      setTimeout(() => setDownloadProgress(null), 700)
    } catch (err) {
      console.warn('R2 blob download failed, fallback to direct link:', err)
      setDownloadProgress({ id: image.id, percent: 100, message: '正在打开 R2 原图链接...' })
      openDirectDownloadLink(downloadUrl, fallbackFilename)
      setTimeout(() => setDownloadProgress(null), 1000)
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
        {isGuest && <p className="gallery-guest-tip">访客仅可浏览作品，登录后可点赞、复制提示词和下载图片。</p>}
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
                {!isGuest && (
                  <div className="action-group">
                    <button className={`action-btn like-btn ${(image.is_liked || image.user_liked) ? 'liked' : ''}`} onClick={() => handleLike(image)} disabled={likeLoading[image.id]}>
                      <Heart size={14} fill={(image.is_liked || image.user_liked) ? 'currentColor' : 'none'} />
                      <span>{image.likes_count || image.like_count || 0}</span>
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
                )}
                {isGuest && <span className="guest-browse-only">仅浏览</span>}
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

      {totalPages > 1 && (
        <div className="gallery-pagination" aria-label="画廊分页">
          <button className="pagination-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
            上一页
          </button>
          <div className="pagination-pages">
            {getPaginationItems().map(item => (
              typeof item === 'number' ? (
                <button
                  key={item}
                  className={`pagination-page ${currentPage === item ? 'active' : ''}`}
                  onClick={() => goToPage(item)}
                  aria-current={currentPage === item ? 'page' : undefined}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="pagination-ellipsis">...</span>
              )
            ))}
          </div>
          <button className="pagination-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
            下一页
          </button>
          <span className="pagination-summary">第 {currentPage} / {totalPages} 页，共 {total} 张</span>
        </div>
      )}

      {/* 下载进度提示 */}
      {!isGuest && downloadProgress && (
        <motion.div
          className="download-progress-modal"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="progress-content">
            <Download size={20} />
            <div className="progress-info">
              <span className="progress-text">{downloadProgress.message || '正在下载图片...'}</span>
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
