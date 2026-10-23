function terminalEnvironment(source = process.env) {
  const env = { ...source };
  // The desktop host can inherit output preferences from an automation runner.
  // A new interactive PTY must detect its own color capabilities, rather than
  // inheriting NO_COLOR=1, FORCE_COLOR=0 or a CI-only color downgrade.
  const hostOnly = new Set([
    'NO_COLOR',
    'FORCE_COLOR',
    'CLICOLOR',
    'CLICOLOR_FORCE',
    'CI',
    'NODE_OPTIONS',
    'NODE_INSPECTOR_IPC',
  ]);
  for (const name of Object.keys(env))
    if (name.startsWith('ELECTRON_') || name.startsWith('BKPM_') || hostOnly.has(name))
      delete env[name];
  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'BKProjectManager',
  };
}

module.exports = { terminalEnvironment };
