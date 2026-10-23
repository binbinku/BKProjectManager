<p align="center">
  <img src="docs/assets/logo.svg" alt="BK Project Manager 标志" width="80" height="80" />
</p>

<h1 align="center">BK Project Manager</h1>

<p align="center">
  <strong>项目各归其位，开始更轻松。</strong><br />
  <sub>Your projects. One workspace.</sub>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/binbinku/BKProjectManager?style=flat-square&amp;color=525252" alt="MIT License" /></a>
  <a href="https://github.com/binbinku/BKProjectManager/releases/latest"><img src="https://img.shields.io/github/v/release/binbinku/BKProjectManager?style=flat-square&amp;color=525252" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%2011-525252?style=flat-square" alt="macOS / Windows 11" />
  <img src="https://img.shields.io/badge/Electron-44-47848F?style=flat-square" alt="Electron 44" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square" alt="TypeScript 5" />
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="#project-manager">项目管理页</a> ·
  <a href="#editor">编辑器页</a> ·
  <a href="#downloads">下载安装</a> ·
  <a href="#quick-start">源码运行</a> ·
  <a href="#features">功能一览</a> ·
  <a href="#themes">配色主题</a> ·
  <a href="#controls">操作与快捷键</a> ·
  <a href="#previews">更多界面</a> ·
  <a href="#scanning">扫描规则</a> ·
  <a href="#development">开发与构建</a>
</p>

面向 **macOS 与 Windows 11** 的本地项目管理器。把分散的项目归集到一个工作空间，按分类浏览、收藏和最近打开查找；需要深入查看时，再进入项目的编辑器页面，浏览代码并使用终端。

<a id="project-manager"></a>

## 🗂️ 项目管理页 · 所有项目，一目了然

自动扫描工作空间，用分类、收藏和最近打开找到手头的项目。卡片与列表两种视图，支持在软件内打开项目，也可以直接交给 VS Code、Cursor 或其他编辑器。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/workspace-dark.png" />
  <img src="docs/assets/workspace-light.png" alt="项目管理页：分类、项目卡片、收藏、最近打开与右下角纵向悬浮工具" width="1360" />
</picture>

<p align="center">
  <a href="docs/assets/workspace-light.png">☀️ 亮色项目管理页</a> · <a href="docs/assets/workspace-dark.png">🌙 暗色项目管理页</a>
</p>

<a id="editor"></a>

## 💻 编辑器页 · 打开项目，继续工作

从项目卡片进入三栏工作台：左侧浏览目录，中间只读查看代码，右侧直接运行终端命令。毛玻璃导航、Material 文件图标和细分界线，让项目内容保持清晰。代码区与终端共用主题底色，左侧目录保留同色系层次，切换主题时三栏保持协调。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/workbench-dark.png" />
  <img src="docs/assets/workbench-light.png" alt="编辑器页：Material 文件目录、单文件只读代码预览与交互终端" width="1360" />
</picture>

<p align="center">
  <a href="docs/assets/workbench-light.png">☀️ 亮色编辑器页</a> · <a href="docs/assets/workbench-dark.png">🌙 暗色编辑器页</a><br />
  <sub>两组截图均使用示例项目，并随 GitHub 的亮暗外观自动切换。</sub>
</p>

