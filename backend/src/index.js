import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import * as codexClient from './chatgpt-client.js';
import * as officialClient from './chatgpt-official-client.js';
import * as textClient from './chatgpt-text-client.js';
import { uploadToR2, deleteFromR2, listR2Objects } from './r2.js';
import { AutoRegisterService } from './auto-register/index.js';

dotenv.config();

// 按模型选择生图链路：
//   codex-gpt-image-2 -> Codex Responses 链路 (链路B, base64 直出)
//   其余 (gpt-image-2 / auto / ...) -> 官方 f/conversation 链路 (链路A, 指针下载)
const pickImageClient = (model) =>
  String(model || '').trim() === 'codex-gpt-image-2' ? codexClient : officialClient;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

// QQ Email SMTP transporter
const mailTransporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: 'peteryuepan168@foxmail.com',
    pass: 'tnfbaraoonwvchce',
  },
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Multer setup for reference image uploads
const upload = multer({
  dest: path.join(__dirname, '../uploads/references/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允许上传图片文件'), false);
  }
});

// Ensure uploads/references exists
const refDir = path.join(__dirname, '../uploads/references/');
if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../uploads')));

// Initialize database
const dbPath = path.join(__dirname, '../data/daydream.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;
let SQL;

// Initialize SQL.js
const initDB = async () => {
  SQL = await initSqlJs();

  // Load existing database or create new one
  try {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } catch {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      model TEXT DEFAULT 'stable-diffusion',
      size TEXT DEFAULT '1024x1024',
      quality TEXT DEFAULT 'standard',
      url TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chatgpt_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      session_token TEXT,
      access_token TEXT,
      status TEXT DEFAULT 'active',
      usage_count INTEGER DEFAULT 0,
      last_used_at DATETIME,
      cooldown_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate: add is_public column to images if missing
  try {
    db.exec("SELECT is_public FROM images LIMIT 1");
  } catch {
    db.run("ALTER TABLE images ADD COLUMN is_public INTEGER DEFAULT 1");
    saveDB();
  }

  // Migrate: add credits column to users if missing
  try {
    db.exec("SELECT credits FROM users LIMIT 1");
  } catch {
    db.run("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100");
    saveDB();
  }

  // Migrate: add last_checkin_date column to users if missing
  try {
    db.exec("SELECT last_checkin_date FROM users LIMIT 1");
  } catch {
    db.run("ALTER TABLE users ADD COLUMN last_checkin_date DATE");
    saveDB();
  }

  // Migrate: create image_likes table
  db.run(`
    CREATE TABLE IF NOT EXISTS image_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(image_id, user_id)
    );
  `);
  saveDB();

  // Create verification_codes table for email login
  db.run(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
  `);
  saveDB();

  // Create text prompt optimization history table
  db.run(`
    CREATE TABLE IF NOT EXISTS text_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      model TEXT DEFAULT 'gpt-5.5',
      cost INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  saveDB();

  // Create Cloudflare temp-mail registrar mailbox table
  db.run(`
    CREATE TABLE IF NOT EXISTS registrar_mailboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      domain TEXT,
      mail_jwt TEXT,
      provider TEXT DEFAULT 'cloudflare-temp-mail',
      status TEXT DEFAULT 'created',
      verification_code TEXT,
      verification_link TEXT,
      last_mail_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  saveDB();

  // Migrate: add nickname column to users if missing
  try {
    db.exec("SELECT nickname FROM users LIMIT 1");
  } catch {
    db.run("ALTER TABLE users ADD COLUMN nickname TEXT");
    saveDB();
  }

  // Migrate: add invite_code column to users if missing
  try {
    db.exec("SELECT invite_code FROM users LIMIT 1");
  } catch {
    db.run("ALTER TABLE users ADD COLUMN invite_code TEXT");
    saveDB();
  }

  // Create system settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  saveDB();

  // Default: allow registration
  const regSetting = getOne("SELECT value FROM settings WHERE key = 'allow_registration'");
  if (!regSetting) {
    db.run("INSERT INTO settings (key, value) VALUES ('allow_registration', '1')");
    saveDB();
  }

  // Assign invite codes to users missing one
  const usersWithoutCode = getAll("SELECT id FROM users WHERE invite_code IS NULL OR invite_code = ''");
  usersWithoutCode.forEach(u => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    db.run("UPDATE users SET invite_code = ? WHERE id = ?", [code, u.id]);
  });
  if (usersWithoutCode.length > 0) saveDB();

  // Auto-recover accounts whose cooldown has expired
  db.run("UPDATE chatgpt_accounts SET status = 'active', cooldown_until = NULL WHERE status = 'limited' AND cooldown_until IS NOT NULL AND cooldown_until < datetime('now')");
  saveDB();

  // Create default admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const adminExists = db.exec('SELECT id FROM users WHERE username = ?', [adminUsername]);

  if (adminExists.length === 0 || adminExists[0].values.length === 0) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [
      adminUsername,
      hashedPassword,
      'admin'
    ]);
    saveDB();
    console.log(`✅ Default admin created: ${adminUsername} / ${adminPassword}`);
  }

  // Create default roles
  const defaultRoles = [
    {
      name: 'admin',
      description: '管理员',
      permissions: JSON.stringify(['home', 'create', 'gallery', 'account', 'settings', 'admin-users', 'admin-accounts', 'admin-registrar', 'admin-roles', 'admin-logs'])
    },
    {
      name: 'user',
      description: '普通用户',
      permissions: JSON.stringify(['home', 'create', 'gallery', 'account', 'settings'])
    }
  ];

  defaultRoles.forEach(role => {
    const exists = db.exec('SELECT id FROM roles WHERE name = ?', [role.name]);
    if (exists.length === 0 || exists[0].values.length === 0) {
      db.run('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)', [
        role.name,
        role.description,
        role.permissions
      ]);
    } else {
      // 更新已存在的角色权限
      db.run('UPDATE roles SET permissions = ? WHERE name = ?', [role.permissions, role.name]);
    }
  });

  saveDB();
};

// Save database to disk
const saveDB = () => {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

// Helper to convert sql.js result to array of objects
const resultToObjects = (result) => {
  if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
    return [];
  }

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
};

// Helper to get single row
const getOne = (query, params = []) => {
  const result = db.exec(query, params);
  const objects = resultToObjects(result);
  return objects.length > 0 ? objects[0] : null;
};

// Helper to get multiple rows
const getAll = (query, params = []) => {
  const result = db.exec(query, params);
  return resultToObjects(result);
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query?.token;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== Auth Routes ====================

// Send verification code to email
app.post('/api/auth/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' });
  }

  // Check if registration is allowed for new emails
  const existingUser = getOne('SELECT id FROM users WHERE email = ?', [email]);
  if (!existingUser) {
    const regSetting = getOne("SELECT value FROM settings WHERE key = 'allow_registration'");
    if (regSetting && regSetting.value !== '1') {
      return res.status(403).json({ error: '当前已关闭注册功能' });
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  // Clean old codes for this email
  db.run('DELETE FROM verification_codes WHERE email = ?', [email]);
  db.run('INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)', [email, code, expiresAt]);
  saveDB();

  try {
    await mailTransporter.sendMail({
      from: '"Daydream Studio" <peteryuepan168@foxmail.com>',
      to: email,
      subject: 'Daydream Studio 登录验证码',
      text: `您的验证码是：${code}，5分钟内有效。`,
      html: `<p>您的验证码是：<strong style="font-size:24px;">${code}</strong></p><p>5分钟内有效，请勿泄露给他人。</p>`,
    });
    res.json({ success: true, message: '验证码已发送' });
  } catch (err) {
    console.error('Send mail error:', err);
    res.status(500).json({ error: '邮件发送失败，请稍后重试' });
  }
});

// Verify code and login/register
app.post('/api/auth/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: '请输入邮箱和验证码' });
  }

  const record = getOne(
    'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > datetime("now")',
    [email, code]
  );

  if (!record) {
    return res.status(400).json({ error: '验证码无效或已过期' });
  }

  // Delete used code
  db.run('DELETE FROM verification_codes WHERE email = ?', [email]);
  saveDB();

  // Find or create user by email
  let user = getOne('SELECT * FROM users WHERE email = ?', [email]);
  let isNewUser = false;
  if (!user) {
    const regSetting = getOne("SELECT value FROM settings WHERE key = 'allow_registration'");
    if (regSetting && regSetting.value !== '1') {
      return res.status(403).json({ error: '当前已关闭注册功能' });
    }
    isNewUser = true;
    const username = email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 6);
    const tempPassword = bcrypt.hashSync(Math.random().toString(36), 10);
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    db.run(
      'INSERT INTO users (username, password, email, role, credits, invite_code) VALUES (?, ?, ?, ?, ?, ?)',
      [username, tempPassword, email, 'user', 100, inviteCode]
    );
    saveDB();
    user = getOne('SELECT * FROM users WHERE email = ?', [email]);
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: '账号已被禁用' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  db.run('INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
    user.id,
    'login',
    isNewUser ? 'Email code register & login' : 'Email code login',
    req.ip
  ]);
  saveDB();

  // 获取角色的权限信息
  const roleInfo = getOne('SELECT permissions FROM roles WHERE name = ?', [user.role]);
  let permissions = ['home', 'create', 'gallery', 'account', 'settings'];
  if (roleInfo && roleInfo.permissions) {
    try {
      permissions = JSON.parse(roleInfo.permissions);
    } catch (e) {
      permissions = ['home', 'create', 'gallery', 'account', 'settings'];
    }
  }

  res.json({
    token,
    isNewUser,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      invite_code: user.invite_code,
      created_at: user.created_at,
      permissions
    }
  });
});

// Verify code without side effects (for forgot password)
app.post('/api/auth/verify-code-only', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: '请输入邮箱和验证码' });
  }
  const record = getOne(
    'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > datetime("now")',
    [email, code]
  );
  if (!record) {
    return res.status(400).json({ error: '验证码无效或已过期' });
  }
  res.json({ success: true });
});

// Reset password
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  const record = getOne(
    'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > datetime("now")',
    [email, code]
  );
  if (!record) {
    return res.status(400).json({ error: '验证码无效或已过期' });
  }

  db.run('DELETE FROM verification_codes WHERE email = ?', [email]);

  const user = getOne('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(400).json({ error: '该邮箱未注册' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, user.id]);
  saveDB();

  res.json({ success: true, message: '密码重置成功' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  const user = getOne('SELECT * FROM users WHERE username = ? AND status = ?', [username, 'active']);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  db.run('INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
    user.id,
    'login',
    'User logged in',
    req.ip
  ]);
  saveDB();

  // 获取角色的权限信息
  const roleInfo = getOne('SELECT permissions FROM roles WHERE name = ?', [user.role]);
  let permissions = ['home', 'create', 'gallery', 'account', 'settings'];
  if (roleInfo && roleInfo.permissions) {
    try {
      permissions = JSON.parse(roleInfo.permissions);
    } catch (e) {
      permissions = ['home', 'create', 'gallery', 'account', 'settings'];
    }
  }

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = getOne('SELECT id, username, nickname, email, role, credits, last_checkin_date, created_at, invite_code FROM users WHERE id = ?', [req.user.id]);

  // 统计生成次数
  const stats = getOne('SELECT COUNT(*) as generated_count FROM images WHERE user_id = ?', [req.user.id]);
  user.generated_count = stats?.generated_count || 0;

  // 检查今天是否已签到
  const today = new Date().toISOString().split('T')[0];
  user.can_checkin = user.last_checkin_date !== today;

  // 获取角色的权限信息
  const roleInfo = getOne('SELECT permissions FROM roles WHERE name = ?', [user.role]);
  if (roleInfo && roleInfo.permissions) {
    try {
      user.permissions = JSON.parse(roleInfo.permissions);
    } catch (e) {
      user.permissions = [];
    }
  } else {
    // 如果没有找到角色信息，给予默认权限
    user.permissions = ['home', 'create', 'gallery', 'account', 'settings'];
  }

  res.json(user);
});

// Update current user profile
app.put('/api/auth/me', authenticateToken, (req, res) => {
  const { nickname } = req.body;
  if (nickname !== undefined) {
    db.run('UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nickname, req.user.id]);
    saveDB();
  }
  const user = getOne('SELECT id, username, nickname, email, role, credits, last_checkin_date, created_at, invite_code FROM users WHERE id = ?', [req.user.id]);

  // 统计生成次数
  const stats = getOne('SELECT COUNT(*) as generated_count FROM images WHERE user_id = ?', [req.user.id]);
  user.generated_count = stats?.generated_count || 0;

  res.json(user);
});

// Change password
app.post('/api/auth/change-password', authenticateToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '请输入旧密码和新密码' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少为6位' });
  }

  const user = getOne('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // 验证旧密码（使用 bcrypt）
  const isOldPasswordValid = bcrypt.compareSync(oldPassword, user.password);
  if (!isOldPasswordValid) {
    return res.status(400).json({ error: '旧密码错误' });
  }

  // 更新新密码（使用 bcrypt 加密）
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);
  saveDB();

  res.json({ success: true, message: '密码修改成功' });
});

// Bind email with verification code
app.post('/api/auth/bind-email', authenticateToken, (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: '请输入邮箱和验证码' });
  }

  // Verify the code
  const record = getOne(
    'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > datetime("now")',
    [email, code]
  );

  if (!record) {
    return res.status(400).json({ error: '验证码无效或已过期' });
  }

  // Check if email is already bound to another user
  const existingUser = getOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
  if (existingUser) {
    return res.status(400).json({ error: '该邮箱已被其他账号绑定' });
  }

  // Bind email to current user
  db.run('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [email, req.user.id]);

  // Delete used code
  db.run('DELETE FROM verification_codes WHERE email = ?', [email]);

  // Reward credits for binding email
  db.run('UPDATE users SET credits = credits + 50 WHERE id = ?', [req.user.id]);

  saveDB();

  db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)', [
    req.user.id,
    'bind_email',
    `Bound email ${email}, rewarded 50 credits`
  ]);
  saveDB();

  res.json({ success: true, message: '邮箱绑定成功，获得 50 积分奖励' });
});

// Admin settings endpoints
app.get('/api/admin/settings', authenticateToken, requireAdmin, (req, res) => {
  const rows = getAll('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  db.run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP", [key, String(value)]);
  saveDB();
  res.json({ success: true });
});

// Admin user management endpoints
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const users = getAll('SELECT id, username, nickname, email, role, credits, last_checkin_date, created_at FROM users ORDER BY created_at DESC');
  res.json(users);
});

app.post('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, nickname, email, role, credits } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  // 检查用户名是否已存在
  const existing = getOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const inviteCode = crypto.randomBytes(4).toString('hex');

  db.run(
    'INSERT INTO users (username, password, nickname, email, role, credits, invite_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, passwordHash, nickname || username, email || null, role || 'user', credits || 100, inviteCode]
  );
  saveDB();

  const newUser = getOne('SELECT id, username, nickname, email, role, credits, created_at FROM users WHERE username = ?', [username]);
  res.json(newUser);
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { nickname, email, role, credits } = req.body;

  const user = getOne('SELECT id FROM users WHERE id = ?', [id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const updates = [];
  const values = [];

  if (nickname !== undefined) {
    updates.push('nickname = ?');
    values.push(nickname);
  }
  if (email !== undefined) {
    updates.push('email = ?');
    values.push(email);
  }
  if (role !== undefined) {
    updates.push('role = ?');
    values.push(role);
  }
  if (credits !== undefined) {
    updates.push('credits = ?');
    values.push(credits);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDB();
  }

  const updated = getOne('SELECT id, username, nickname, email, role, credits, created_at FROM users WHERE id = ?', [id]);
  res.json(updated);
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  // 不能删除自己
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: '不能删除自己的账号' });
  }

  const user = getOne('SELECT id FROM users WHERE id = ?', [id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  db.run('DELETE FROM users WHERE id = ?', [id]);
  saveDB();

  res.json({ success: true, message: '用户已删除' });
});

// Admin account pool management endpoints
app.get('/api/admin/accounts', authenticateToken, requireAdmin, (req, res) => {
  const accounts = getAll('SELECT id, email, status, session_token, access_token, usage_count, last_used_at, cooldown_until, created_at FROM chatgpt_accounts ORDER BY created_at DESC');
  // 不返回完整 token，只返回是否存在
  const safeAccounts = accounts.map(acc => ({
    ...acc,
    hasSessionToken: !!acc.session_token,
    hasAccessToken: !!acc.access_token,
    session_token: undefined,
    access_token: undefined
  }));
  res.json(safeAccounts);
});

app.post('/api/admin/accounts', authenticateToken, requireAdmin, (req, res) => {
  const { email, session_token, access_token } = req.body;

  if (!email || !session_token) {
    return res.status(400).json({ error: '邮箱和 session_token 不能为空' });
  }

  // 检查邮箱是否已存在
  const existing = getOne('SELECT id FROM chatgpt_accounts WHERE email = ?', [email]);
  if (existing) {
    return res.status(400).json({ error: '该邮箱账号已存在' });
  }

  db.run(
    'INSERT INTO chatgpt_accounts (email, session_token, access_token, status, usage_count) VALUES (?, ?, ?, ?, ?)',
    [email, session_token, access_token || null, 'active', 0]
  );
  saveDB();

  const newAccount = getOne('SELECT id, email, status, usage_count, created_at FROM chatgpt_accounts WHERE email = ?', [email]);
  res.json(newAccount);
});

app.put('/api/admin/accounts/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { email, session_token, access_token, status } = req.body;

  const account = getOne('SELECT id FROM chatgpt_accounts WHERE id = ?', [id]);
  if (!account) {
    return res.status(404).json({ error: '账号不存在' });
  }

  const updates = [];
  const values = [];

  if (email !== undefined) {
    updates.push('email = ?');
    values.push(email);
  }
  if (session_token !== undefined) {
    updates.push('session_token = ?');
    values.push(session_token);
  }
  if (access_token !== undefined) {
    updates.push('access_token = ?');
    values.push(access_token);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.run(`UPDATE chatgpt_accounts SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDB();
  }

  const updated = getOne('SELECT id, email, status, usage_count, last_used_at, created_at FROM chatgpt_accounts WHERE id = ?', [id]);
  res.json(updated);
});

app.delete('/api/admin/accounts/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  const account = getOne('SELECT id FROM chatgpt_accounts WHERE id = ?', [id]);
  if (!account) {
    return res.status(404).json({ error: '账号不存在' });
  }

  db.run('DELETE FROM chatgpt_accounts WHERE id = ?', [id]);
  saveDB();

  res.json({ success: true, message: '账号已删除' });
});

// ==================== Cloudflare 临时邮箱注册机 ====================

const getTempMailConfig = () => {
  const workerUrl = String(
    process.env.TEMP_MAIL_WORKER_URL
    || process.env.CLOUDFLARE_TEMP_MAIL_URL
    || ''
  ).trim().replace(/\/+$/, '');
  const adminAuth = String(
    process.env.TEMP_MAIL_ADMIN_AUTH
    || process.env.CLOUDFLARE_TEMP_MAIL_ADMIN_AUTH
    || ''
  ).trim();
  const domain = String(process.env.TEMP_MAIL_DOMAIN || 'edu.peterlinux.com').trim().toLowerCase();
  const enablePrefix = String(process.env.TEMP_MAIL_ENABLE_PREFIX ?? 'true').toLowerCase() !== 'false';

  return { workerUrl, adminAuth, domain, enablePrefix };
};

const maskSecret = (value = '') => {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return `${text.slice(0, 2)}****`;
  return `${text.slice(0, 4)}****${text.slice(-4)}`;
};

const publicTempMailConfig = () => {
  const config = getTempMailConfig();
  return {
    configured: Boolean(config.workerUrl && config.adminAuth),
    workerUrlConfigured: Boolean(config.workerUrl),
    adminAuthConfigured: Boolean(config.adminAuth),
    workerUrl: config.workerUrl,
    adminAuthMasked: maskSecret(config.adminAuth),
    domain: config.domain,
    enablePrefix: config.enablePrefix
  };
};

const createHttpError = (message, status = 500, details = null) => {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
};

const buildTempMailUrl = (pathName, query = {}) => {
  const { workerUrl } = getTempMailConfig();
  const endpoint = `${workerUrl}${pathName.startsWith('/') ? pathName : `/${pathName}`}`;
  const url = new URL(endpoint);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const parseMaybeJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const assertTempMailConfigured = () => {
  const config = getTempMailConfig();
  if (!config.workerUrl || !config.adminAuth) {
    throw createHttpError('Cloudflare 临时邮箱未配置，请在后端 .env 中配置 TEMP_MAIL_WORKER_URL 和 TEMP_MAIL_ADMIN_AUTH', 500);
  }
  return config;
};

const callTempMailAdmin = async (pathName, { method = 'GET', body = null, query = {} } = {}) => {
  assertTempMailConfigured();
  const { adminAuth } = getTempMailConfig();
  const response = await fetch(buildTempMailUrl(pathName, query), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'x-admin-auth': adminAuth
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const rawText = await response.text();
  const data = parseMaybeJson(rawText);

  if (!response.ok) {
    const message = data?.error || data?.message || rawText || `临时邮箱管理接口请求失败 (${response.status})`;
    throw createHttpError(message, response.status, data);
  }

  return data;
};

const callTempMailMailbox = async (mailJwt, pathName, { method = 'GET', body = null, query = {} } = {}) => {
  assertTempMailConfigured();
  if (!mailJwt) {
    throw createHttpError('该邮箱缺少地址 JWT，无法读取邮件', 400);
  }

  const response = await fetch(buildTempMailUrl(pathName, query), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Authorization': `Bearer ${mailJwt}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const rawText = await response.text();
  const data = parseMaybeJson(rawText);

  if (!response.ok) {
    const message = data?.error || data?.message || rawText || `临时邮箱邮件接口请求失败 (${response.status})`;
    throw createHttpError(message, response.status, data);
  }

  return data;
};

const sanitizeMailboxName = (name = '') => String(name || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._-]/g, '')
  .replace(/^[._-]+|[._-]+$/g, '')
  .slice(0, 64);

const randomMailboxName = () => `dd${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

const sanitizeDomain = (domain = '') => String(domain || '')
  .trim()
  .toLowerCase()
  .replace(/^@+/, '')
  .replace(/[^a-z0-9.-]/g, '');

const findDeepValue = (value, keys = []) => {
  const keySet = new Set(keys.map(key => key.toLowerCase()));
  const seen = new Set();

  const visit = (current) => {
    if (!current || typeof current !== 'object' || seen.has(current)) return null;
    seen.add(current);

    for (const [key, child] of Object.entries(current)) {
      if (keySet.has(key.toLowerCase()) && child !== undefined && child !== null && child !== '') {
        return child;
      }
    }

    for (const child of Array.isArray(current) ? current : Object.values(current)) {
      const found = visit(child);
      if (found !== null && found !== undefined && found !== '') return found;
    }
    return null;
  };

  return visit(value);
};

const extractEmailFromResponse = (data, fallbackEmail) => {
  const direct = findDeepValue(data, ['email', 'address', 'mail', 'mailAddress']);
  const text = typeof direct === 'string' ? direct : JSON.stringify(data || '');
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : fallbackEmail.toLowerCase();
};

const extractJwtFromResponse = (data) => {
  const direct = findDeepValue(data, ['jwt', 'token', 'addressJwt', 'address_jwt', 'accessToken', 'access_token', 'password']);
  const directText = typeof direct === 'string' ? direct.trim() : '';
  if (directText) return directText;

  const text = typeof data === 'string' ? data : JSON.stringify(data || '');
  const jwtMatch = text.match(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/);
  return jwtMatch ? jwtMatch[0] : '';
};

const redactTempMailResponse = (value) => {
  const secretKeys = new Set(['jwt', 'token', 'addressjwt', 'address_jwt', 'accesstoken', 'access_token', 'password']);
  if (Array.isArray(value)) return value.map(redactTempMailResponse);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (secretKeys.has(key.toLowerCase())) return [key, maskSecret(child)];
    return [key, redactTempMailResponse(child)];
  }));
};

const normalizeTempMailItems = (data) => {
  if (Array.isArray(data)) return data;
  const candidates = [
    data?.items,
    data?.mails,
    data?.mail,
    data?.messages,
    data?.results,
    data?.data,
    data?.data?.items,
    data?.data?.mails,
    data?.data?.messages,
    data?.data?.results
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (data && typeof data === 'object') {
    const arrayValue = Object.values(data).find(Array.isArray);
    if (arrayValue) return arrayValue;
  }

  return [];
};

const decodeQuotedPrintable = (text = '') => {
  const input = String(text || '').replace(/=\r?\n/g, '');
  const binary = input.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  try {
    const decoded = Buffer.from(binary, 'binary').toString('utf8');
    return decoded.includes('�') ? binary : decoded;
  } catch {
    return binary;
  }
};

const decodeMimeWords = (text = '') => String(text || '').replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, encoding, payload) => {
  try {
    if (encoding.toUpperCase() === 'B') {
      return Buffer.from(payload, 'base64').toString(charset.toLowerCase().includes('gb') ? 'latin1' : 'utf8');
    }
    const qp = payload.replace(/_/g, ' ');
    return decodeQuotedPrintable(qp);
  } catch {
    return payload;
  }
});

const decodeHtmlEntities = (text = '') => String(text || '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

const extractHeader = (raw = '', headerName = '') => {
  const escaped = headerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(raw || '').match(new RegExp(`^${escaped}:\\s*([\\s\\S]*?)(?:\\r?\\n(?![\\t ])|$)`, 'im'));
  if (!match) return '';
  return decodeMimeWords(match[1].replace(/\r?\n[\t ]+/g, ' ').trim());
};

const normalizeMailText = (value = '') => decodeHtmlEntities(decodeQuotedPrintable(decodeMimeWords(String(value || ''))))
  .replace(/\\u003d/g, '=')
  .replace(/\\u0026/g, '&')
  .replace(/=3D/gi, '=')
  .replace(/=26/gi, '&');

const getMailRawText = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.raw || item.rawText || item.text || item.html || item.content || item.body || item.source || JSON.stringify(item);
};

const extractVerificationSignalsFromText = (text = '') => {
  const normalized = normalizeMailText(text)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const codeRegexes = [
    /(?:verification|verify|confirm(?:ation)?|security|login|one-time|temporary|auth(?:entication)?|code|验证码|校验码|确认码|临时|安全)[^0-9]{0,160}(\d{6})/ig,
    /(\d{3})\s*[\-–— ]\s*(\d{3})/g,
    /\b(\d{6})\b/g
  ];
  let code = '';
  for (const regex of codeRegexes) {
    const matches = [...normalized.matchAll(regex)];
    if (matches.length > 0) {
      const first = matches[0];
      const compact = first.length >= 3 && first[1] && first[2]
        ? `${first[1]}${first[2]}`
        : (first[1] || first[0]).replace(/\D/g, '');
      if (/^\d{6}$/.test(compact)) {
        code = compact;
        break;
      }
    }
  }

  const links = normalized.match(/https?:\/\/[^\s"'<>）)]+/g) || [];
  const cleanLinks = links.map(link => link.replace(/[.,;]+$/g, '').replace(/&amp;/g, '&'));
  const link = cleanLinks.find(item => /openai|chatgpt|auth0|oaistatic/i.test(item)) || cleanLinks[0] || '';

  return { code, link, text: normalized };
};

const formatTempMailItem = (item) => {
  const raw = getMailRawText(item);
  const normalized = normalizeMailText(raw);
  const signals = extractVerificationSignalsFromText([
    item?.subject,
    item?.from,
    item?.sender,
    normalized
  ].filter(Boolean).join('\n'));

  return {
    id: item?.id || item?.messageId || item?.message_id || item?.uid || item?.key || crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 16),
    subject: decodeMimeWords(item?.subject || extractHeader(raw, 'Subject') || ''),
    from: decodeMimeWords(item?.from || item?.sender || extractHeader(raw, 'From') || ''),
    to: decodeMimeWords(item?.to || item?.recipient || extractHeader(raw, 'To') || ''),
    date: item?.date || item?.created_at || item?.createdAt || extractHeader(raw, 'Date') || '',
    code: signals.code,
    link: signals.link,
    preview: normalized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 260),
    raw: normalized.slice(0, 12000)
  };
};

const extractVerificationSignals = (items = []) => {
  for (const item of items) {
    if (item.code || item.link) {
      return {
        code: item.code || '',
        link: item.link || '',
        mailId: item.id,
        subject: item.subject,
        from: item.from,
        date: item.date
      };
    }
  }
  return { code: '', link: '' };
};

const safeRegistrarMailbox = (mailbox) => mailbox ? {
  id: mailbox.id,
  email: mailbox.email,
  name: mailbox.name,
  domain: mailbox.domain,
  provider: mailbox.provider,
  status: mailbox.status,
  verification_code: mailbox.verification_code,
  verification_link: mailbox.verification_link,
  last_mail_at: mailbox.last_mail_at,
  created_by: mailbox.created_by,
  created_at: mailbox.created_at,
  updated_at: mailbox.updated_at,
  hasMailJwt: Boolean(mailbox.mail_jwt)
} : null;

const resolveRegistrarMailbox = ({ id, email }) => {
  if (id) return getOne('SELECT * FROM registrar_mailboxes WHERE id = ?', [id]);
  if (email) return getOne('SELECT * FROM registrar_mailboxes WHERE email = ?', [String(email).trim().toLowerCase()]);
  return null;
};

const saveRegistrarSignals = (mailbox, signals) => {
  if (!mailbox || (!signals.code && !signals.link)) return;
  db.run(
    `UPDATE registrar_mailboxes
     SET verification_code = ?, verification_link = ?, last_mail_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [signals.code || mailbox.verification_code || null, signals.link || mailbox.verification_link || null, mailbox.id]
  );
  saveDB();
};

app.get('/api/admin/registrar/config', authenticateToken, requireAdmin, (req, res) => {
  res.json(publicTempMailConfig());
});

app.get('/api/admin/registrar/mailboxes', authenticateToken, requireAdmin, (req, res) => {
  const rows = getAll(`
    SELECT * FROM registrar_mailboxes
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `);
  res.json({ items: rows.map(safeRegistrarMailbox), total: rows.length });
});

app.post('/api/admin/registrar/address', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = assertTempMailConfigured();
    const name = sanitizeMailboxName(req.body?.name) || randomMailboxName();
    const domain = sanitizeDomain(req.body?.domain) || config.domain;
    const enablePrefix = req.body?.enablePrefix === undefined ? config.enablePrefix : Boolean(req.body.enablePrefix);

    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(name)) {
      return res.status(400).json({ error: '邮箱名称只能包含小写字母、数字、点、下划线和横线，长度 2-64 位' });
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return res.status(400).json({ error: '邮箱域名格式不正确' });
    }

    const remote = await callTempMailAdmin('/admin/new_address', {
      method: 'POST',
      body: { enablePrefix, name, domain }
    });

    const fallbackEmail = `${name}@${domain}`;
    const email = extractEmailFromResponse(remote, fallbackEmail);
    const mailJwt = extractJwtFromResponse(remote);

    if (!mailJwt) {
      throw createHttpError('临时邮箱接口未返回地址 JWT，无法后续读取邮件', 502, redactTempMailResponse(remote));
    }

    db.run(
      `INSERT INTO registrar_mailboxes (email, name, domain, mail_jwt, provider, status, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         domain = excluded.domain,
         mail_jwt = excluded.mail_jwt,
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
      [email, name, domain, mailJwt, 'cloudflare-temp-mail', 'created', req.user.id]
    );
    saveDB();

    const mailbox = getOne('SELECT * FROM registrar_mailboxes WHERE email = ?', [email]);
    db.run('INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
      req.user.id,
      'registrar_create_mailbox',
      `Created temp mailbox: ${email}`,
      req.ip
    ]);
    saveDB();

    res.json({
      success: true,
      mailbox: safeRegistrarMailbox(mailbox),
      remote: redactTempMailResponse(remote)
    });
  } catch (err) {
    console.error('Registrar create address error:', err);
    res.status(err.status || 500).json({ error: err.message || '创建临时邮箱失败', details: err.details ? redactTempMailResponse(err.details) : undefined });
  }
});

app.get('/api/admin/registrar/mails', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mailbox = resolveRegistrarMailbox({ id: req.query.mailboxId || req.query.id, email: req.query.email });
    if (!mailbox) return res.status(404).json({ error: '邮箱记录不存在，请先创建临时邮箱' });

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const remote = await callTempMailMailbox(mailbox.mail_jwt, '/api/mails', { query: { limit, offset } });
    const items = normalizeTempMailItems(remote).map(formatTempMailItem);
    const signals = extractVerificationSignals(items);
    saveRegistrarSignals(mailbox, signals);

    const updatedMailbox = getOne('SELECT * FROM registrar_mailboxes WHERE id = ?', [mailbox.id]);
    res.json({
      mailbox: safeRegistrarMailbox(updatedMailbox),
      items,
      total: items.length,
      signals,
      remote: redactTempMailResponse(remote)
    });
  } catch (err) {
    console.error('Registrar mails error:', err);
    res.status(err.status || 500).json({ error: err.message || '读取临时邮箱邮件失败', details: err.details ? redactTempMailResponse(err.details) : undefined });
  }
});

app.post('/api/admin/registrar/extract-code', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mailbox = resolveRegistrarMailbox({ id: req.body?.mailboxId || req.body?.id, email: req.body?.email });
    if (!mailbox) return res.status(404).json({ error: '邮箱记录不存在，请先创建临时邮箱' });

    const limit = Math.min(50, Math.max(1, parseInt(req.body?.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.body?.offset, 10) || 0);
    const remote = await callTempMailMailbox(mailbox.mail_jwt, '/api/mails', { query: { limit, offset } });
    const items = normalizeTempMailItems(remote).map(formatTempMailItem);
    const signals = extractVerificationSignals(items);
    saveRegistrarSignals(mailbox, signals);

    const updatedMailbox = getOne('SELECT * FROM registrar_mailboxes WHERE id = ?', [mailbox.id]);
    res.json({ success: Boolean(signals.code || signals.link), mailbox: safeRegistrarMailbox(updatedMailbox), signals, items });
  } catch (err) {
    console.error('Registrar extract-code error:', err);
    res.status(err.status || 500).json({ error: err.message || '提取验证码失败', details: err.details ? redactTempMailResponse(err.details) : undefined });
  }
});

app.post('/api/admin/registrar/save-account', authenticateToken, requireAdmin, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const sessionToken = String(req.body?.session_token || '').trim();
  const accessToken = String(req.body?.access_token || '').trim();
  const status = ['active', 'limited', 'invalid'].includes(req.body?.status) ? req.body.status : 'active';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '请提供有效邮箱' });
  }

  const existing = getOne('SELECT id FROM chatgpt_accounts WHERE email = ?', [email]);
  if (!existing && !sessionToken) {
    return res.status(400).json({ error: '新账号必须填写 session_token，才能加入 ChatGPT 账号池' });
  }

  if (existing) {
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    if (sessionToken) {
      updates.push('session_token = ?');
      values.push(sessionToken);
    }
    if (accessToken) {
      updates.push('access_token = ?');
      values.push(accessToken);
    }
    values.push(existing.id);
    db.run(`UPDATE chatgpt_accounts SET ${updates.join(', ')} WHERE id = ?`, values);
  } else {
    db.run(
      'INSERT INTO chatgpt_accounts (email, session_token, access_token, status, usage_count) VALUES (?, ?, ?, ?, ?)',
      [email, sessionToken, accessToken || null, status, 0]
    );
  }
  saveDB();

  db.run('INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
    req.user.id,
    existing ? 'registrar_update_account' : 'registrar_save_account',
    `${existing ? 'Updated' : 'Saved'} ChatGPT account from registrar: ${email}`,
    req.ip
  ]);
  saveDB();

  const account = getOne('SELECT id, email, status, usage_count, created_at, updated_at FROM chatgpt_accounts WHERE email = ?', [email]);
  res.json({ success: true, account, updated: Boolean(existing) });
});

app.delete('/api/admin/registrar/mailboxes/:id', authenticateToken, requireAdmin, (req, res) => {
  const mailbox = getOne('SELECT id, email FROM registrar_mailboxes WHERE id = ?', [req.params.id]);
  if (!mailbox) return res.status(404).json({ error: '邮箱记录不存在' });

  db.run('DELETE FROM registrar_mailboxes WHERE id = ?', [req.params.id]);
  saveDB();
  res.json({ success: true, message: '本地邮箱记录已删除' });
});

// ==================== 角色管理 ====================
// Get all roles
app.get('/api/admin/roles', authenticateToken, requireAdmin, (req, res) => {
  const roles = getAll('SELECT * FROM roles ORDER BY created_at DESC');
  res.json(roles);
});

// Create role
app.post('/api/admin/roles', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, permissions } = req.body;

  if (!name) {
    return res.status(400).json({ error: '角色名称不能为空' });
  }

  // Check if role name already exists
  const existing = getOne('SELECT id FROM roles WHERE name = ?', [name]);
  if (existing) {
    return res.status(400).json({ error: '角色名称已存在' });
  }

  db.run(
    'INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)',
    [name, description || '', permissions || '[]']
  );
  saveDB();

  const newRole = getOne('SELECT * FROM roles WHERE name = ?', [name]);
  res.json(newRole);
});

// Update role
app.put('/api/admin/roles/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  const role = getOne('SELECT * FROM roles WHERE id = ?', [id]);
  if (!role) {
    return res.status(404).json({ error: '角色不存在' });
  }

  // If updating name, check for duplicates
  if (name && name !== role.name) {
    const existing = getOne('SELECT id FROM roles WHERE name = ? AND id != ?', [name, id]);
    if (existing) {
      return res.status(400).json({ error: '角色名称已存在' });
    }
  }

  db.run(
    'UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?',
    [name || role.name, description !== undefined ? description : role.description, permissions !== undefined ? permissions : role.permissions, id]
  );
  saveDB();

  const updated = getOne('SELECT * FROM roles WHERE id = ?', [id]);
  res.json(updated);
});

// Delete role
app.delete('/api/admin/roles/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  const role = getOne('SELECT name FROM roles WHERE id = ?', [id]);
  if (!role) {
    return res.status(404).json({ error: '角色不存在' });
  }

  // Prevent deleting admin role
  if (role.name === 'admin') {
    return res.status(400).json({ error: '不能删除管理员角色' });
  }

  // Check if any users have this role
  const usersWithRole = getOne('SELECT COUNT(*) as count FROM users WHERE role = ?', [role.name]);
  if (usersWithRole.count > 0) {
    return res.status(400).json({ error: `有 ${usersWithRole.count} 个用户使用此角色，无法删除` });
  }

  db.run('DELETE FROM roles WHERE id = ?', [id]);
  saveDB();

  res.json({ success: true, message: '角色已删除' });
});

app.post('/api/checkin', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const user = getOne('SELECT last_checkin_date, credits FROM users WHERE id = ?', [req.user.id]);

  if (user.last_checkin_date === today) {
    return res.status(400).json({ error: '今日已签到', code: 'ALREADY_CHECKED_IN' });
  }

  db.run('UPDATE users SET credits = credits + 20, last_checkin_date = ? WHERE id = ?', [today, req.user.id]);
  saveDB();

  db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)', [
    req.user.id,
    'checkin',
    `Daily checkin +20 credits on ${today}`
  ]);
  saveDB();

  const updated = getOne('SELECT credits, last_checkin_date FROM users WHERE id = ?', [req.user.id]);
  res.json({ success: true, credits: updated.credits, last_checkin_date: updated.last_checkin_date, reward: 20 });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  db.run('INSERT INTO logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
    req.user.id,
    'logout',
    'User logged out',
    req.ip
  ]);
  saveDB();
  res.json({ message: 'Logged out successfully' });
});

// ==================== User Routes ====================

app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const users = getAll('SELECT id, username, email, role, status, credits, created_at FROM users ORDER BY created_at DESC');
  res.json({ items: users, total: users.length });
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, email, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    db.run('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', [
      username,
      hashedPassword,
      email || null,
      role || 'user'
    ]);
    saveDB();

    db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)', [
      req.user.id,
      'create_user',
      `Created user: ${username}`
    ]);
    saveDB();

    const newUser = getOne('SELECT id, username, email, role FROM users WHERE username = ?', [username]);
    res.json(newUser);
  } catch (error) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { email, role, status, credits } = req.body;

  db.run('UPDATE users SET email = ?, role = ?, status = ?, credits = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    email,
    role,
    status,
    credits !== undefined ? credits : getOne('SELECT credits FROM users WHERE id = ?', [id]).credits,
    id
  ]);
  saveDB();

  db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)', [
    req.user.id,
    'update_user',
    `Updated user ID: ${id}`
  ]);
  saveDB();

  res.json({ message: 'User updated successfully' });
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM users WHERE id = ?', [id]);
  saveDB();

  db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)', [
    req.user.id,
    'delete_user',
    `Deleted user ID: ${id}`
  ]);
  saveDB();

  res.json({ message: 'User deleted successfully' });
});

// ==================== Account Pool Routes ====================

// ==================== Role Routes ====================

app.get('/api/roles', authenticateToken, requireAdmin, (req, res) => {
  const roles = getAll('SELECT * FROM roles ORDER BY created_at DESC');
  res.json({ items: roles, total: roles.length });
});

app.post('/api/roles', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, permissions } = req.body;

  try {
    db.run('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)', [
      name,
      description || null,
      JSON.stringify(permissions || [])
    ]);
    saveDB();

    const newRole = getOne('SELECT * FROM roles WHERE name = ?', [name]);
    res.json(newRole);
  } catch (error) {
    res.status(400).json({ error: 'Role name already exists' });
  }
});

app.put('/api/roles/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  db.run('UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?', [
    name,
    description,
    JSON.stringify(permissions),
    id
  ]);
  saveDB();

  res.json({ message: 'Role updated successfully' });
});

app.delete('/api/roles/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM roles WHERE id = ?', [id]);
  saveDB();

  res.json({ message: 'Role deleted successfully' });
});

// ==================== Log Routes ====================

app.get('/api/logs', authenticateToken, requireAdmin, (req, res) => {
  const logs = getAll(`
    SELECT l.*, u.username
    FROM logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
    LIMIT 1000
  `);

  res.json({ items: logs, total: logs.length });
});

// ==================== Image Routes ====================

// Helper: Get available account from pool (round-robin, auto-recovers expired cooldowns)
const getAvailableAccount = () => {
  // Auto-recover accounts whose cooldown has expired before selecting
  db.run("UPDATE chatgpt_accounts SET status = 'active', cooldown_until = NULL WHERE status = 'limited' AND cooldown_until IS NOT NULL AND cooldown_until < datetime('now')");
  saveDB();

  // Get active accounts with valid session_token, ordered by least recently used
  const account = getOne(`
    SELECT * FROM chatgpt_accounts
    WHERE status = 'active'
    AND session_token IS NOT NULL
    AND session_token != ''
    AND (cooldown_until IS NULL OR cooldown_until < CURRENT_TIMESTAMP)
    ORDER BY COALESCE(last_used_at, '1970-01-01') ASC, usage_count ASC
    LIMIT 1
  `);

  console.log('✅ 找到可用账号:', account ? account.email : 'null');

  return account;
};

// Helper: Update account usage
const updateAccountUsage = (accountId, success = true) => {
  if (success) {
    db.run('UPDATE chatgpt_accounts SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [accountId]);
  } else {
    // Mark account as rate-limited for 1 hour
    db.run("UPDATE chatgpt_accounts SET status = 'limited', cooldown_until = datetime('now', '+1 hour') WHERE id = ?", [accountId]);
  }
  saveDB();
};

const markAccountLimited = (accountId, hours = 1, reason = 'rate_limited') => {
  const safeHours = Math.max(1, Math.min(48, parseInt(hours, 10) || 1));
  db.run(
    `UPDATE chatgpt_accounts
     SET status = 'limited', cooldown_until = datetime('now', '+' || ? || ' hours'), updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [safeHours, accountId]
  );
  saveDB();
  console.log(`⏳ 账号已受限 ${safeHours} 小时 (${reason}): ${accountId}`);
};

