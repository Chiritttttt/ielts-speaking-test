# IELTS Speaking Practice

雅思口语在线练习平台，基于 AI 智能评估，提供专业的口语评分和个性化反馈。

## 功能特性

### 🎯 测试模式
- **Part 1**：简介与面试（4-5分钟）- 日常话题问答
- **Part 2**：个人陈述（3-4分钟）- Cue Card 话题陈述
- **Part 3**：双向讨论（4-5分钟）- 深度话题讨论
- **完整测试**：完整模拟真实雅思口语考试流程

### 🤖 AI 智能评估
- 基于 IELTS 官方评分标准
- 四维评分：流利度与连贯性 (FC)、词汇丰富度 (LR)、语法多样性 (GRA)、发音准确度 (P)
- 详细的中文反馈与改进建议
- Band 7-8 级别口语参考回答

### 🎙️ 语音功能
- **语音识别**：Whisper 语音转文字
- **语音合成**：Edge TTS 题目朗读
- **实时转录**：浏览器端实时语音识别

### 📊 题库管理
- 多话题分类题库
- AI 自动生成题目
- 难度递进设计（Easy → Medium → Hard）

### 📝 历史记录
- 测试记录保存
- 单条/批量删除
- 导出功能

### ⚙️ 个性化设置
- 音色选择（美式/英式）
- 语速调节
- 显示偏好设置

## 技术栈

- **前端**：Next.js 15、React 19、TypeScript、Tailwind CSS 4
- **UI 组件**：shadcn/ui、Radix UI、Lucide Icons
- **状态管理**：Zustand
- **数据库**：Prisma ORM + SQLite
- **AI 服务**：DeepSeek API
- **语音服务**：Whisper（语音识别）、Edge TTS（语音合成）

## 环境要求

- Node.js 20+
- npm 或 pnpm

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Chiritttttt/ielts-speaking-test.git
cd ielts-speaking-test
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件：

```env
DATABASE_URL="file:./dev.db"
DEEPSEEK_API_KEY="your-deepseek-api-key"
JWT_SECRET="your-jwt-secret"
```

### 4. 初始化数据库

```bash
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 生产部署

### 构建

```bash
npm run build
```

### 启动

```bash
npm start
```

### PM2 部署（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start npm --name "ielts-speaking" -- start

# 停止服务
pm2 stop ielts-speaking

# 重启服务
pm2 restart ielts-speaking
```

## 项目结构

```
ielts-speaking-test/
├── prisma/
│   └── schema.prisma        # 数据库模型
├── public/
│   ├── favicon.png          # 网站图标
│   └── logo.svg             # Logo
├── scripts/
│   └── whisper_service.py   # Whisper 语音识别服务
├── src/
│   ├── app/
│   │   ├── api/             # API 路由
│   │   │   ├── auth/        # 认证相关
│   │   │   ├── evaluate/    # 评估接口
│   │   │   ├── history/     # 历史记录
│   │   │   ├── questions/   # 题目管理
│   │   │   ├── transcribe/  # 语音转文字
│   │   │   ├── tts/         # 文字转语音
│   │   │   └── user/        # 用户设置
│   │   ├── globals.css      # 全局样式
│   │   ├── layout.tsx       # 根布局
│   │   └── page.tsx         # 主页面
│   ├── components/
│   │   ├── auth/            # 认证组件
│   │   └── ui/              # UI 组件
│   ├── lib/
│   │   ├── auth.ts          # 认证工具
│   │   ├── db.ts            # 数据库连接
│   │   └── deepseek.ts      # AI 服务
│   └── store/
│       └── ielts-store.ts   # 状态管理
├── .env                     # 环境变量
├── package.json
└── README.md
```

## API 接口

| 接口 | 方法 | 说明 |
|-----|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/questions` | GET | 获取题目 |
| `/api/questions/update` | PUT | 生成新题目 |
| `/api/transcribe` | POST | 语音转文字 |
| `/api/tts` | POST | 文字转语音 |
| `/api/evaluate` | POST | 评估回答 |
| `/api/evaluate-batch` | POST | 批量评估 |
| `/api/history` | GET | 获取历史记录 |
| `/api/user/settings` | GET/PUT | 用户设置 |

## IELTS 评分标准

### 流利度与连贯性 (Fluency and Coherence)
- 语速自然，表达流畅
- 逻辑连贯，观点清晰
- 恰当使用连接词和话语标记

### 词汇丰富度 (Lexical Resource)
- 词汇多样性
- 用词精准
- 习语和搭配运用

### 语法多样性 (Grammatical Range and Accuracy)
- 句式丰富度
- 复杂结构运用
- 语法准确性

### 发音准确度 (Pronunciation)
- 语音清晰度
- 语调和重音
- 断句和节奏

## 开发计划

- [ ] 支持更多 AI 模型
- [ ] 添加口语范文学习模块
- [ ] 实现学习进度追踪
- [ ] 支持移动端 PWA
- [ ] 添加社区功能

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
