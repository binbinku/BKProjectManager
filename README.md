# BK Project Manager

面向 macOS 和 Windows 11 的本地项目管理器，使用 Electron、React、TypeScript 和 Vite。

使用 [MIT 许可证](LICENSE)开源。

## 开发与运行

需要 Node.js 22.12+（或 24 LTS）和 npm。

```sh
git clone https://github.com/binbinku/BKProjectManager.git
cd BKProjectManager
npm install
npm run dev
```

首次启动选择工作空间，例如 macOS 的 `~/Workspace` 或 Windows 的 `D:\Workspace`。工作空间路径和收藏等偏好保存在 Electron 的 `userData/settings.json`，不向项目目录写入配置。

```sh
npm test          # 扫描规则和配置持久化测试
npm run build    # TypeScript 检查与生产前端构建
npm start        # 加载已经构建的桌面应用
npm run test:smoke # 真实 Electron UI 测试，使用临时工作空间与配置
```

可通过 `BKPM_SMOKE_WORKSPACE=/your/Workspace npm run test:smoke` 对真实目录额外进行只读扫描和截图。所有测试偏好仍保存到临时目录，项目打开操作使用替身，不启动外部编辑器。

## 扫描规则

- 工作空间的一级目录作为分类。
- 分类自身有已知工程标记时，整个分类作为一个项目。
- 否则，分类下有 `Projects`（名称忽略大小写）时只扫描其直接子目录，没有时扫描分类的直接子目录。
- `Projects` 自身包含已知工程标记时，将其作为一个项目，显示名称使用分类名称。例如 `AndroidDev/Projects/settings.gradle.kts` 不会将 `app`、`gradle` 当成独立项目。
- 未识别类型的目录保留为“文件夹”。不会为了查找项目而无限递归。
- 跳过文件、隐藏目录、符号链接，以及 `node_modules`、`build`、`dist`、`target` 等生成目录。
- 识别 Unity、Unreal、Android、Flutter、JavaScript、Rust、Go、Python、.NET、Java 和 Git 标记。
- 修改时间指项目根目录的文件系统时间，不代表整个工程最新文件的修改时间。

支持分类、搜索、收藏、最近打开、名称或目录修改时间排序、卡片和列表视图。默认使用 Finder/资源管理器打开，可切换 VS Code、Cursor 或选择自己的编辑器；也支持打开项目终端。新增或移动项目后点击“重新扫描”。

外观提供亮色、暗色和跟随系统三种模式。可在侧栏底部快速切换，或在设置中查看主题预览。主题选择自动保存，跟随系统时会响应系统外观变化；窗口底色和原生控件也同步更新。界面采用中性灰阶、细边框和紧凑排版。

## 打包

```sh
npm run pack       # 当前平台的未签名应用目录
npm run dist:mac   # macOS DMG + ZIP（在 macOS 构建）
npm run dist:win   # Windows NSIS 安装包（建议在 Windows 构建）
```

输出位于 `release/`。正式分发还需配置应用图标、macOS 签名与公证以及 Windows 代码签名。当前默认使用 Electron 图标，没有接入自动更新。

## 结构

- `electron/main.cjs`：窗口、受限 IPC、系统打开操作。
- `electron/preload.cjs`：隔离环境中的最小 API。
- `electron/scanner.cjs`：只读扫描与项目类型识别。
- `electron/store.cjs`：JSON 偏好与串行原子写入。
- `src/`：React 界面。
- `tests/`、`scripts/smoke.mjs`：扫描与桌面集成测试。

渲染进程关闭 Node 集成，开启 context isolation 和 sandbox；系统操作只接受已扫描的项目 ID，不接受任意路径或命令。扫描不修改、移动或删除项目文件。`BKPM_USER_DATA` 可为开发与测试指定隔离配置目录。

## 开源许可证

Copyright (c) 2026 binbinku。项目采用 [MIT License](LICENSE)，允许使用、修改和分发，请保留原有版权及许可声明。