const isImageGenerationLimitError = (error) => {
  const text = [
    error?.message,
    error?.body,
    error?.response,
    error?.details,
    error?.stack
  ].filter(Boolean).join('\n').toLowerCase();
  return text.includes('free plan limit for image generations')
    || text.includes('hit the free plan limit')
    || text.includes('limit resets in')
    || text.includes('create more images when the limit resets');
};

// Helper: Apply upstream failure to account status based on HTTP code
// 401/403 -> mark as invalid
// 429     -> 1 hour cooldown
const markAccountFailure = (accountId, statusCode) => {
  if (statusCode === 401 || statusCode === 403) {
    // Mark as invalid (token expired or invalid)
    db.run("UPDATE chatgpt_accounts SET status = 'invalid' WHERE id = ?", [accountId]);
    saveDB();
    return;
  }
  // 429 rate-limit or other upstream errors: cool down for 1 hour
  updateAccountUsage(accountId, false);
};

const buildTextPrompt = ({ prompt }) => {
  return [
    '你是专业的 AI 图片提示词优化助手。你的唯一任务是把用户不完整、不准确、表达不好的想法优化成适合图片生成模型使用的高质量 prompt。',
    '要求：',
    '1. 如果用户已经有想法：直接输出一版完整、清晰、可执行、画面感强的优化 prompt。',
    '2. 如果用户只说“想画科研论文图”“想画海报”“想画产品图”等模糊需求：先给出一版通用可用 prompt，再用简短列表提示还需要补充哪些信息。',
    '3. 不要闲聊，不要写无关解释，不要返回 JSON。',
    '4. 输出结构固定为：优化后的 Prompt、还可以补充的信息。',
    '5. 优化后的 Prompt 尽量适合直接复制到图片生成输入框。',
    '6. 使用中文。',
    '',
    '用户输入：',
    String(prompt || '').trim()
  ].join('\n');
};

