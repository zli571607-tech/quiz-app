# 刷题软件 - 项目开发指引

## 项目简介
Windows 桌面刷题软件，支持导入文档（PDF/Word/TXT/PPT），AI 自动生成题目，刷题练习，成绩统计和错题本功能。

## 重要文件路径
| 文件 | 路径 | 说明 |
|------|------|------|
| 需求文档 | ./docs/requirements.md | 完整功能需求清单 |
| 技术规范 | ./docs/tech-stack.md | 技术栈选型和版本 |
| UI 设计 | ./docs/ui-design.md | 界面设计规范和配色 |
| 数据库设计 | ./docs/database.md | 数据表结构和关系 |
| 开发计划 | ./docs/dev-plan.md | 分步开发执行计划 |
| 变更日志 | ./docs/changelog.md | 版本变更记录 |
| 开发日志 | ./dev-logs/ | 每日开发日志 |

## 开发原则
1. 分步推进，每步完成后验证再继续，不一口气做太多
2. 每完成一个功能模块，更新 dev-logs 日志
3. 所有代码变更同步更新 docs/changelog.md
4. 保持 UI 白色简洁风格，使用 Tailwind CSS
5. 数据库变更需同步更新 docs/database.md

## 技术栈
- Electron + React + Tailwind CSS
- better-sqlite3 本地数据库
- Claude API 用于 AI 题目生成
- 文档解析：pdf-parse, mammoth, pptx-parser

## 工作流程
1. 查看 docs/dev-plan.md 确认当前应执行的步骤
2. 完成代码编写
3. 在 dev-logs/ 下写入当天日志（文件名 = 当天日期.md）
4. 更新 docs/changelog.md 记录变更
5. 标记 docs/dev-plan.md 中已完成的任务
