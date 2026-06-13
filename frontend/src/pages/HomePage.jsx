import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Play, Image as ImageIcon, Zap, Palette } from 'lucide-react'
import './HomePage.css'

function HomePage({ user, theme, onNavigate }) {
  return (
    <div className="home-page">
      <div className="hero-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="hero-section">
        <div className="hero-badge">
          <Sparkles size={14} />
          <span>AI 驱动的创意平台</span>
        </div>
        <h1 className="hero-title">
          释放你的<br />
          <span className="gradient-text">无限想象力</span>
        </h1>
        <p className="hero-description">
          用文字描述你的想法，AI 将为你生成令人惊叹的视觉作品。
          无论你是设计师、艺术家还是创意爱好者，这里都是你实现梦想的起点。
        </p>
        <div className="hero-cta">
          <button className="cta-button primary" onClick={() => onNavigate && onNavigate('create')}>
            开始创作 <ArrowRight size={18} />
          </button>
          <button className="cta-button secondary" onClick={() => onNavigate && onNavigate('gallery')}>
            <Play size={18} /> 观看演示
          </button>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-value">10K+</div>
            <div className="stat-label">作品生成</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-value">5K+</div>
            <div className="stat-label">活跃用户</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-value">99%</div>
            <div className="stat-label">满意度</div>
          </div>
        </div>
      </div>

      <div className="hero-showcase">
        <div className="showcase-image">
          <div className="image-wrapper">
            <img src="/showcase.png" alt="AI 创作展示" />
            <div className="image-overlay"></div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <div className="section-header">
          <h2 className="section-title">为什么选择白日梦</h2>
          <p className="section-subtitle">强大的 AI 能力，简单的创作体验</p>
        </div>
        <div className="features-grid">
          <motion.div className="feature-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="feature-icon-wrapper">
              <ImageIcon size={28} />
            </div>
            <h3 className="feature-title">AI 绘画</h3>
            <p className="feature-description">用文字描述你的想法，AI 为你生成精美图片。支持多种风格和尺寸。</p>
          </motion.div>
          <motion.div className="feature-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <div className="feature-icon-wrapper">
              <Zap size={28} />
            </div>
            <h3 className="feature-title">快速生成</h3>
            <p className="feature-description">多种模型可选，秒级出图。从概念到成品，只需几秒钟。</p>
          </motion.div>
          <motion.div className="feature-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <div className="feature-icon-wrapper">
              <Palette size={28} />
            </div>
            <h3 className="feature-title">创意无限</h3>
            <p className="feature-description">支持多种风格，满足你的创作需求。从写实到抽象，应有尽有。</p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
