# 更新日志

本项目所有显著变更记录于此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化版本。

## [0.2.1] - 2026-09-15

### 新增

- 「重命名当前会话…」入口（动作分组）：进入重命名模式后，面板输入框预填当前标题，`Enter` 确认（显式标题固定，不再自动重新生成）、`Esc` 取消；名称为空或宿主拒绝时以错误行提示并保留输入。

### 修复

- 打开面板后，鼠标悬停过某一项再用 `↑` `↓` 导航时高亮乱跳：键盘按下期间挂起 hover 高亮，仅在真实鼠标移动后恢复——列表滚动让行从静止指针下滑过时不再劫持高亮。

## [0.2.0] - 2026-09-14

### 新增

- 「侧边栏」入口分组，包含：打开侧边栏（开关，标签跟随状态）、打开文件、打开文件变动、打开终端。
- dsh-context 集成：检测到其向官方 `sidebarRightTabs` 注册的 `dsh-context` 页签时，出现「打开上下文」入口，通过 `sidebarRight.openTab('dsh-context')` 打开。

### 变更

- 宠物「打开 / 隐藏」两个入口合并为单一开关：标签随当前可见状态变化，动作执行时先读取最新状态再翻转，默认快捷键 `⌘⌥P` / `Ctrl+Alt+P`。
- README：主安装路径改为 npm 安装（`dsh plugin --profile web add dsh-palette@latest`），软链安装方式保留在开发一节；补充 repository/homepage/keywords 发布元数据。

## [0.1.0] - 2026-09-10

首个发布版本（npm 包名 `dsh-palette`；内部开发期曾名 `dsh-command-palette`，因 npm 名称被占更名，旧偏好存储键作只读回退迁移，已自定义的快捷键与置顶保留）。

### 新增

- `⌘K` / `Ctrl+K` 命令面板：模糊搜索（前缀 > 词中子串 > 有序子序列，label > detail > keywords）、分组展示（会话 / 设置 / 动作 / 扩展）、`↑↓` / `Enter` / `Tab` / `Esc` 键盘导航，IME 组词守卫。
- 最近对话置顶（最多 5 条，排除当前会话、可复用空白会话与 subagent 会话）；会话行显示所属项目名芯片，项目名参与搜索匹配。
- 会话管理入口：新建会话（优先复用空白会话）、上一个 / 下一个会话、搜索切换历史会话、归档当前对话、打开文件夹（宿主 `/open-folder` 命令，按平台调用 open / explorer / xdg-open）、中断当前运行。
- 快捷键体系：面板与每条常用命令均有默认快捷键；面板内录制修改（`Delete`/`Backspace` 清除、`Esc` 取消）、冲突检测、跨平台 `mod` 规范化（Windows/Linux 的 Ctrl 归一为 `mod`，macOS Option 组合按物理键位匹配）。
- 设置直达：通用设置 / 模型 / 插件 / Agent 预设；优先匹配官方 aria-label 与导航标题，第三方设置页插入不错位，位置索引仅作旧版回退。
- 主题切换：浅色 / 深色 / 跟随系统。
- 兼容 DSH 官方右侧边栏 `sidebarRight`：开关优先走官方服务，旧版 better-sidebar DOM 按钮作回退。
- 可选插件集成（在场才出现）：dsh-better-sidebar（打开终端，新版本由其适配官方侧边栏）、dsh-task-board（开关看板）、dsh-skill-explorer（打开技能中心）、dsh-pet（显示/隐藏）。
- 扩展点：`ctx.commandPalette.register`（id 冲突 fail-loud，注册即 effect，随宿主 fiber 清理）。
- 用户偏好（置顶 / 隐藏 / 最近使用 / 各快捷键）持久化于 localStorage。
- tsdown 双产物构建：宿主 ESM（`lib/index.js`）+ ModuleLoader 包裹的浏览器 CJS（`lib/client.js`）。
