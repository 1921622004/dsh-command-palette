# Command Palette（⌘K 快捷入口）设计文档

独立 out-of-tree 插件：为 DeepSeek Harness Web GUI 提供键盘优先的全局面板。通过 `dsh plugin` 安装进 profile，不修改 deepseek-harness 仓库。

## 目标

- 手不离键盘完成大部分操作：切换会话、直达设置子页、切主题、打开文件夹、中断运行等。
- 快捷键默认 `⌘K` / `Ctrl+K`，用户可录制修改（平台无关的 `mod` 形态持久化）。
- 插件可通过 `ctx.commandPalette.register` 扩展入口；用户可置顶/隐藏条目。

## 非目标（本阶段）

- 拼音搜索、面板内嵌参数输入、跨设备同步偏好。
- 取代输入框 `/` 命令菜单（两入口并存）。
- 置顶/隐藏的管理 UI（数据模型与 API 已就位）。

## 功能清单

### 1. 面板核心交互（P0）
- 全局快捷键开/关：默认 ⌘K（Ctrl+K），再按同键或 Esc 关闭；IME 组词守卫。
- 模糊过滤：前缀 > 词中子串 > 有序子序列；label > detail > keywords（`fuzzy.ts`）。
- 键盘导航：↑↓ 跨分组循环移动高亮、Enter 执行、Tab 补全。
- 分组展示：会话 / 设置 / 动作 / 扩展；**行序单一来源**——键盘导航数组与渲染顺序严格一致（分组内：最近对话/置顶/最近使用优先）。
- 最近对话置顶：会话组头部最多 5 条最近对话（排除当前与空白会话）。

### 2. 内置入口
- 会话：新建（复刻 ui-workspace `startSession`：目标工作区 → 复用空白会话或新建 → open）、上一个/下一个、切换到会话…（二级选择）、打开文件夹（`/open-folder` 宿主命令）、归档当前对话。
- 设置：打开设置…（通用/模型/插件/代理预设直达，DOM 驱动：标签匹配 + 探测兜底）、切换主题…、修改面板快捷键…。
- 动作：中断当前运行。
- 扩展：`ctx.commandPalette.register` 注册的入口；`dsh-better-sidebar` 在场时（响应式 `ctx.inject(['betterSidebar'])`）追加「打开侧边栏」「打开终端」。

### 3. 自定义（P0）
- 快捷键录制：捕获即规范化（Windows/Linux 的 Ctrl 归一为 `mod`；历史字面 Ctrl 记录在匹配/展示时折叠），localStorage 持久化。
- 扩展点：`register({ id, group, labelKey|label, detailKey|detail, keywords?, choices?, execute? })`，id 冲突 fail-loud，注册即 effect。
- 用户偏好：置顶/隐藏/最近使用（上限 5），键 `dsh-command-palette.prefs.v1`。

## 架构

```
src/index.ts                # host 半边：/open-folder 命令（open/explorer/xdg-open）
src/client/
  index.ts                  # 入口：palette 字典、commandPalette 服务、shell.overlay 注册、可选集成
  service.ts                # PaletteRuntime：注册表 + 最近会话/录制桥
  builtin.ts                # 内置入口（sessions/workspaces/theme 服务）
  better-sidebar.ts         # dsh-better-sidebar 可选集成（服务 + DOM 钩子）
  settings-opener.ts        # 设置面板打开（标签匹配 + 探测 [role=dialog] nav）
  PaletteOverlay.tsx        # 面板 UI（组件本地状态 + 注入 runtime/t；行序单一来源）
  hotkey.ts                 # mod 语义快捷键：解析/匹配/展示/规范化
  fuzzy.ts / prefs.ts / contract.ts / locales.ts / deps.ts / styles.ts
```

- 数据流：空查询 → 最近对话 + 分组序（组内 置顶 > 最近使用 > 注册序）；有查询 → rankItems 过滤排序；Enter 执行 `execute` 并写入最近使用。
- 错误处理：注册冲突 throw；execute 失败进面板内错误行（`status.error`），不关闭面板。
- 构建（tsdown 双产物）：`lib/index.js`（host ESM）+ `lib/client.js`（ModuleLoader 包裹的浏览器 CJS，react 家族与 cordis 为外部依赖）。

## 测试

- 手动验证矩阵：开合/录制/跨平台匹配、导航与渲染一致性、各入口行为、better-sidebar 增删时的入口出现/消失。
- 后续：vitest 单测（fuzzy 排序、hotkey 规范化/匹配、prefs 持久化、registry 冲突/清理）。
