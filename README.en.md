<p align="center">
  <img src="docs/assets/logo.svg" alt="BK Project Manager logo" width="80" height="80" />
</p>

<h1 align="center">BK Project Manager</h1>

<p align="center">
  <strong>Your projects. One workspace.</strong><br />
  <sub>A quieter place to find your projects and get back to work.</sub>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/binbinku/BKProjectManager?style=flat-square&amp;color=525252" alt="MIT License" /></a>
  <a href="https://github.com/binbinku/BKProjectManager/releases/latest"><img src="https://img.shields.io/github/v/release/binbinku/BKProjectManager?style=flat-square&amp;color=525252" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%2011-525252?style=flat-square" alt="macOS / Windows 11" />
  <img src="https://img.shields.io/badge/Electron-44-47848F?style=flat-square" alt="Electron 44" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square" alt="TypeScript 5" />
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <strong>English</strong>
</p>

<p align="center">
  <a href="#downloads">Downloads</a> ·
  <a href="#quick-start">Run from source</a> ·
  <a href="#features">Features</a> ·
  <a href="#previews">Screenshots</a> ·
  <a href="#scanning">Discovery rules</a> ·
  <a href="#development">Development</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/workspace-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/workspace-light.png" />
  <img src="docs/assets/workspace-light.png" alt="BK Project Manager showing categorized projects, search, favorites, and quick actions" width="1360" />
</picture>

<p align="center">
  <sub>Preview follows your GitHub appearance · Screenshots use sample projects · The app UI is currently in Chinese</sub><br />
  <a href="docs/assets/workspace-light.png">☀️ Light preview</a> · <a href="docs/assets/workspace-dark.png">🌙 Dark preview</a>
</p>

A local project workspace designed for **macOS and Windows 11**. Choose a workspace folder, discover and categorize its projects, then search, bookmark, and open them in your editor, terminal, or file manager.

A Codex-inspired interface brings together neutral colors, subtle borders, and compact layouts. Keep your directory structure and bring your project entry points together.

<a id="features"></a>

## ✨ Features

<table>
  <tr>
    <td width="50%"><strong>🗂️ Automatic organization</strong><br />Top-level folders become categories. Projects are discovered inside Projects containers or directly within a category.</td>
    <td width="50%"><strong>🔎 Find it quickly</strong><br />Search names, categories, technology types, or relative paths. Press ⌘ / Ctrl + K to focus search.</td>
  </tr>
  <tr>
    <td><strong>⭐ Keep favorites close</strong><br />Bookmark your regular projects and return to previous work through Recently opened.</td>
    <td><strong>🚀 Get back to work</strong><br />Open Finder / File Explorer, a project terminal, VS Code, Cursor, or a custom editor.</td>
  </tr>
  <tr>
    <td><strong>🌗 Choose your appearance</strong><br />Light, dark, and system themes, with both card and list views.</td>
    <td><strong>🔒 Local by design</strong><br />Preferences stay on your computer. Scanning does not move or delete projects, and no cloud account is required.</td>
  </tr>
</table>

## 🧩 Project workbench (source preview)

The v0.2.0 source opens projects in a three-panel workbench. Published v0.1.1 installers do not include this feature yet.

- **Left:** expand the project file tree on demand; refresh after changing files in the terminal.
- **Center:** one read-only file at a time, with line numbers and VS Code Light+ / Dark+ syntax highlighting. No file tabs or editing controls. Common images can also be previewed.
- **Right:** an interactive terminal starting in the project directory, with scrolling, Ctrl+C, clear and restart. macOS uses your login shell; Windows 11 uses PowerShell.
- Resize the side panels, switch light/dark themes in Settings, return to the project list, or use the existing external opener. Returning closes the project's terminal.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/workbench-dark.png" />
  <img src="docs/assets/workbench-light.png" alt="Project file tree, read-only code preview and interactive terminal" width="1360" />
</picture>

Preview supports UTF-8 and UTF-16 text and common images up to 2 MiB. Files over 200,000 characters use plain-text preview. Binary or unsupported files show an explanation. Project browsing stays within the selected project; symbolic links are not expandable in the tree.

