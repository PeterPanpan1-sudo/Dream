/**
 * 测试图片生成功能
 *
 * 使用方法：
 * 1. 确保后端服务已启动
 * 2. 在管理端添加了有效的 ChatGPT access_token
 * 3. 运行：node test-image-generation.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_BASE = 'http://localhost:8000';
const TEST_USERNAME = 'admin';
const TEST_PASSWORD = 'admin123';

async function testImageGeneration() {
  console.log('🧪 开始测试图片生成功能...\n');

  try {
    // 1. 登录获取 token
    console.log('1️⃣ 登录系统...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USERNAME,
        password: TEST_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      throw new Error('登录失败：' + await loginResponse.text());
    }

    const { token } = await loginResponse.json();
    console.log('✅ 登录成功\n');

    // 2. 检查账号池
    console.log('2️⃣ 检查账号池...');
    const accountsResponse = await fetch(`${API_BASE}/api/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!accountsResponse.ok) {
      throw new Error('获取账号池失败：' + await accountsResponse.text());
    }

    const { items: accounts } = await accountsResponse.json();
    console.log(`📊 账号池统计：`);
    console.log(`   - 总账号数：${accounts.length}`);
    console.log(`   - 可用账号：${accounts.filter(a => a.status === 'active' && a.access_token).length}`);
    console.log(`   - 限流账号：${accounts.filter(a => a.status === 'limited').length}`);
    console.log(`   - 禁用账号：${accounts.filter(a => a.status === 'invalid').length}\n`);

    const availableAccounts = accounts.filter(a => a.status === 'active' && a.access_token);

    if (availableAccounts.length === 0) {
      console.log('❌ 没有可用账号！');
      console.log('💡 请在管理端添加有效的 ChatGPT access_token\n');
      console.log('详见：HOW_TO_GET_ACCESS_TOKEN.md\n');
      return;
    }

    console.log('✅ 找到可用账号\n');

    // 3. 测试图片生成
    console.log('3️⃣ 测试图片生成...');
    console.log('📝 提示词：a cute cat playing with yarn');

    const startTime = Date.now();
    const generateResponse = await fetch(`${API_BASE}/api/images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: 'a cute cat playing with yarn',
        model: 'gpt-4',
        size: '1024x1024',
        quality: 'standard',
        n: 1
      })
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!generateResponse.ok) {
      const error = await generateResponse.json();
      throw new Error(`生成失败：${error.error} (${error.code})`);
    }

    const result = await generateResponse.json();
    console.log(`✅ 生成成功！耗时：${duration}s\n`);

    console.log('📸 生成结果：');
    console.log(`   - 图片数量：${result.images.length}`);
    console.log(`   - 使用账号：${result.account_used}`);
    console.log(`   - 图片地址：`);
    result.images.forEach((img, i) => {
      console.log(`     ${i + 1}. ${API_BASE}${img.url}`);
    });

    console.log('\n✅ 所有测试通过！\n');
    console.log('🎉 系统已完整实现 ChatGPT 图片生成功能！');
    console.log('💡 现在可以在前端页面正常使用了\n');

  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error('\n📋 排查建议：');
    console.error('1. 确保后端服务已启动（npm start）');
    console.error('2. 确认在管理端添加了有效的 access_token');
    console.error('3. 检查 access_token 是否已过期');
    console.error('4. 查看后端控制台日志获取详细错误信息\n');
  }
}

// 运行测试
testImageGeneration();
