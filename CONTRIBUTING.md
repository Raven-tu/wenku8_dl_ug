# 贡献指南 / Contributing Guide

感谢您有兴趣为 wenku8_dl_ug 项目做出贡献！🎉
Thank you for your interest in contributing to the wenku8_dl_ug project! 🎉

本指南将帮助您了解如何为项目做出贡献。
This guide will help you understand how to contribute to the project.

## 目录 / Table of Contents

- [行为准则](#行为准则--code-of-conduct)
- [如何贡献](#如何贡献--how-to-contribute)
- [开发流程](#开发流程--development-workflow)
- [代码规范](#代码规范--code-standards)
- [提交 Pull Request](#提交-pull-request--submitting-pull-requests)
- [报告问题](#报告问题--reporting-issues)

## 行为准则 / Code of Conduct

在参与此项目时，请保持尊重和友好。我们致力于为所有人提供一个无骚扰的体验。
When participating in this project, please be respectful and friendly. We are committed to providing a harassment-free experience for everyone.

## 如何贡献 / How to Contribute

您可以通过以下方式为项目做出贡献：
You can contribute to the project in the following ways:

- 🐛 报告 Bug / Report bugs
- 💡 提出新功能建议 / Suggest new features
- 📝 改进文档 / Improve documentation
- 🔧 提交代码修复或新功能 / Submit code fixes or new features
- 🌐 帮助翻译 / Help with translations
- ⭐ 给项目加星 / Star the project

## 开发流程 / Development Workflow

### 1. Fork 和克隆仓库 / Fork and Clone

```bash
# Fork 项目到您的 GitHub 账户
# Fork the project to your GitHub account

# 克隆您的 fork
# Clone your fork
git clone https://github.com/YOUR_USERNAME/wenku8_dl_ug.git
cd wenku8_dl_ug

# 添加上游仓库
# Add upstream repository
git remote add upstream https://github.com/Raven-tu/wenku8_dl_ug.git
```

### 2. 安装依赖 / Install Dependencies

```bash
# 推荐使用 pnpm
# pnpm is recommended
pnpm install

# 或者使用 npm
# Or use npm
npm install
```

### 3. 创建分支 / Create a Branch

为您的改动创建一个新分支：
Create a new branch for your changes:

```bash
# 功能分支
# Feature branch
git checkout -b feature/your-feature-name

# Bug 修复分支
# Bug fix branch
git checkout -b fix/your-bug-fix
```

### 4. 进行开发 / Make Changes

```bash
# 启动开发服务器
# Start development server
pnpm dev

# 这会启动一个本地服务器，脚本会自动注入到 wenku8.net
# This starts a local server and the script will be automatically injected into wenku8.net
```

### 5. 测试您的改动 / Test Your Changes

```bash
# 运行 lint 检查
# Run lint checks
pnpm lint

# 如果有 lint 错误，尝试自动修复
# If there are lint errors, try auto-fix
pnpm lint:fix

# 构建项目
# Build the project
pnpm build

# 在实际环境中测试
# Test in actual environment
# 访问 https://www.wenku8.net/ 并测试脚本功能
# Visit https://www.wenku8.net/ and test the script functionality
```

### 6. 提交改动 / Commit Changes

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。
We use [Conventional Commits](https://www.conventionalcommits.org/) specification.

提交消息格式：
Commit message format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型 (type)：
Types:

- `feat`: 新功能 / New feature
- `fix`: Bug 修复 / Bug fix
- `docs`: 文档更新 / Documentation update
- `style`: 代码格式（不影响功能）/ Code style (no functionality change)
- `refactor`: 重构 / Refactoring
- `perf`: 性能优化 / Performance improvement
- `test`: 测试相关 / Test related
- `chore`: 构建过程或辅助工具的变动 / Build process or auxiliary tools changes

示例 / Examples:

```bash
git commit -m "feat: 添加简繁体自动检测功能"
git commit -m "fix: 修复 EPUB 图片加载问题"
git commit -m "docs: 更新安装说明"
```

### 7. 推送到 GitHub / Push to GitHub

```bash
git push origin feature/your-feature-name
```

### 8. 创建 Pull Request / Create Pull Request

1. 访问您的 fork 页面
2. 点击 "Pull Request" 按钮
3. 填写 PR 模板
4. 提交 PR

## 代码规范 / Code Standards

### JavaScript/TypeScript 规范

- 使用 ESLint 进行代码检查
- 遵循 [@antfu/eslint-config](https://github.com/antfu/eslint-config) 规范
- 使用 2 空格缩进
- 使用单引号
- 使用分号
- 合理使用注释

### 命名规范 / Naming Conventions

- 变量和函数使用 camelCase：`getUserInfo`
- 类使用 PascalCase：`EpubBuilder`
- 常量使用 UPPER_SNAKE_CASE：`MAX_RETRY_COUNT`
- 文件名使用 camelCase：`epubBuilder.js`

### 代码组织 / Code Organization

- 保持函数简短和专注
- 避免深层嵌套
- 提取重复代码为函数
- 使用有意义的变量名

## 提交 Pull Request / Submitting Pull Requests

### PR 检查清单 / PR Checklist

在提交 PR 之前，请确保：
Before submitting a PR, please ensure:

- [ ] 代码遵循项目的代码规范
- [ ] 已运行 `pnpm lint` 并通过
- [ ] 已运行 `pnpm build` 并成功
- [ ] 已在实际环境中测试改动
- [ ] 更新了相关文档（如果需要）
- [ ] 提交消息遵循 Conventional Commits 规范
- [ ] PR 描述清晰，说明了改动内容

### PR 审查流程 / PR Review Process

1. 提交 PR 后，维护者会进行审查
2. 如果需要修改，请在同一分支上进行修改并推送
3. 通过审查后，PR 会被合并到主分支

## 报告问题 / Reporting Issues

### 报告 Bug / Reporting Bugs

使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md) 报告问题时，请包括：
When reporting bugs using the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md), please include:

- 清晰的问题描述
- 重现步骤
- 预期行为和实际行为
- 环境信息（操作系统、浏览器、脚本版本）
- 控制台日志（如果有）
- 截图（如果适用）

### 功能请求 / Feature Requests

使用 [功能请求模板](.github/ISSUE_TEMPLATE/feature_request.md) 提出新功能时，请说明：
When suggesting features using the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md), please describe:

- 功能的目的和价值
- 使用场景
- 期望的实现方式
- 可能的替代方案

## 开发技巧 / Development Tips

### 调试 / Debugging

1. 使用浏览器的开发者工具
2. 在 Tampermonkey 控制台查看脚本日志
3. 使用 `console.log()` 或 `debugger` 进行调试

### 本地测试 / Local Testing

```bash
# 开发模式会自动注入脚本到 wenku8.net
# Development mode automatically injects the script into wenku8.net
pnpm dev

# 访问 https://www.wenku8.net/ 进行测试
# Visit https://www.wenku8.net/ for testing
```

### 构建和预览 / Build and Preview

```bash
# 构建生产版本
# Build production version
pnpm build

# 构建后的文件在 dist 目录
# Built files are in the dist directory
# 可以手动安装 dist/index.user.js 进行测试
# You can manually install dist/index.user.js for testing
```

## 项目结构 / Project Structure

```
wenku8_dl_ug/
├── .github/               # GitHub 配置文件
│   ├── ISSUE_TEMPLATE/    # Issue 模板
│   └── workflows/         # GitHub Actions 工作流
├── lib/                   # 第三方库
├── src/                   # 源代码
│   ├── coordinator/       # 协调器模块
│   ├── modules/           # 功能模块
│   └── main.js           # 主入口
├── .gitignore            # Git 忽略文件
├── CONTRIBUTING.md       # 贡献指南
├── eslint.config.mjs     # ESLint 配置
├── package.json          # 项目配置
├── readme.md             # 项目说明
├── tsconfig.json         # TypeScript 配置
└── vite.config.ts        # Vite 配置
```

## 获取帮助 / Getting Help

如果您有任何问题或需要帮助，可以：
If you have any questions or need help:

- 查看项目的 [README](readme.md)
- 搜索现有的 [Issues](https://github.com/Raven-tu/wenku8_dl_ug/issues)
- 创建新的 Issue 提问
- 参考原作者的 [Greasy Fork 页面](https://greasyfork.org/zh-CN/scripts/407369)

## 许可 / License

通过向此项目贡献代码，您同意您的贡献将按照项目的许可证进行许可。
By contributing to this project, you agree that your contributions will be licensed under the project's license.

---

再次感谢您的贡献！您的支持对项目的发展至关重要。❤️
Thank you again for your contribution! Your support is crucial to the project's growth. ❤️
