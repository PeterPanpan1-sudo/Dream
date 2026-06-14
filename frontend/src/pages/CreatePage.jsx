import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2, X, ImagePlus, Sparkles, Minus, Plus, Mic, MicOff, Image as ImageIcon, Type, Wand2, Lightbulb, ClipboardList } from 'lucide-react'
import './CreatePage.css'

const API_BASE = 'http://localhost:8000'

function CreatePage({ onLoginRequired }) {
  const [studioMode, setStudioMode] = useState('image')
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
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [textPrompt, setTextPrompt] = useState('')
  const [textMessages, setTextMessages] = useState([])
  const [textStreaming, setTextStreaming] = useState(false)
  const [textProgress, setTextProgress] = useState(0)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const textAbortRef = useRef(null)
  const textProgressRef = useRef(null)
  const textChatBodyRef = useRef(null)
  const studioModeRef = useRef(studioMode)

  const studioModes = [
    { id: 'image', label: '图片', icon: ImageIcon },
    { id: 'text', label: '文字', icon: Type },
  ]

  const promptExamples = [
    '我想画一张科研论文配图，主题是纳米材料在肿瘤微环境中的递送机制。',
    '我想画一个产品海报，主体是一款透明质感的智能耳机。',
    '我想画一张适合首页展示的 AI 创作平台视觉图。',
  ]

  const textHistoryCacheKey = (token = localStorage.getItem('token')) => `daydream-text-history:${token ? token.slice(-24) : 'guest'}`

  const normalizeTextHistory = (items = []) => (Array.isArray(items) ? items : [])
    .filter(item => item && item.prompt && item.response)
    .slice(-10)

  const historyItemsToMessages = (items = []) => normalizeTextHistory(items).flatMap(item => [
    { id: `h-u-${item.id}`, role: 'user', content: item.prompt, createdAt: item.created_at },
    { id: `h-a-${item.id}`, role: 'assistant', content: item.response, createdAt: item.created_at }
  ])

  const readCachedTextHistory = (token = localStorage.getItem('token')) => {
    try {
      return normalizeTextHistory(JSON.parse(localStorage.getItem(textHistoryCacheKey(token)) || '[]'))
    } catch {
      return []
    }
  }

  const cacheTextHistory = (items, token = localStorage.getItem('token')) => {
    try {
      localStorage.setItem(textHistoryCacheKey(token), JSON.stringify(normalizeTextHistory(items)))
    } catch (err) {
      console.warn('缓存文字历史失败:', err)
    }
  }

  useEffect(() => {
    studioModeRef.current = studioMode
  }, [studioMode])

  useEffect(() => {
    if (studioMode !== 'text') return
    const token = localStorage.getItem('token')
    if (!token) return
    const cachedItems = readCachedTextHistory(token)
    if (cachedItems.length > 0) {
      setTextMessages(historyItemsToMessages(cachedItems))
    }
    let cancelled = false
    fetch(`${API_BASE}/api/text/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('加载文字历史失败')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const items = normalizeTextHistory(data.items || [])
        if (items.length > 0) {
          cacheTextHistory(items, token)
          setTextMessages(historyItemsToMessages(items))
        } else if (cachedItems.length === 0) {
          setTextMessages(prev => prev)
        }
      })
      .catch(err => console.error('加载文字历史失败:', err))
    return () => {
      cancelled = true
    }
  }, [studioMode])

  useEffect(() => {
    if (studioMode !== 'text') return
    const node = textChatBodyRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [studioMode, textMessages, textStreaming])

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

  // 初始化语音识别
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'zh-CN'

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (finalTranscript) {
          if (studioModeRef.current === 'text') {
            setTextPrompt(prev => prev + (prev ? ' ' : '') + finalTranscript)
          } else {
            setPrompt(prev => prev + (prev ? ' ' : '') + finalTranscript)
          }
        }
      }

      recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error)
        setIsListening(false)
        if (event.error === 'no-speech') {
          setMessage({ type: 'error', text: '未检测到语音，请重试' })
        } else if (event.error === 'not-allowed') {
          setMessage({ type: 'error', text: '请允许麦克风权限' })
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (textAbortRef.current) {
        textAbortRef.current.abort()
      }
      if (textProgressRef.current) {
        clearInterval(textProgressRef.current)
      }
    }
  }, [])

  // 切换语音输入
  const toggleSpeechInput = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setMessage({ type: 'success', text: '正在监听...' })
      } catch (error) {
        console.error('启动语音识别失败:', error)
        setMessage({ type: 'error', text: '启动语音识别失败' })
      }
    }
  }

  const handleGenerate = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setMessage({ type: 'error', text: '请先登录后再生成图片' })
      onLoginRequired?.()
      return
    }

    if (!prompt.trim()) {
      setMessage({ type: 'error', text: '请输入提示词' })
      return
    }

    setGenerating(true)
    setMessage(null)
    try {

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
      if (!token) {
        setMessage({ type: 'error', text: '请先登录后再上传参考图' })
        onLoginRequired?.()
        return
      }
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

  const startFakeTextProgress = () => {
    if (textProgressRef.current) clearInterval(textProgressRef.current)
    const startedAt = Date.now()
    setTextProgress(1)
    textProgressRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const ratio = Math.min(elapsed / 60000, 1)
      const eased = 1 - Math.pow(1 - ratio, 2.8)
      const wave = Math.sin(elapsed / 2700) * 2.5 + Math.sin(elapsed / 9100) * 1.5
      const next = Math.min(96, Math.max(1, Math.round(eased * 92 + wave)))
      setTextProgress(prev => Math.max(prev, next))
    }, 700)
  }

  const stopFakeTextProgress = (complete = false) => {
    if (textProgressRef.current) {
      clearInterval(textProgressRef.current)
      textProgressRef.current = null
    }
    setTextProgress(complete ? 100 : 0)
  }

  const parseSseEvents = (buffer, onEvent) => {
    const blocks = buffer.split('\n\n')
    const rest = blocks.pop() || ''
    for (const block of blocks) {
      const lines = block.split('\n')
      let event = 'message'
      const dataLines = []
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      if (dataLines.length > 0) onEvent(event, dataLines.join('\n'))
    }
    return rest
  }

  const handleTextSend = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setMessage({ type: 'error', text: '请先登录后再使用文字创作台' })
      onLoginRequired?.()
      return
    }
    const content = textPrompt.trim()
    if (!content) {
      setMessage({ type: 'error', text: '请输入要优化或讨论的内容' })
      return
    }

    const userMessage = { id: `u-${Date.now()}`, role: 'user', content }
    const assistantId = `a-${Date.now()}`
    setTextMessages(prev => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '', pending: true }])
    setTextPrompt('')
    setTextStreaming(true)
    startFakeTextProgress()
    setMessage(null)

    const controller = new AbortController()
    textAbortRef.current = controller

    try {
      const response = await fetch(`${API_BASE}/api/text/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: content
        }),
        signal: controller.signal
      })

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || '文字生成失败')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let assistantText = ''

      const handleEvent = (event, rawData) => {
        const data = JSON.parse(rawData)
        if (event === 'error') throw new Error(data.error || '文字生成失败')
        if (event === 'done' && data.text) {
          assistantText = data.text
          stopFakeTextProgress(true)
          if (Array.isArray(data.history)) {
            const historyItems = normalizeTextHistory(data.history)
            cacheTextHistory(historyItems, token)
            setTextMessages(historyItemsToMessages(historyItems))
          } else {
            setTextMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: assistantText, pending: false } : msg))
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        buffer = parseSseEvents(buffer, handleEvent)
      }
      if (buffer.trim()) parseSseEvents(`${buffer}\n\n`, handleEvent)
      if (!assistantText.trim()) {
        throw new Error('没有收到有效优化结果，请稍后重试')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('文字流式生成失败:', err)
        setMessage({ type: 'error', text: err.message || '文字生成失败' })
        setTextMessages(prev => prev.map(msg => msg.id === assistantId && !msg.content ? { ...msg, content: '生成失败，请稍后重试。', pending: false } : msg))
      }
    } finally {
      stopFakeTextProgress(false)
      setTextStreaming(false)
      textAbortRef.current = null
    }
  }

  const stopTextStream = () => {
    if (textAbortRef.current) textAbortRef.current.abort()
    stopFakeTextProgress(false)
    setTextStreaming(false)
  }

  // 每张图片 10 积分
  const cost = numberOfImages * 10

  if (studioMode === 'text') {
    return (
      <div className="create-page text-studio-page compact-text-studio">
        <div className="studio-hero-bar">
          <div>
            <h1>Daydream Image Studio</h1>
            <p>用 GPT-5.5 把模糊想法优化成可直接生图的 prompt。</p>
          </div>
          <div className="studio-type-switch">
            {studioModes.map(item => (
              <button key={item.id} className={`studio-type-btn ${studioMode === item.id ? 'active' : ''}`} disabled={item.disabled} onClick={() => !item.disabled && setStudioMode(item.id)}>
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="prompt-optimizer-layout">
          <main className="text-chat-card prompt-optimizer-card">
            <div className="text-chat-header optimizer-header">
              <div>
                <h2><Wand2 size={26} /> 提示词优化器</h2>
                <p>只做一件事：把你写不清楚的想法，优化成适合图片生成的高质量 prompt。</p>
              </div>
              <div className="optimizer-meta">
                <span>GPT-5.5</span>
                <strong>5 积分/次</strong>
              </div>
            </div>

            <div className="text-chat-body prompt-history-body" ref={textChatBodyRef}>
              {textMessages.length === 0 ? (
                <div className="text-empty-state">
                  <Lightbulb size={42} />
                  <p>输入你已有的粗糙描述，或者只写“我想画科研论文图”。我会优化 prompt，并告诉你还需要补充什么。</p>
                </div>
              ) : (
                textMessages.map(msg => (
                  <div key={msg.id} className={`text-message ${msg.role}`}>
                    <div className="message-role">{msg.role === 'user' ? '你' : '优化结果'}</div>
                    {msg.pending ? (
                      <div className="optimizer-progress-card">
                        <div className="progress-title">
                          <span>正在完整优化提示词</span>
                          <strong>{textProgress}%</strong>
                        </div>
                        <div className="fake-progress-track">
                          <div className="fake-progress-fill" style={{ width: `${textProgress}%` }} />
                        </div>
                        <p>正在等待 GPT-5.5 生成完整结果，完成后会一次性展示。</p>
                      </div>
                    ) : (
                      <div className="message-content">{msg.content}</div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="text-input-panel">
              <textarea
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                placeholder="写下你想画什么，例如：我想画一张科研论文图，主题是肿瘤微环境中的纳米药物递送。"
                disabled={textStreaming}
              />
              <div className="prompt-example-row">
                {promptExamples.map(example => (
                  <button key={example} type="button" onClick={() => setTextPrompt(example)} disabled={textStreaming}>
                    {example}
                  </button>
                ))}
              </div>
              <div className="text-input-footer">
                <span>{textPrompt.length}/8000</span>
                <button className="voice-round-btn" onClick={toggleSpeechInput} disabled={!speechSupported || textStreaming} title="语音输入">
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button className="send-text-btn" onClick={textStreaming ? stopTextStream : handleTextSend} disabled={!textStreaming && !textPrompt.trim()}>
                  {textStreaming ? <><Loader2 size={18} className="spinning" /> 停止</> : <><Send size={18} /> 发送</>}
                </button>
              </div>
            </div>
          </main>

          <aside className="prompt-guide-card">
            <h2><ClipboardList size={24} /> 怎么描述更好</h2>
            <ul>
              <li><strong>主体：</strong>你想画什么对象或场景</li>
              <li><strong>用途：</strong>论文配图、海报、封面、产品图等</li>
              <li><strong>信息：</strong>必须出现的元素、过程、结构或关键词</li>
              <li><strong>风格：</strong>科研插画、3D、扁平、写实、极简等</li>
              <li><strong>限制：</strong>不要文字、不要人物、背景透明等</li>
            </ul>
            <div className="simple-cost-card"><span>固定模型</span><strong>GPT-5.5</strong></div>
            <div className="simple-cost-card"><span>每次优化</span><strong>5 积分</strong></div>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="create-page">
      <div className="studio-hero-bar">
        <div>
          <h1>Daydream Image Studio</h1>
          <p>选择图片或文字创作模式。</p>
        </div>
        <div className="studio-type-switch">
          {studioModes.map(item => (
            <button key={item.id} className={`studio-type-btn ${studioMode === item.id ? 'active' : ''}`} disabled={item.disabled} onClick={() => !item.disabled && setStudioMode(item.id)}>
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </div>
      </div>
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
            <div className="section-header-row">
              <label className="section-label">提示词</label>
              {speechSupported && (
                <button
                  className={`voice-btn ${isListening ? 'listening' : ''}`}
                  onClick={toggleSpeechInput}
                  title={isListening ? '停止语音输入' : '开始语音输入'}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  {isListening ? '停止' : '语音输入'}
                </button>
              )}
            </div>
            <textarea
              className="prompt-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要生成的图片，或点击语音输入..."
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
