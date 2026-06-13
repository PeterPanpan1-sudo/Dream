/**
 * 数据库迁移脚本 - 添加 access_token 等字段
 *
 * 使用方法：
 * 1. 停止后端服务
 * 2. 运行：node migrate-database.js
 * 3. 重启后端服务
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data/daydream.db');

async function migrate() {
  console.log('🔄 开始数据库迁移...\n');

  const SQL = await initSqlJs();

  // 读取现有数据库
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // 检查字段是否已存在
  const tableInfo = db.exec('PRAGMA table_info(accounts)');
  const columns = tableInfo[0].values.map(row => row[1]);

  console.log('📋 当前 accounts 表字段：', columns.join(', '));
  console.log();

  // 需要添加的字段
  const fieldsToAdd = [
    { name: 'access_token', type: 'TEXT', default: null },
    { name: 'refresh_token', type: 'TEXT', default: null },
    { name: 'expires_at', type: 'DATETIME', default: null },
    { name: 'used_count', type: 'INTEGER', default: 0 },
    { name: 'last_used_at', type: 'DATETIME', default: null }
  ];

  let addedCount = 0;

  for (const field of fieldsToAdd) {
    if (!columns.includes(field.name)) {
      console.log(`➕ 添加字段：${field.name} (${field.type})`);
      try {
        const defaultClause = field.default !== null
          ? `DEFAULT ${typeof field.default === 'number' ? field.default : `'${field.default}'`}`
          : '';
        db.run(`ALTER TABLE accounts ADD COLUMN ${field.name} ${field.type} ${defaultClause}`);
        addedCount++;
      } catch (error) {
        console.error(`   ❌ 失败：${error.message}`);
      }
    } else {
      console.log(`✓ 字段已存在：${field.name}`);
    }
  }

  console.log();

  if (addedCount > 0) {
    // 保存数据库
    const data = db.export();
    const newBuffer = Buffer.from(data);
    fs.writeFileSync(dbPath, newBuffer);
    console.log(`✅ 成功添加 ${addedCount} 个字段，数据库已保存\n`);
  } else {
    console.log('✅ 数据库结构已是最新，无需迁移\n');
  }

  // 显示更新后的表结构
  const newTableInfo = db.exec('PRAGMA table_info(accounts)');
  console.log('📊 迁移后的 accounts 表结构：');
  newTableInfo[0].values.forEach(row => {
    console.log(`   ${row[1].padEnd(20)} ${row[2].padEnd(10)} ${row[3] ? 'NOT NULL' : ''} ${row[4] ? `DEFAULT ${row[4]}` : ''}`);
  });

  // 显示现有账号
  console.log();
  const accounts = db.exec('SELECT id, email, access_token, used_count FROM accounts');
  if (accounts.length > 0 && accounts[0].values.length > 0) {
    console.log('📋 现有账号：');
    accounts[0].values.forEach(row => {
      const hasToken = row[2] ? '✓' : '✗';
      console.log(`   ID ${row[0]}: ${row[1]} - Token: ${hasToken} (${row[2] ? row[2].substring(0, 12) + '...' : '未配置'})`);
    });
  } else {
    console.log('📋 暂无账号');
  }

  db.close();

  console.log();
  console.log('🎉 迁移完成！现在可以重启后端服务了。');
}

migrate().catch(error => {
  console.error('❌ 迁移失败：', error);
  process.exit(1);
});
