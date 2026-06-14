import fs from 'fs';
import { RegisterWorker } from './worker.js';

function nowISO() { return new Date().toISOString(); }
function toInt(v, d = 0) { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; }

function defaultConfig() {
  return {
    proxy: '', total: 10, threads: 1, mode: 'total',
    target_quota: 100, target_available: 10, check_interval: 5,
    enabled: false, waitTimeout: 60, waitInterval: 3,
    stats: {
      success: 0, fail: 0, done: 0, running: 0, threads: 1,
      elapsed_seconds: 0, avg_seconds: 0, success_rate: 0,
      current_quota: 0, current_available: 0, updated_at: nowISO()
    },
    logs: []
  };
}

export class AutoRegisterService {
  constructor({ configPath, getPoolMetrics, saveAccount }) {
    this.configPath = configPath || './data/auto-register.json';
    this.getPoolMetrics = getPoolMetrics;
    this.saveAccount = saveAccount;
    this.config = this._load();
    this._ensureDefaults();
    this.runnerAlive = false;
    this.subscribers = new Set();
    this.blockedDomains = new Set();
  }

  _ensureDefaults() {
    const defs = defaultConfig();
    for (const [k, v] of Object.entries(defs)) {
      if (this.config[k] === undefined) this.config[k] = v;
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.configPath)) return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch { }
    return defaultConfig();
  }

  _save() {
    try { fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2)); } catch { }
  }

  snapshot() {
    return {
      ...this.config,
      stats: { ...this.config.stats },
      logs: this.config.logs.slice(-300).map(l => ({ ...l })),
      blockedDomains: Array.from(this.blockedDomains),
    };
  }

  snapshotJSON() { return JSON.stringify(this.snapshot()); }

  _notify() {
    const payload = this.snapshotJSON();
    for (const ch of this.subscribers) {
      try { ch(payload); } catch { }
    }
  }

  appendLog(text, level = '') {
    const item = { time: nowISO(), text, level: level || 'info' };
    this.config.logs.push(item);
    if (this.config.logs.length > 300) this.config.logs = this.config.logs.slice(-300);
    this._notify();
  }

  blockDomain(domain) {
    if (!domain) return;
    this.blockedDomains.add(domain);
    this.appendLog(`邮箱域名 ${domain} 被 OpenAI 拒绝，已自动加入黑名单`, 'yellow');
  }

  getTempMailConfig() {
    // Read from process.env, same as index.js
    const workerUrl = String(process.env.TEMP_MAIL_WORKER_URL || process.env.CLOUDFLARE_TEMP_MAIL_URL || '').trim().replace(/\/+$/, '');
    const adminAuth = String(process.env.TEMP_MAIL_ADMIN_AUTH || process.env.CLOUDFLARE_TEMP_MAIL_ADMIN_AUTH || '').trim();
    const domain = String(process.env.TEMP_MAIL_DOMAIN || 'edu.peterlinux.com').trim().toLowerCase();
    return { workerUrl, adminAuth, domain };
  }

  targetReached() {
    const metrics = this.getPoolMetrics ? this.getPoolMetrics() : { current_quota: 0, current_available: 0 };
    this.bumpStats(metrics);
    const mode = this.config.mode || 'total';
    switch (mode) {
      case 'quota':
        return toInt(metrics.current_quota, 0) >= toInt(this.config.target_quota, 1);
      case 'available':
        return toInt(metrics.current_available, 0) >= toInt(this.config.target_available, 1);
      default:
        return false;
    }
  }

  bumpStats(updates) {
    const stats = { ...this.config.stats, ...updates };
    if (this.config.stats.started_at) {
      const started = new Date(this.config.stats.started_at);
      const elapsed = Math.round((Date.now() - started) / 100);
      stats.elapsed_seconds = elapsed / 10;
      const success = toInt(stats.success, 0);
      const fail = toInt(stats.fail, 0);
      stats.avg_seconds = success > 0 ? Math.round((stats.elapsed_seconds / success) * 10) / 10 : 0;
      stats.success_rate = Math.round((success * 100 / Math.max(1, success + fail)) * 10) / 10;
    }
    stats.updated_at = nowISO();
    this.config.stats = stats;
    this._save();
    this._notify();
  }

  get() { return this.snapshot(); }

  update(updates) {
    const allowed = ['proxy', 'total', 'threads', 'mode', 'target_quota', 'target_available', 'check_interval', 'waitTimeout', 'waitInterval'];
    for (const k of allowed) {
      if (updates[k] !== undefined) {
        if (['total', 'threads', 'target_quota', 'target_available', 'check_interval', 'waitTimeout', 'waitInterval'].includes(k)) {
          this.config[k] = Math.max(1, toInt(updates[k], 1));
        } else {
          this.config[k] = updates[k];
        }
      }
    }
    this._save();
    this._notify();
    return this.snapshot();
  }

  start() {
    if (this.runnerAlive) {
      this.config.enabled = true;
      this._save();
      this._notify();
      return this.snapshot();
    }
    this.startLocked(true);
    return this.snapshot();
  }

  startLocked(resetLogs) {
    const tm = this.getTempMailConfig();
    if (!tm.workerUrl || !tm.adminAuth) {
      this.appendLog('自动注册未配置：缺少 TEMP_MAIL_WORKER_URL 或 TEMP_MAIL_ADMIN_AUTH', 'red');
      return;
    }
    if (resetLogs) this.config.logs = [];
    this.config.enabled = true;
    this.config.stats = {
      ...defaultConfig().stats,
      success: 0, fail: 0, done: 0, running: 0,
      threads: Math.max(1, toInt(this.config.threads, 1)),
      started_at: nowISO(), updated_at: nowISO(),
      current_quota: 0, current_available: 0,
    };
    this._save();
    this._notify();
    this.runnerAlive = true;
    this.appendLog(`注册任务启动，模式=${this.config.mode}，线程数=${this.config.stats.threads}`, 'yellow');
    this._run();
  }

  stop() {
    this.config.enabled = false;
    this.config.stats.updated_at = nowISO();
    this.appendLog('已请求停止注册任务，正在等待当前运行任务结束', 'yellow');
    this._save();
    this._notify();
    return this.snapshot();
  }

  reset() {
    this.config.logs = [];
    const metrics = this.getPoolMetrics ? this.getPoolMetrics() : { current_quota: 0, current_available: 0 };
    this.config.stats = {
      ...defaultConfig().stats,
      threads: Math.max(1, toInt(this.config.threads, 1)),
      current_quota: toInt(metrics.current_quota, 0),
      current_available: toInt(metrics.current_available, 0),
      updated_at: nowISO(),
    };
    this._save();
    this._notify();
    return this.snapshot();
  }

  async _run() {
    const threads = Math.max(1, toInt(this.config.threads, 1));
    let submitted = 0, running = 0, done = 0, success = 0, fail = 0;
    const results = [];
    const tm = this.getTempMailConfig();
    const workerCfg = {
      proxy: this.config.proxy,
      workerUrl: tm.workerUrl,
      adminAuth: tm.adminAuth,
      domain: tm.domain,
      waitTimeout: this.config.waitTimeout || 60,
      waitInterval: this.config.waitInterval || 3,
    };

    const pump = async () => {
      while (this.config.enabled && !this.targetReached() && running < threads && submitted < toInt(this.config.total, 1)) {
        submitted++;
        running++;
        const idx = submitted;
        const task = Promise.race([
          (async () => {
            const worker = new RegisterWorker(this, idx, workerCfg);
            try { return await worker.run(); } finally { worker.close(); }
          })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('任务超时（5分钟）')), 300000))
        ]);
        task.then(res => {
          running--;
          done++;
          if (res.ok) {
            success++;
            if (this.saveAccount) {
              this.saveAccount({
                email: res.result.email,
                access_token: res.result.access_token,
                refresh_token: res.result.refresh_token,
                id_token: res.result.id_token,
                status: 'active',
              });
            }
            this.appendLog(`${res.result.email} 注册成功，本次耗时${res.cost}s`, 'green');
          } else {
            fail++;
            this.appendLog(`任务${idx} 注册失败，本次耗时${res.cost}s，原因: ${res.err}`, 'red');
          }
          this.bumpStats({ running, done, success, fail });
          // Remove completed promise from results
          const i = results.indexOf(task);
          if (i > -1) results.splice(i, 1);
          // Try to pump more
          pump();
        }).catch(err => {
          running--; done++; fail++;
          this.appendLog(`任务${idx} 异常，原因: ${err.message}`, 'red');
          this.bumpStats({ running, done, success, fail });
          const i = results.indexOf(task);
          if (i > -1) results.splice(i, 1);
          pump();
        });
        results.push(task);
        this.bumpStats({ running, done, success, fail });
      }
    };

    pump();

    // Wait for all running tasks to finish when disabled
    while (this.config.enabled || running > 0) {
      if (!this.config.enabled && running === 0) break;
      if (this.config.mode === 'total' && submitted >= toInt(this.config.total, 1) && running === 0) break;
      await new Promise(r => setTimeout(r, 500));
    }

    this.bumpStats({ running: 0, done, success, fail, finished_at: nowISO() });
    this.runnerAlive = false;
    this.config.enabled = false;
    this._save();
    this._notify();
    this.appendLog(`注册任务结束，成功${success}，失败${fail}`, 'yellow');
  }

  subscribe() {
    let cb = null;
    const ch = (payload) => { if (cb) cb(payload); };
    this.subscribers.add(ch);
    return {
      onData: (fn) => { cb = fn; cb(this.snapshotJSON()); },
      close: () => { this.subscribers.delete(ch); }
    };
  }
}