const trimTextConversationHistory = (userId) => {
  db.run(`
    DELETE FROM text_conversations
    WHERE user_id = ?
    AND id NOT IN (
      SELECT id FROM text_conversations
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 10
    )
  `, [userId, userId]);
};

const saveTextConversation = (userId, prompt, response, model, cost) => {
  db.run(
    'INSERT INTO text_conversations (user_id, prompt, response, model, cost) VALUES (?, ?, ?, ?, ?)',
    [userId, prompt, response, model, cost]
  );
  trimTextConversationHistory(userId);
  saveDB();
  return getOne(`
    SELECT id, prompt, response, model, cost, created_at
    FROM text_conversations
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `, [userId]);
};

const getTextHistory = (userId) => getAll(`
  SELECT id, prompt, response, model, cost, created_at
  FROM (
    SELECT id, prompt, response, model, cost, created_at
    FROM text_conversations
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  )
  ORDER BY created_at ASC, id ASC
`, [userId]);

app.get('/api/text/history', authenticateToken, (req, res) => {
  res.json({ items: getTextHistory(req.user.id), limit: 10 });
});

// Text prompt assistant: waits for complete GPT response, then returns one final SSE result
app.post('/api/text/stream', authenticateToken, async (req, res) => {
  const { prompt } = req.body || {};
  const model = 'gpt-5.5';
  const cost = 5;

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const userRecord = getOne('SELECT credits FROM users WHERE id = ?', [req.user.id]);
  const currentCredits = userRecord ? (userRecord.credits || 0) : 0;
  if (currentCredits < cost) {
    return res.status(402).json({
      error: `积分不足，当前 ${currentCredits}，需要 ${cost}`,
      code: 'INSUFFICIENT_CREDITS',
      currentCredits,
      requiredCredits: cost
    });
  }

  db.run('UPDATE users SET credits = credits - ? WHERE id = ?', [cost, req.user.id]);
  saveDB();

  const account = getAvailableAccount();
  if (!account) {
    db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [cost, req.user.id]);
    saveDB();
    return res.status(503).json({ error: '当前没有可用 GPT 账号，请稍后重试' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: meta\ndata: ${JSON.stringify({ account: account.email, model })}\n\n`);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let closed = false;
  res.on('close', () => {
    closed = !res.writableEnded;
  });
  const canWrite = () => !closed && !res.destroyed && !res.writableEnded;

  try {
    const finalText = await textClient.streamText(
      buildTextPrompt({ prompt }),
      account,
      { model },
      () => {}
    );

    if (!finalText || !String(finalText).trim()) {
      throw new Error('文字链路没有返回有效优化结果，请稍后重试');
    }

    updateAccountUsage(account.id, true);
    const record = saveTextConversation(req.user.id, String(prompt).trim(), finalText, model, cost);
    if (canWrite()) {
      res.write(`event: done\ndata: ${JSON.stringify({ text: finalText, item: record, history: getTextHistory(req.user.id) })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error('Text stream error:', err);
    markAccountFailure(account.id, err.status || 500);
    db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [cost, req.user.id]);
    saveDB();
    if (canWrite()) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || '文字生成失败' })}\n\n`);
      res.end();
    }
  }
});

// User's own images
app.get('/api/images', authenticateToken, (req, res) => {
  const images = getAll('SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ items: images, total: images.length });
});

// Download proxy for external images (R2)
app.get('/api/images/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const image = getOne('SELECT * FROM images WHERE id = ?', [id]);

    if (!image) {
      return res.status(404).json({ error: '图片不存在' });
    }

    const imageUrl = image.url;

    // If it's an external URL (R2), proxy the download
    if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const buffer = await response.buffer();
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="daydream-${id}.png"`,
        'Content-Length': buffer.length
      });
      res.send(buffer);
    } else {
      // Local file
      const filePath = path.join(__dirname, '..', imageUrl);
      res.download(filePath, `daydream-${id}.png`);
    }
  } catch (err) {
    console.error('Download proxy error:', err);
    res.status(500).json({ error: '下载失败' });
  }
});