<a id="downloads"></a>

## 📦 Downloads

Choose your platform from the [latest release](https://github.com/binbinku/BKProjectManager/releases/latest):

| Platform                         | Installer                                                                                                                 | ZIP archive                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| macOS · Apple Silicon (M series) | [DMG](https://github.com/binbinku/BKProjectManager/releases/download/v0.1.1/BKProjectManager-0.1.1-mac-arm64.dmg)         | [ZIP](https://github.com/binbinku/BKProjectManager/releases/download/v0.1.1/BKProjectManager-0.1.1-mac-arm64.zip)          |
| macOS · Intel                    | [DMG](https://github.com/binbinku/BKProjectManager/releases/download/v0.1.1/BKProjectManager-0.1.1-mac-x64.dmg)           | [ZIP](https://github.com/binbinku/BKProjectManager/releases/download/v0.1.1/BKProjectManager-0.1.1-mac-x64.zip)            |
| Windows · x64                    | [EXE installer](https://github.com/binbinku/BKProjectManager/releases/download/v0.1.1/BKProjectManager-0.1.1-win-x64.exe) | [No-install ZIP](https://github.com/binbinku/BKProjectManager/releases/download/v0.1.1/BKProjectManager-0.1.1-win-x64.zip) |

On macOS, open the DMG and drag the app into Applications. On Windows, run the installer or extract the ZIP and launch the application. Choose a workspace on first launch.

> v0.1.1 does not have developer code signing or macOS notarization, so your operating system may display trust prompts. Each release includes `SHA256SUMS.txt` for download verification.

<a id="quick-start"></a>

## 🚀 Run from source

Requires **Node.js 22.12+** and **npm**. Node.js 24 LTS is recommended.

```sh
git clone https://github.com/binbinku/BKProjectManager.git
cd BKProjectManager
npm ci
npm run dev
```

1. On first launch, choose a workspace such as `~/Workspace` or `D:\Workspace`.
2. The app reads your directory structure and builds the project categories and list.
3. Search for a project, star it, or choose a default editor in Settings.

Click **Rescan** after adding or moving projects. You can switch workspaces in **Settings**.

> **Validation scope:** macOS Apple Silicon / Intel and Windows x64 packages are built locally. macOS apps are tested on the host (Intel through Rosetta 2); Windows is cross-built and still awaits Windows 11 runtime testing. First launch from source may require an internet connection to download the Electron runtime.

<a id="previews"></a>

## 🖼️ Screenshots

The main preview follows your GitHub light or dark appearance. Use the links above to view either theme directly.

<details>
<summary><strong>List view · Browse more compactly</strong></summary>

<br />
<img src="docs/assets/list-dark.png" alt="Dark list view with project names, types, paths, and quick actions" width="1360" />

</details>

<details>
<summary><strong>Appearance settings · Immediate preview, saved automatically</strong></summary>

<p align="center">
  <br />
  <img src="docs/assets/settings-dark.png" alt="Settings dialog with light, dark, and system themes, workspace selection, and default editor options" width="500" />
</p>

</details>

<details>
<summary><strong>First launch · Start with a workspace</strong></summary>

<br />
<img src="docs/assets/welcome.png" alt="First-launch screen prompting the user to select a workspace" width="1360" />

</details>

<a id="scanning"></a>

## 🗂️ Your folders, organized

Keep your existing files where they are. A structure like this works directly as a workspace:

```text
Workspace/
├── WebDev/                   → Category: WebDev
│   └── Projects/             → Flattened in the project navigation
│       ├── AtlasWeb/         → Project
│       └── DesignSystem/     → Project
├── GameDev/                  → Category: GameDev
│   ├── Engine/               → Not scanned when Projects exists
│   └── Projects/
│       └── OrbitGame/        → Project
└── TestDev/                  → Category: TestDev
    └── DevTools/             → Direct child used when Projects is absent
```

**Discovery order:** check whether the top-level folder is itself a project → look for a `Projects` container → scan its direct children. If `Projects` is itself a recognized project, the entire directory is kept as one project.

For example, if `AndroidDev/Projects` contains `settings.gradle.kts`, it is treated as one Android project. Its `app`, `build`, and `gradle` folders will not become separate projects.

<details>
<summary><strong>Project detection and filtering</strong></summary>

| Type              | Detection markers                                |
| ----------------- | ------------------------------------------------ |
| Unity / Tuanjie   | `Assets` + `ProjectSettings`; displayed as Unity |
| Unreal Engine     | `*.uproject`                                     |
| Android           | `settings.gradle` / `settings.gradle.kts`        |
| Flutter           | `pubspec.yaml`                                   |
| JavaScript        | `package.json`                                   |
| Rust / Go         | `Cargo.toml` / `go.mod`                          |
| Python            | `pyproject.toml` / `requirements.txt`            |
| .NET              | `*.sln` / `*.slnx` / `*.csproj`                  |
| Java              | `pom.xml`                                        |
| Other directories | Kept as folders                                  |

- The `Projects` container name is matched case-insensitively. Discovery does not recurse indefinitely.
- Files, hidden directories, symlinks, and generated folders such as `node_modules`, `build`, `dist`, `target`, and `vendor` are skipped.
- A Git label is shown when a `.git` marker is present.
- Modification time means the project root directory's filesystem timestamp, not the newest file anywhere in the project.

</details>

<a id="development"></a>

## 🛠️ Development and builds

**Electron · React · TypeScript · Vite**

| Command                    | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `npm run dev`              | Start the development environment                              |
| `npm run build`            | Check TypeScript and build the frontend                        |
| `npm start`                | Launch the built desktop application                           |
| `npm test`                 | Test discovery, settings, project files and sessions           |
| `npm run test:workbench`   | Test project browsing, file preview, real terminal and cleanup |
| `npm run test:smoke`       | Verify key interactions in a real Electron window              |
| `npm run format:check`     | Check source formatting                                        |
| `npm run docs:screenshots` | Build the app and regenerate screenshots with sample data      |

Desktop interaction tests and screenshot generation require a desktop session. They use temporary workspaces and isolated settings, leaving your preferences intact. Documentation screenshots never read your project directories.

### Local packaging

```sh
npm run pack       # Application directory for the current platform
npm run dist:mac   # macOS: DMG + ZIP
npm run dist:win   # Windows: NSIS installer
```

Output is written to `release/`. Build on the target operating system where possible. The application, Dock and installers use the project logo. Run `npm run icons:generate` on macOS or Windows to regenerate PNG, macOS ICNS and Windows ICO assets from `docs/assets/logo.svg`. Distribution packages do not yet have code signing or macOS notarization. Automatic updates are not implemented yet.

### Project structure

```text
electron/     # Windows, restricted IPC, discovery, and local settings
src/          # React UI and themes
scripts/      # Development launcher, desktop tests, and screenshots
tests/        # Discovery, persistence, project file and session tests
docs/assets/  # Documentation SVG and demo screenshots
```

Settings are stored in Electron's `userData/settings.json`. Set `BKPM_USER_DATA` to use an isolated configuration directory. The renderer disables Node integration, enables context isolation and sandboxing, and uses project IDs to invoke restricted IPC operations.

<a id="contributing"></a>

## 🤝 Contributing

[Issues](https://github.com/binbinku/BKProjectManager/issues) and [pull requests](https://github.com/binbinku/BKProjectManager/pulls) are welcome.

- **Report a bug:** include your operating system, reproduction steps, and a directory example with private information removed.
- **Propose a change:** explain its purpose and run `npm test`, `npm run build`, and `npm run format:check`. Include screenshots for UI changes.
- **Improve the docs:** keep the Chinese and English READMEs in sync.

<a id="license"></a>

## 📄 License

Released under the [MIT License](LICENSE). You may use, modify, and redistribute this project while retaining the copyright and license notice.

<p align="center">
  <sub>Copyright © 2026 <a href="https://github.com/binbinku">binbinku</a></sub>
</p>
