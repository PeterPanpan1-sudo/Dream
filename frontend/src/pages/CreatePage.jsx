import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2, X, ImagePlus, Sparkles, Minus, Plus } from 'lucide-react'
import './CreatePage.css'

const API_BASE = 'http://localhost:8000'

function CreatePage() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [model, setModel] = useState('gpt-image-2')
  const [size, setSize] = useState('auto')
  const [quality, setQuality] = useState('standard')
  const [numberOfImages, setNumberOfImages] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState([])
  const [message, setMessage] = useState(null)
  const [referenceImages, setReferenceImages] = useState([])
  const fileInputRef = useRef(null)

  const models = [
    { value: 'gpt-image-2', label: 'GPT Image 2' },
    { value: 'codex-gpt-image-2', label: 'Codex Image 2' },
    { value: 'gpt-image-1', label: 'GPT Image 1' },
  ]

  const sizes = [
    { value: 'auto', label: '自动' },
    { value: '1024x1024', label: '1024×1024' },
    { value: '1024x1536', label: '1024×1536' },
    { value: '1536x1024', label: '1536×1024' },
  ]

  const qualities = [
    { value: 'standard', label: '标准' },
    { value: 'hd', label: '高清' },
  ]

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setMessage({ type: 'error', text: '请输入提示词' })
      return
    }
    setGenerating(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setMessage({ type: 'error', text: '请先登录' })
        setGenerating(false)
        return
      }

      // 构建请求数据 - 不修改 prompt，让后端处理参考图提示
      const response = await fetch(`${API_BASE}/api/images/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: prompt.trim(),  // 直接使用用户输入的 prompt
          negative_prompt: negativePrompt.trim() || undefined,
          model,
          size,
          quality,
          n: numberOfImages,
          reference_images: referenceImages.map(img => img.url)
        })
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '生成失败')
      }
      const data = await response.json()
      console.log('后端返回数据:', data)

      // 后端返回的是 images 字段，不是 results
      const generatedImages = data.images || data.results || []

      if (generatedImages.length > 0) {
        setResults(prev => [...generatedImages, ...prev])
        setMessage({ type: 'success', text: `成功生成 ${generatedImages.length} 张图片` })
      } else {
        setMessage({ type: 'warning', text: '生成完成，但未返回图片' })
      }
    } catch (err) {
      console.error('生成错误：', err)
      setMessage({ type: 'error', text: err.message || '生成失败' })
    } finally {
      setGenerating(false)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/images/upload-reference`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setReferenceImages(prev => [...prev, { url: data.url, name: file.name }])
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || '上传失败' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: '上传失败' })
    }
  }

  const removeReference = (index) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index))
  }

  // 每张图片 10 积分
  const cost = numberOfImages * 10

  return (
    <div className="create-page">
      <div className="create-container">
        <div className="creation-panel">
          <div className="panel-header">
            <h2>AI 绘画</h2>
            <p className="subtitle">用文字描述你的想法，AI 为你生成精美图片</p>
          </div>

          <div className="mode-tabs">
            {models.map(m => (
              <button key={m.value} className={`mode-tab ${model === m.value ? 'active' : ''}`} onClick={() => setModel(m.value)}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="prompt-section">
            <label className="section-label">提示词</label>
            <textarea
              className="prompt-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要生成的图片..."
              rows={4}
            />
          </div>

          <div className="reference-section">
            <div className="section-header-row">
              <label className="section-label">参考图</label>
              <button className="ref-btn" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={16} /> 上传参考图
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
            </div>
            {referenceImages.length > 0 && (
              <div className="reference-list">
                {referenceImages.map((img, i) => (
                  <div key={i} className="reference-chip">
                    <span className="reference-name" title={img.name}>{img.name}</span>
                    <button className="reference-remove" onClick={() => removeReference(i)}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && (
            <div className={`message-box ${message.type === 'error' ? 'error-box' : message.type === 'warning' ? 'warning-box' : 'success-box'}`}>
              {message.text}
            </div>
          )}

          <button className="generate-btn" onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? <><Loader2 size={18} className="spinning" /> 生成中...</> : <><Send size={18} /> 生成图片</>}
          </button>
        </div>

        <div className="parameters-panel">
          <div className="param-group">
            <div className="param-label">
              <span>尺寸</span>
              <span className="param-value">{size}</span>
            </div>
            <div className="size-grid">
              {sizes.map(s => (
                <button key={s.value} className={`size-btn ${size === s.value ? 'active' : ''}`} onClick={() => setSize(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="param-group">
            <div className="param-label">
              <span>画质</span>
              <span className="param-value">{qualities.find(q => q.value === quality)?.label}</span>
            </div>
            <div className="quality-buttons">
              {qualities.map(q => (
                <button key={q.value} className={`quality-btn ${quality === q.value ? 'active' : ''}`} onClick={() => setQuality(q.value)}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="param-group">
            <div className="param-label">
              <span>数量</span>
              <span className="param-value">{numberOfImages}</span>
            </div>
            <div className="number-control">
              <button className="control-btn" onClick={() => setNumberOfImages(Math.max(1, numberOfImages - 1))} disabled={numberOfImages <= 1}><Minus size={16} /></button>
              <span className="number-display">{numberOfImages}</span>
              <button className="control-btn" onClick={() => setNumberOfImages(Math.min(10, numberOfImages + 1))} disabled={numberOfImages >= 10}><Plus size={16} /></button>
            </div>
          </div>

          <div className="param-group cost-group">
            <div className="param-label">预计消耗</div>
            <div className="cost-display">
              <span className="cost-value">{cost}</span>
              <span className="cost-unit">积分</span>
            </div>
            <div className="cost-hint">每张图片 10 积分</div>
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="canvas-area">
          <div className="canvas-placeholder">
            <div className="placeholder-icon"><Sparkles size={64} /></div>
            <p>输入提示词，点击生成按钮<br/>AI 将为你创造独特的艺术作品</p>
          </div>
        </div>
      ) : (
        <div className="generated-images">
          <h3 className="images-title">生成结果</h3>
          <div className="images-grid">
            {results.map((img, i) => (
              <motion.div key={i} className="image-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <img className="generated-image" src={img.url.startsWith('http') ? img.url : `${API_BASE}${img.url}`} alt={img.prompt || 'generated'} loading="lazy" />
                <div className="image-info">
                  <p className="image-prompt">{img.prompt}</p>
                  <p className="image-meta">{img.model} · {img.size}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CreatePage