// Public gallery (admins see all; regular users see only public)
app.get('/api/images/gallery', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  // Try optional auth to detect admin
  let isAdmin = false;
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      isAdmin = decoded.role === 'admin';
    }
  } catch (e) {
    // invalid/expired token: treat as non-admin
  }

  const visibilityFilter = isAdmin ? '' : 'AND i.is_public = 1';
  const countFilter = isAdmin ? '' : 'AND is_public = 1';

  // Determine current user id if authenticated
  let currentUserId = null;
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUserId = decoded.id;
    }
  } catch (e) {}

  const images = getAll(`
    SELECT i.*, u.username as author,
      (SELECT COUNT(*) FROM image_likes WHERE image_id = i.id) as like_count,
      ${currentUserId ? `(SELECT 1 FROM image_likes WHERE image_id = i.id AND user_id = ${currentUserId})` : '0'} as user_liked
    FROM images i
    LEFT JOIN users u ON i.user_id = u.id
    WHERE i.status = 'completed' ${visibilityFilter}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  const totalResult = getOne(`
    SELECT COUNT(*) as count
    FROM images
    WHERE status = 'completed' ${countFilter}
  `);

  res.json({
    items: images,
    total: totalResult ? totalResult.count : 0,
    page,
    limit
  });
});

app.post('/api/images/upload-reference', authenticateToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片文件' });
  }
  try {
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const buffer = fs.readFileSync(req.file.path);
    const mime = req.file.mimetype || 'image/png';
    const url = await uploadToR2(buffer, filename, mime);
    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      url,
      name: req.file.originalname
    });
  } catch (err) {
    console.error('R2 upload-reference error:', err);
    res.status(500).json({ error: '上传失败' });
  }
});

app.post('/api/images/generate', authenticateToken, async (req, res) => {
  const { prompt, negative_prompt, model, size, quality, resolution, reference_images } = req.body;

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Normalize requested image count to 1-10
  const requestedCount = Math.min(10, Math.max(1, parseInt(req.body.n, 10) || 1));
  const costPerImage = 10;
  const totalCost = requestedCount * costPerImage;

  // Check credits
  const userRecord = getOne('SELECT credits FROM users WHERE id = ?', [req.user.id]);
  const currentCredits = userRecord ? (userRecord.credits || 0) : 0;
  if (currentCredits < totalCost) {
    return res.status(402).json({
      error: `积分不足，当前 ${currentCredits}，需要 ${totalCost}`,
      code: 'INSUFFICIENT_CREDITS',
      currentCredits,
      requiredCredits: totalCost
    });
  }

  // Deduct credits upfront
  db.run('UPDATE users SET credits = credits - ? WHERE id = ?', [totalCost, req.user.id]);
  saveDB();

  const uploadsDir = path.join(__dirname, '../uploads');
  const generationOptions = {
    model: model || 'gpt-image-2',
    size: size || 'auto',
    quality: quality || '',
    resolution: resolution || '1k',
    reference_images: reference_images || []
  };

  const imageClient = pickImageClient(generationOptions.model);
  const savedImages = [];
  const usedAccounts = [];
  let lastError = null;

  // 轮询生成：每张图都取当前最空闲的可用账号，失败则标记冷却并尝试下一张
  for (let i = 0; i < requestedCount; i++) {
    const account = getAvailableAccount();
    if (!account) {
      console.log(`⚠️ 第 ${i + 1}/${requestedCount} 张: 没有可用账号，中断`);
      break;
    }

    console.log(`🎨 第 ${i + 1}/${requestedCount} 张 使用账号: ${account.email}`);

    try {
      const results = await imageClient.generateImage(
        prompt,
        account,
        generationOptions,
        uploadsDir
      );

      for (const result of results) {
        db.run(
          'INSERT INTO images (user_id, prompt, negative_prompt, model, size, quality, url, status, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            req.user.id,
            prompt,
            negative_prompt || null,
            generationOptions.model,
            generationOptions.size,
            generationOptions.quality || 'standard',
            result.url,
            'completed',
            1
          ]
        );
        saveDB();
        const savedImage = getOne('SELECT * FROM images WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
        savedImages.push(savedImage);
      }

      // 记录成功使用
      updateAccountUsage(account.id, true);
      if (!usedAccounts.includes(account.email)) {
        usedAccounts.push(account.email);
      }
    } catch (error) {
      console.error(`❌ 第 ${i + 1}/${requestedCount} 张生成失败:`, error.message);
      lastError = error;

      if (isImageGenerationLimitError(error)) {
        markAccountLimited(account.id, 12, 'image_generation_free_plan_limit');
        // 免费生图额度用尽：跳过该账号，继续尝试下一个可用账号
        continue;
      }

      if (error.status) {
        markAccountFailure(account.id, error.status);
        // 上游错误：继续尝试下一张（用下一个账号）
        continue;
      }
      // 非上游错误（网络、本地等）：终止
      break;
    }
  }

  // 全部失败 -> refund credits
  if (savedImages.length === 0) {
    db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [totalCost, req.user.id]);
    saveDB();
    const status = lastError?.status;
    const httpStatus = status === 429 ? 429 : status === 401 || status === 403 ? 403 : 502;
    return res.status(httpStatus).json({
      error: lastError?.message || '生成图片时发生错误',
      code: 'GENERATION_FAILED'
    });
  }

  // 至少成功一张
  db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)', [
    req.user.id,
    'generate_image',
    `Generated ${savedImages.length}/${requestedCount} image(s): ${String(prompt).substring(0, 50)}...`
  ]);
  saveDB();

  console.log(`✅ 生成成功！共 ${savedImages.length} 张图片 (账号: ${usedAccounts.join(', ')})`);

  res.json({
    success: true,
    images: savedImages,
    count: savedImages.length,
    accounts_used: usedAccounts,
    partial: savedImages.length < requestedCount,
    credits_deducted: totalCost
  });
});

// Admin: update image visibility
app.put('/api/images/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { is_public } = req.body;
  db.run('UPDATE images SET is_public = ? WHERE id = ?', [is_public ? 1 : 0, id]);
  saveDB();
  res.json({ message: 'Image updated successfully' });
});

// Admin: delete image
app.delete('/api/images/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const image = getOne('SELECT * FROM images WHERE id = ?', [id]);
  if (!image) {
    return res.status(404).json({ error: '图片不存在' });
  }
  if (image.url && image.url.includes('r2.dev')) {
    try {
      const urlObj = new URL(image.url);
      const key = urlObj.pathname.substring(1);
      await deleteFromR2(key);
    } catch (e) {
      console.error('Failed to delete from R2:', e.message);
    }
  }
  db.run('DELETE FROM image_likes WHERE image_id = ?', [id]);
  db.run('DELETE FROM images WHERE id = ?', [id]);
  saveDB();
  res.json({ message: 'Image deleted successfully' });
});

// Admin: list R2 objects
app.get('/api/images/r2-objects', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keys = await listR2Objects();
    const objects = keys.map(key => ({
      key,
      url: `https://pub-0c0a96d4451640d891f0642b17ac8eb2.r2.dev/${key}`,
    }));
    res.json({ objects });
  } catch (e) {
    console.error('Failed to list R2 objects:', e.message);
    res.status(500).json({ error: 'Failed to list R2 objects' });
  }
});

