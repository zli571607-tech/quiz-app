/**
 * 开发日志写入工具
 *
 * 用法：
 *   node scripts/log.js "完成事项1,完成事项2" "待办事项1,待办事项2"
 *
 * 自动在 dev-logs/ 下创建或更新当天的日志文件（YYYY-MM-DD.md）。
 * 如果当天日志已存在，会在已有的完成/待办列表上追加新条目。
 */

const fs = require('fs');
const path = require('path');

const now = new Date();
const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
const year = now.getFullYear();
const month = now.getMonth() + 1;
const day = now.getDate();

const logDir = path.join(__dirname, '..', 'dev-logs');
const logFile = path.join(logDir, `${dateStr}.md`);

// 确保 dev-logs 目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 读取用户输入
const doneItems = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);
const todoItems = (process.argv[3] || '').split(',').map(s => s.trim()).filter(Boolean);
const notes = process.argv.slice(4).join(' ') || '';

// 如果日志文件已存在，读取并追加
let existingDone = [];
let existingTodo = [];
if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf-8');
  // 简单的正则提取已有的完成和待办事项
  const doneMatch = content.match(/## ✅ 完成事项\n([\s\S]*?)(?=\n## |$)/);
  const todoMatch = content.match(/## 📋 待办事项\n([\s\S]*?)(?=\n## |$)/);
  if (doneMatch) {
    existingDone = doneMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
  }
  if (todoMatch) {
    existingTodo = todoMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
  }
}

// 合并去重
const allDone = [...new Set([...existingDone, ...doneItems])];
const allTodo = [...new Set([...existingTodo, ...todoItems])];

// 生成日志内容
let logContent = `# 开发日志 - ${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日

## ✅ 完成事项
${allDone.map(item => `- ${item}`).join('\n') || '- (无)'}

## 📋 待办事项
${allTodo.map(item => `- [ ] ${item}`).join('\n') || '- (无)'}
`;

if (notes) {
  logContent += `\n## 📝 备注\n- ${notes}\n`;
} else if (fs.existsSync(logFile)) {
  // 保留原有备注
  const notesMatch = fs.readFileSync(logFile, 'utf-8').match(/## 📝 备注\n([\s\S]*?)$/);
  if (notesMatch) {
    logContent += `\n## 📝 备注\n${notesMatch[1]}`;
  }
}

fs.writeFileSync(logFile, logContent, 'utf-8');
console.log(`✅ 日志已更新：${logFile}`);
console.log(`   完成 ${allDone.length} 项，待办 ${allTodo.length} 项`);