> **v0.2.0 已包含完整工作台、七款内置配色和统一的悬浮工具界面。** 可[下载安装包](#downloads)或[从源码启动](#quick-start)。代码预览为只读，不提供文件编辑保存。

<a id="features"></a>

## ✨ 功能一览

<table>
  <tr>
    <td width="50%"><strong>🗂️ 自动整理</strong><br />一级目录作为分类，自动收纳 Projects 下的项目；也支持直接放在分类里的项目。</td>
    <td width="50%"><strong>🎛️ 轻量操作</strong><br />统一的项目列表界面，右下角纵向悬浮工具提供视图、排序、扫描与新建。</td>
  </tr>
  <tr>
    <td><strong>🎨 分类标识</strong><br />每个分类都有稳定的颜色与图标，也可单独自定义；切换工作空间时分别保存。</td>
    <td><strong>➕ 从这里开始</strong><br />直接新增分类、新建空项目，创建后自动加入列表。</td>
  </tr>
  <tr>
    <td><strong>⭐ 随手收藏</strong><br />收藏常用项目，通过「最近打开」快速回到手头的工作。</td>
    <td><strong>🚀 一键继续</strong><br />打开 Finder / 资源管理器、项目终端、VS Code、Cursor，或自选编辑器。</td>
  </tr>
  <tr>
    <td><strong>📄 专注浏览</strong><br />单文件只读预览、行号与 VS Code 默认代码配色，不显示多文件标签。</td>
    <td><strong>⌨️ 内置终端</strong><br />进入项目目录即可运行命令，支持 ANSI 真彩色、滚动和进程中断。</td>
  </tr>
  <tr>
    <td><strong>🌗 亮暗随心</strong><br />默认、石墨、暖沙、森林、GitHub、Apple、MacBook Neo 七款配色，各自适配亮色、暗色和跟随系统，布局保持一致。</td>
    <td><strong>🔒 数据留在本机</strong><br />设置本地保存，扫描不移动或删除项目文件，无需云端账户。</td>
  </tr>
</table>

## 🧩 工作台使用说明

在软件内打开项目即可进入三栏工作台，v0.2.0 安装包与源码均支持。

- **左侧：** 固定顶部只保留返回、项目名和默认打开软件的真实图标；目录从下方开始，上滑时从半透明毛玻璃导航后面经过。文件和目录使用离线打包的 Material Icon Theme 图标，支持展开/收起及亮暗主题。
- **中间：** 代码区上下延伸至窗口边缘，一次只读预览一个文件，支持行号、VS Code Light+ / Dark+ 代码高亮和常见图片；不显示文件标签，不提供编辑保存。
- **右侧：** 上下延伸至窗口边缘的交互终端，启动在项目目录，支持滚动、Ctrl+C 中断、清空和重启；清空和重启操作位于系统菜单「终端」。macOS 使用登录 Shell，Windows 11 使用 PowerShell。
- **简洁布局：** 代码与终端上下直达窗口边缘，左右仅保留 1px 分界线，拖动范围保持宽于可见线条，方便调整面板。返回列表时会关闭当前项目终端。
- **滚动与外观：** 所有区域隐藏滚动条，保留滚轮、触控板和横向滚动；设置通过系统菜单访问，支持亮色、暗色和跟随系统。

预览支持 2 MiB 以内的 UTF-8、UTF-16 文本与常见图片；超过 20 万字符的文本使用纯文本预览。二进制或不支持的文件会显示说明。文件浏览限定在当前项目中，文件树不展开符号链接。

<a id="controls"></a>

## 🎛️ 操作与快捷键

设置、刷新目录和终端操作位于原生菜单栏，工作台内不再放置额外工具栏。

| 操作             | 菜单或入口                                               | macOS    | Windows 11 |
| ---------------- | -------------------------------------------------------- | -------- | ---------- |
| 打开设置         | macOS：BK Project Manager → 设置…；Windows：文件 → 设置… | `⌘,`     | `Ctrl+,`   |
| 刷新当前项目文件 | 查看 → 刷新文件目录                                      | `⌘R`     | `Ctrl+R`   |
| 清空终端显示     | 终端 → 清空终端                                          | —        | —          |
| 重启项目终端     | 终端 → 重新启动终端                                      | —        | —          |
| 切换项目视图     | 右下角悬浮区 → 显示方式                                  | —        | —          |
| 调整项目排序     | 右下角悬浮区 → 项目排序                                  | —        | —          |
| 中断终端命令     | 聚焦右侧终端                                             | `Ctrl+C` | `Ctrl+C`   |

点击顶部软件图标，按设置中的默认方式打开当前项目；悬停可查看软件名称。终端执行 `exit` 后，可通过菜单重新启动。**返回项目列表或重启终端会结束当前终端进程。**

### GitHub 仓库入口（v0.2.1 源码与本地构建）

项目卡片、列表及工作台顶部会为 GitHub 项目显示 GitHub 图标，点击即可通过系统默认浏览器打开仓库首页。HTTPS、SSH 地址均可识别，也支持 Git worktree 和子模块的 Git 元数据。识别只读取本地 Git 配置，不依赖 Git 命令或 Token，地址中的凭证不会传入界面或浏览器。

只有一个仓库时直接打开；多个仓库时通过原生菜单选择，`origin` 优先，并合并重复的仓库地址。普通本地项目及非 GitHub 远程仓库不显示入口。调整远程地址后可重新扫描；点击时也会重新核对本地配置。此入口尚未包含在下方 v0.2.0 安装包中。

<a id="downloads"></a>

## 📦 下载安装

**最新版：v0.2.0。** 包含项目管理、三栏工作台、真实终端、分类与空项目创建、移除与恢复，以及七款内置配色。可从 [最新 Release](https://github.com/binbinku/BKProjectManager/releases/latest) 下载：

完整变化与升级说明见 [v0.2.0 更新记录](docs/releases/v0.2.0.md)。

| 平台                            | 安装包                                                                                                                 | ZIP 归档                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| macOS · Apple Silicon（M 系列） | [DMG](https://github.com/binbinku/BKProjectManager/releases/download/v0.2.0/BKProjectManager-0.2.0-mac-arm64.dmg)      | [ZIP](https://github.com/binbinku/BKProjectManager/releases/download/v0.2.0/BKProjectManager-0.2.0-mac-arm64.zip)      |
| macOS · Intel                   | [DMG](https://github.com/binbinku/BKProjectManager/releases/download/v0.2.0/BKProjectManager-0.2.0-mac-x64.dmg)        | [ZIP](https://github.com/binbinku/BKProjectManager/releases/download/v0.2.0/BKProjectManager-0.2.0-mac-x64.zip)        |
| Windows · x64                   | [EXE 安装包](https://github.com/binbinku/BKProjectManager/releases/download/v0.2.0/BKProjectManager-0.2.0-win-x64.exe) | [免安装 ZIP](https://github.com/binbinku/BKProjectManager/releases/download/v0.2.0/BKProjectManager-0.2.0-win-x64.zip) |

macOS 打开 DMG 后将应用拖入 Applications；Windows 运行 EXE 安装，或解压 ZIP 后启动应用。首次启动时选择工作空间即可。

> v0.2.0 未配置开发者代码签名和 macOS 公证，系统可能显示信任提示。Release 附带 `SHA256SUMS.txt`，可用于核对下载文件。

<a id="quick-start"></a>

## 🚀 从源码启动

需要 **Node.js 22.12+** 和 **npm**，建议使用 Node.js 24 LTS。

```sh
git clone https://github.com/binbinku/BKProjectManager.git
cd BKProjectManager
npm ci
npm run dev
```

1. 首次启动，选择工作空间，例如 `~/Workspace` 或 `D:\Workspace`。
2. 应用读取目录结构，自动生成分类和项目列表。
3. 点击 **打开项目** 进入工作台：左侧展开目录，中间查看文件，右侧直接输入终端命令。
4. 通过系统菜单打开 **设置…**，选择亮色、暗色或跟随系统，再选一款配色主题和默认编辑器；顶部软件图标用于外部打开项目。

新增或移动项目后，点击 **重新扫描**。更换工作空间可在系统菜单的 **设置…** 中完成（macOS：应用菜单，`⌘,`；Windows：文件菜单，`Ctrl+,`）。

侧栏顶部只保留一行图标与应用名称，macOS 下与红黄绿窗口按钮对齐；工作空间管理统一放在系统菜单的设置中。

<a id="themes"></a>

### 🎨 内置配色主题

通过系统菜单打开 **设置… → 配色主题**，点击预览卡片即可切换并保存到本机。也可使用 `⌘,`（macOS）或 `Ctrl+,`（Windows）打开设置。配色与亮暗模式独立，七款配色均适配亮色、暗色和跟随系统：

| 主题        | 配色风格                     |
| ----------- | ---------------------------- |
| 默认        | 延续现有纯净中性色           |
| 石墨        | 冷灰底色，少量雾蓝点缀       |
| 暖沙        | 柔和米灰与克制的暖棕色       |
| 森林        | 低饱和灰绿，保持安静简洁     |
| GitHub      | 灰白与深灰底色，经典蓝色点缀 |
| Apple       | 银灰留白，搭配清晰的系统蓝   |
| MacBook Neo | 淡米白与炭灰，青柠黄色点缀   |

GitHub 配色参考 [Primer](https://primer.style/product/getting-started/foundations/color-usage/)，MacBook Neo 配色以 [Citrus 青柠黄色](https://www.apple.com/macbook-neo/)为灵感，采用适合长时间使用的柔和色值。

主题只改变配色，不改变尺寸、间距、面板比例或悬浮按钮位置。代码区、行号区与终端使用同一主题底色，左侧目录保留同色系层次；代码高亮继续使用 VS Code Light+ / Dark+，程序的 ANSI 与真彩色输出保持正常。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/themes-dark.png" />
  <img src="docs/assets/themes-light.png" alt="设置中的七款内置配色主题：默认、石墨、暖沙、森林、GitHub、Apple 与 MacBook Neo" width="500" />
</picture>

### 新增分类与项目

- 点击左侧「项目分类」旁的 **＋**，输入名称并选择颜色、图标。应用创建 `工作空间/分类名称/Projects/`。
- 选中分类后，通过右下角悬浮区的 **… → 修改分类外观** 调整颜色和图标，侧栏与项目卡片同步显示。
- 点击 **新建项目**，选择分类并输入名称，只创建一个空文件夹。已有 `Projects` 收纳目录时创建在其中，否则直接创建在分类下；创建后自动刷新列表。
- 已识别为工程根目录的分类不可用于新建子项目；重复名称、无效路径与系统保留名称会明确提示，不覆盖已有内容。

分类外观保存在本机设置中，不会向已有项目写入配置文件。

全部项目、我的收藏、最近打开与分类页统一直接展示项目，不显示顶栏、统计栏、搜索和额外标题行。右下角半透明毛玻璃悬浮区叠在内容上，不为工具条单独预留右侧空间，提供 **显示方式、排序、重新扫描、新建项目**，卡片与列表视图均可使用；分类页额外提供 **…** 菜单，保留分类外观和移除操作。最近打开默认按打开时间倒序，也可以在排序菜单中切换为名称或目录修改时间。

### 移除、恢复与手动删除

点击项目卡片上的垃圾桶图标，或选中分类后通过右下角 **… → 移除分类**，会打开操作弹窗：

- **从列表移除**：仅在当前工作空间中隐藏；移除分类会连同其中的项目一起隐藏，重新扫描和重启仍然有效，磁盘文件保持原样。
- **在 Finder / 资源管理器中显示，手动删除**：立即从列表隐藏，再定位并选中文件夹，由你在系统中自行删除。应用不会执行删除；即使暂时没有删除文件，重新扫描和重启后也会保持隐藏，可在设置中恢复。
- **恢复**：通过系统菜单打开 **设置… → 已移除的内容**，逐项或全部恢复。恢复分类时，之前单独移除的项目仍会隐藏，可再单独恢复。收藏与最近打开记录保留。

恢复只清除隐藏记录；已经被手动删除或移动的文件夹不会重新创建。

> **验证范围**：v0.2.0 打包应用在 macOS Apple Silicon 及 Rosetta 2 下的 Intel 版本完成运行验证；Windows x64 安装包由 macOS 交叉构建，尚待 Windows 11 实机验证。安装依赖时需要联网下载 npm 包及 Electron 运行时，图标随应用打包，运行时不需要联网加载。

<a id="previews"></a>

## 🖼️ 更多界面

上方已完整展示项目管理页与编辑器页。下面补充列表视图、设置、移除弹窗和首次启动页面。

<details>
<summary><strong>列表视图 · 更紧凑地浏览项目</strong></summary>

<br />
<img src="docs/assets/list-dark.png" alt="暗色列表视图，展示项目名称、类型、路径和快捷操作" width="1360" />

</details>

<details>
<summary><strong>分类页面 · 专注项目，右下角悬浮操作</strong></summary>

<br />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/category-dark.png" />
  <img src="docs/assets/category-light.png" alt="精简分类页：直接展示项目，右下角纵向排列视图、排序、扫描、新建与分类菜单" width="1360" />
</picture>

</details>

<details>
<summary><strong>外观设置 · 即时预览，自动保存</strong></summary>

<p align="center">
  <br />
  <img src="docs/assets/settings-dark.png" alt="设置弹窗：亮色、暗色、跟随系统与七款内置配色，向下滚动可管理工作空间和默认编辑器" width="500" />
</p>

</details>

<details>
<summary><strong>首次启动 · 从一个工作空间开始</strong></summary>

<br />
<img src="docs/assets/welcome.png" alt="首次启动页面，引导用户选择工作空间" width="1360" />

</details>

<details>
<summary><strong>移除弹窗 · 隐藏列表或定位后手动删除</strong></summary>

<p align="center">
  <br />
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/remove-dark.png" />
    <img src="docs/assets/remove-light.png" alt="移除弹窗：从列表隐藏，或在 Finder 中显示后由用户手动删除" width="500" />
  </picture>
</p>

</details>

<a id="scanning"></a>

## 🗂️ 熟悉的目录，清晰的分类

无需重新组织磁盘文件。下面这样的目录，可以直接作为工作空间：

```text
Workspace/
├── WebDev/                   → 分类：WebDev
│   └── Projects/             → 展示时收纳这一层
│       ├── AtlasWeb/         → 项目
│       └── DesignSystem/     → 项目
├── GameDev/                  → 分类：GameDev
│   ├── Engine/               → 有 Projects 时，不扫描这个同级目录
│   └── Projects/
│       └── OrbitGame/        → 项目
└── TestDev/                  → 分类：TestDev
    └── DevTools/             → 没有 Projects 时，直接识别子目录
```

**扫描顺序**：识别一级目录自身是否为工程 → 查找分类下的 `Projects` → 扫描容器的直接子目录。`Projects` 自身已是工程时，也会作为一个完整项目收纳。

例如 `AndroidDev/Projects` 中含有 `settings.gradle.kts`，会将整个目录识别为 Android 项目，避免把 `app`、`build`、`gradle` 分别列为项目。

<details>
<summary><strong>项目类型识别与过滤规则</strong></summary>

| 类型            | 识别标记                                   |
| --------------- | ------------------------------------------ |
| Unity / Tuanjie | `Assets` + `ProjectSettings`，显示为 Unity |
| Unreal Engine   | `*.uproject`                               |
| Android         | `settings.gradle` / `settings.gradle.kts`  |
| Flutter         | `pubspec.yaml`                             |
| JavaScript      | `package.json`                             |
| Rust / Go       | `Cargo.toml` / `go.mod`                    |
| Python          | `pyproject.toml` / `requirements.txt`      |
| .NET            | `*.sln` / `*.slnx` / `*.csproj`            |
| Java            | `pom.xml`                                  |
| 其他目录        | 保留为「文件夹」                           |

- `Projects` 名称匹配不区分大小写；不会无限递归扫描。
- 默认跳过文件、隐藏目录、符号链接，以及 `node_modules`、`build`、`dist`、`target`、`vendor` 等生成目录。
- 检测到 `.git` 标记时显示 Git 标签。
- 「修改时间」指项目根目录的文件系统时间，不代表工程内所有文件的最新修改时间。

</details>

<a id="development"></a>

## 🛠️ 开发与构建

**Electron · React · TypeScript · Vite**

| 命令                       | 用途                                     |
| -------------------------- | ---------------------------------------- |
| `npm run dev`              | 启动开发环境                             |
| `npm run build`            | 生成文件图标、检查 TypeScript 并构建前端 |
| `npm start`                | 运行已构建的桌面应用                     |
| `npm test`                 | 验证扫描、配置持久化、文件访问与会话     |
| `npm run test:workbench`   | 验证项目文件、预览、真实终端与进程清理   |
| `npm run test:smoke`       | 在真实 Electron 窗口中验证主要交互       |
| `npm run test:management`  | 验证分类外观、新建分类与空项目、重启保存 |
| `npm run test:removal`     | 验证移除弹窗、定位、恢复和文件完整性     |
| `npm run test:category`    | 验证精简分类页、悬浮工具、排序和视图切换 |
| `npm run test:palettes`    | 验证七主题亮暗配色、布局不变与重启保存   |
| `npm run test:github`      | 验证 GitHub 入口、远程选择和工作台会话   |
| `npm run format:check`     | 检查代码格式                             |
| `npm run docs:screenshots` | 构建应用并使用示例数据更新文档截图       |

桌面交互测试和截图生成需要可用的桌面会话。它们使用临时工作空间和独立配置，不覆盖你的使用偏好；文档截图不会读取你的项目目录。

### 本地打包

```sh
npm run pack       # 当前平台的应用目录
npm run dist:mac   # macOS：DMG + ZIP
npm run dist:win   # Windows：NSIS 安装包 + ZIP
```

产物位于 `release/`。所有打包均在本地完成，不使用 GitHub Actions。建议在目标系统上构建；应用、Dock 与安装器使用项目自己的标志；图标由 `docs/assets/logo.svg` 生成，运行 `npm run icons:generate` 可重新生成 PNG、macOS ICNS 和 Windows ICO（支持在两种系统上执行）。分发包尚未配置代码签名与 macOS 公证。暂未接入自动更新。

### 文件树图标

`npm run dev` 和 `npm run build` 会从固定版本的官方 npm 包自动生成 Material Icon Theme 的 SVG 资源与匹配表，无需安装 VS Code 扩展。生成资源不提交到 Git；正式构建会将图标及许可一同打包。来源和许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

### 代码结构

```text
electron/     # 原生菜单、受限 IPC、扫描、文件访问与 PTY 终端
src/          # 项目列表、文件树、代码预览与主题
scripts/      # 开发启动、图标生成、桌面测试与截图
tests/        # 扫描、持久化、文件访问与会话测试
docs/assets/  # 文档 SVG 与演示截图
licenses/     # 随应用分发的第三方许可
```

设置保存在 Electron 的 `userData/settings.json`。可使用 `BKPM_USER_DATA` 指定独立配置目录；渲染进程关闭 Node 集成，启用 context isolation 与 sandbox，系统操作通过项目 ID 调用受限 IPC。

<a id="contributing"></a>

## 🤝 一起完善

欢迎提交 [Issue](https://github.com/binbinku/BKProjectManager/issues) 或 [Pull Request](https://github.com/binbinku/BKProjectManager/pulls)。

- **反馈问题**：请附上操作系统、复现步骤，以及脱敏后的目录结构。
- **提交改进**：说明改动目的，运行 `npm test`、`npm run build` 和 `npm run format:check`；涉及界面时补充截图。
- **改进文档**：请同步更新中文版与英文版，保持说明一致。

<a id="license"></a>

## 📄 开源许可证

采用 [MIT License](LICENSE) 开源。你可以使用、修改和分发本项目，请保留版权与许可声明。

文件树图标来自 [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)（MIT），详见[第三方声明](THIRD_PARTY_NOTICES.md)。

<p align="center">
  <sub>Copyright © 2026 <a href="https://github.com/binbinku">binbinku</a></sub>
</p>