// Like an image
app.post('/api/images/:id/like', authenticateToken, (req, res) => {
  const imageId = parseInt(req.params.id, 10);
  try {
    db.run('INSERT OR IGNORE INTO image_likes (image_id, user_id) VALUES (?, ?)', [imageId, req.user.id]);
    saveDB();
    const result = getOne(`
      SELECT COUNT(*) as count, EXISTS(SELECT 1 FROM image_likes WHERE image_id = ? AND user_id = ?) as liked
      FROM image_likes WHERE image_id = ?
    `, [imageId, req.user.id, imageId]);
    res.json({ liked: result.liked === 1, like_count: result.count });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// Unlike an image
app.delete('/api/images/:id/like', authenticateToken, (req, res) => {
  const imageId = parseInt(req.params.id, 10);
  try {
    db.run('DELETE FROM image_likes WHERE image_id = ? AND user_id = ?', [imageId, req.user.id]);
    saveDB();
    const result = getOne('SELECT COUNT(*) as count FROM image_likes WHERE image_id = ?', [imageId]);
    res.json({ liked: false, like_count: result.count });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// ==================== Stats Routes ====================

app.get('/api/stats', authenticateToken, (req, res) => {
  if (req.user.role === 'admin') {
    const userCount = getOne('SELECT COUNT(*) as count FROM users').count;
    const accountCount = getOne('SELECT COUNT(*) as count FROM chatgpt_accounts').count;
    const imageCount = getOne('SELECT COUNT(*) as count FROM images').count;
    const activeAccounts = getOne('SELECT COUNT(*) as count FROM chatgpt_accounts WHERE status = ?', ['active']).count;

    res.json({
      users: userCount,
      accounts: accountCount,
      images: imageCount,
      activeAccounts
    });
  } else {
    const imageCount = getOne('SELECT COUNT(*) as count FROM images WHERE user_id = ?', [req.user.id]).count;

    res.json({
      images: imageCount,
      credits: 100,
      plan: 'Free'
    });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==================== Auto Register Routes ====================

const autoRegister = new AutoRegisterService({
  configPath: path.join(__dirname, '../data/auto-register.json'),
  getPoolMetrics: () => {
    const totalResult = getOne('SELECT COUNT(*) as count FROM chatgpt_accounts');
    const activeResult = getOne("SELECT COUNT(*) as count FROM chatgpt_accounts WHERE status = 'active'");
    return {
      current_quota: (totalResult?.count || 0) * 10,
      current_available: activeResult?.count || 0,
    };
  },
  saveAccount: ({ email, access_token, status }) => {
    const existing = getOne('SELECT id FROM chatgpt_accounts WHERE email = ?', [email]);
    if (existing) {
      db.run("UPDATE chatgpt_accounts SET session_token = ?, access_token = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [access_token, access_token, status, existing.id]);
    } else {
      db.run('INSERT INTO chatgpt_accounts (email, session_token, access_token, status, usage_count) VALUES (?, ?, ?, ?, ?)',
        [email, access_token, access_token, status, 0]);
    }
    saveDB();
  },
});

app.get('/api/auto-register', authenticateToken, requireAdmin, (req, res) => {
  res.json(autoRegister.get());
});

app.post('/api/auto-register', authenticateToken, requireAdmin, (req, res) => {
  res.json(autoRegister.update(req.body));
});

app.post('/api/auto-register/start', authenticateToken, requireAdmin, (req, res) => {
  autoRegister.start();
  res.json(autoRegister.get());
});

app.post('/api/auto-register/stop', authenticateToken, requireAdmin, (req, res) => {
  autoRegister.stop();
  res.json(autoRegister.get());
});

app.post('/api/auto-register/reset', authenticateToken, requireAdmin, (req, res) => {
  autoRegister.reset();
  res.json(autoRegister.get());
});

app.get('/api/auto-register/events', authenticateToken, requireAdmin, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const sub = autoRegister.subscribe();
  let active = true;
  const send = (payload) => {
    if (!active || res.writableEnded) return;
    res.write(`data: ${payload}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };
  sub.onData(send);
  req.on('close', () => { active = false; sub.close(); });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Initialize and start server
await initDB();

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Database: ${dbPath}`);
  console.log(`👤 Admin: ${process.env.ADMIN_USERNAME || 'admin'} / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
});
