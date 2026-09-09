# DSH Command Palette

为 DeepSeek Harness Web GUI 提供键盘优先的快捷操作面板。无需让手离开键盘，通过一个快捷键即可搜索并执行常用功能。

![DSH Command Palette](docs/assets/command-palette.webp)

## 功能

### 快捷操作面板

- macOS 按 `⌘K` 打开
- Windows / Linux 按 `Ctrl+K` 打开
- 支持修改为其他快捷键
- 输入关键词快速筛选功能
- 使用 `↑` / `↓` 选择，`Enter` 执行，`Esc` 关闭或返回

### 对话管理

- 最近对话显示在列表顶部
- 新建对话
- 切换到上一个或下一个对话
- 搜索并切换历史对话
- 归档当前对话
- 在系统文件管理器中打开当前对话的文件夹
- 中断当前运行

### 快速设置

- 打开设置
- 直接进入通用、模型、插件、代理预设等设置页面
- 切换浅色、深色或跟随系统主题
- 在面板内修改快捷键

### 可选插件集成

检测到对应插件时，面板会自动增加相关入口：

- **dsh-better-sidebar**：打开侧边栏、打开终端
- **dsh-pet**：打开宠物、隐藏宠物
- **dsh-task-board**：打开或关闭任务看板
- **dsh-skill-explorer**：打开技能中心

这些插件无论单独安装，还是随插件合集安装，都可以被识别。

## 安装

```bash
git clone git@github.com:1921622004/dsh-command-palette.git
cd dsh-command-palette
pnpm install
pnpm run build
dsh plugin --profile web add "$PWD"
```

安装完成后重启 `dsh web`，刷新页面即可使用。

## 更新

```bash
cd dsh-command-palette
git pull
pnpm install
pnpm run build
```

客户端功能更新后通常刷新页面即可；如果更新涉及宿主功能，请重启 `dsh web`。

## 卸载

```bash
dsh plugin --profile web remove dsh-command-palette
```

卸载后重启 `dsh web`。

## 开发

```bash
pnpm run typecheck
pnpm run build
pnpm run dev
```

`pnpm run dev` 会监听源代码并重新构建插件。

## 许可证

MIT
