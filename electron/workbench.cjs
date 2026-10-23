const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { ProjectFiles } = require('./project-files.cjs');

class Workbench {
  constructor(send) {
    this.send = send;
    this.session = null;
    this.opening = false;
    this.revision = 0;
  }

  async open(project) {
    if (this.opening || this.session) throw new Error('请先关闭当前项目');
    this.opening = true;
    const revision = this.revision;
    try {
      const files = await ProjectFiles.open(project.path);
      if (revision !== this.revision) throw new Error('项目打开已取消');
      const session = { id: randomUUID(), project, files, terminal: null };
      this.session = session;
      return { id: session.id, project };
    } finally {
      this.opening = false;
    }
  }

  requireSession(id) {
    if (typeof id !== 'string' || !this.session || this.session.id !== id)
      throw new Error('项目工作台已关闭，请重新打开项目');
    return this.session;
  }

  startTerminal(id, cols, rows) {
    const session = this.requireSession(id);
    if (session.terminal) throw new Error('终端已在运行');
    this.dimensions(cols, rows);
    const windows = process.platform === 'win32';
    const executable = windows
      ? path.join(
          process.env.SystemRoot || 'C:\\Windows',
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'powershell.exe',
        )
      : os.userInfo().shell || '/bin/zsh';
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'BKProjectManager',
    };
    // Do not pass Electron/debugger flags into shells or programs launched by users.
    for (const name of Object.keys(env))
      if (
        name.startsWith('ELECTRON_') ||
        name.startsWith('BKPM_') ||
        name === 'NODE_OPTIONS' ||
        name === 'NODE_INSPECTOR_IPC'
      )
        delete env[name];
    const pty = require('node-pty').spawn(executable, windows ? ['-NoLogo'] : ['-l'], {
      cwd: session.files.root,
      name: 'xterm-256color',
      cols,
      rows,
      env,
    });
    const terminal = { id: randomUUID(), pty, pending: 0, paused: false };
    session.terminal = terminal;
    pty.onData((data) => {
      if (this.session !== session || session.terminal !== terminal) return;
      // Bound pending output: xterm acknowledges data once it has parsed it.
      terminal.pending += data.length;
      if (terminal.pending > 256 * 1024 && !terminal.paused) {
        pty.pause();
        terminal.paused = true;
      }
      this.send({ sessionId: id, terminalId: terminal.id, type: 'data', data });
    });
    pty.onExit(({ exitCode }) => {
      if (this.session !== session || session.terminal !== terminal) return;
      session.terminal = null;
      this.send({ sessionId: id, terminalId: terminal.id, type: 'exit', exitCode });
    });
    return { id: terminal.id, shell: path.basename(executable) };
  }

  terminal(sessionId, terminalId) {
    const terminal = this.requireSession(sessionId).terminal;
    if (!terminal || terminal.id !== terminalId) throw new Error('终端已退出，请重新启动');
    return terminal;
  }

  dimensions(cols, rows) {
    if (
      !Number.isInteger(cols) ||
      !Number.isInteger(rows) ||
      cols < 2 ||
      cols > 1000 ||
      rows < 1 ||
      rows > 500
    )
      throw new Error('无效的终端尺寸');
  }

  write(sessionId, terminalId, data) {
    if (typeof data !== 'string' || data.length > 64 * 1024) throw new Error('无效的终端输入');
    this.terminal(sessionId, terminalId).pty.write(data);
  }

  resize(sessionId, terminalId, cols, rows) {
    this.dimensions(cols, rows);
    this.terminal(sessionId, terminalId).pty.resize(cols, rows);
  }

  acknowledge(sessionId, terminalId, length) {
    const terminal = this.terminal(sessionId, terminalId);
    if (!Number.isInteger(length) || length < 0 || length > 1024 * 1024)
      throw new Error('无效的终端确认');
    terminal.pending = Math.max(0, terminal.pending - length);
    if (terminal.paused && terminal.pending < 64 * 1024) {
      terminal.paused = false;
      terminal.pty.resume();
    }
  }

  stopTerminal(sessionId, terminalId) {
    const session = this.requireSession(sessionId);
    const terminal = this.terminal(sessionId, terminalId);
    session.terminal = null;
    try {
      terminal.pty.kill();
    } catch {}
  }

  close(id) {
    const session = this.requireSession(id);
    if (session.terminal) this.stopTerminal(id, session.terminal.id);
    this.session = null;
  }

  dispose() {
    this.revision++;
    if (this.session) this.close(this.session.id);
  }
}

module.exports = { Workbench };
