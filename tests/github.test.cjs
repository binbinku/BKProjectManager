const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { githubURL, readGitHubRemotes } = require('../electron/github.cjs');
const { scanWorkspace } = require('../electron/scanner.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bkpm-github-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'WebDev/Projects/Demo');
  await fs.mkdir(path.join(project, '.git'), { recursive: true });
  return { root, project, config: path.join(project, '.git/config') };
}

test('GitHub clone URLs normalize to credential-free HTTPS repository pages', () => {
  for (const input of [
    'https://github.com/Owner/repo.git',
    'git@github.com:Owner/repo.git',
    'github.com:Owner/repo.git',
    'ssh://git@github.com/Owner/repo.git',
    'ssh://git@ssh.github.com:443/Owner/repo.git',
    'git://github.com/Owner/repo.git',
    'http://github.com/Owner/repo/',
    'https://private-token:password@github.com/Owner/repo.git',
  ])
    assert.equal(githubURL(input), 'https://github.com/Owner/repo');
  for (const input of [
    'https://gitlab.com/owner/repo.git',
    'https://github.com.evil.test/owner/repo',
    'https://github.com@evil.test/owner/repo',
    'javascript:alert(1)',
    'file:///owner/repo',
    'https://github.com/owner/repo/issues',
    'https://github.com/owner/repo?token=secret',
    'https://github.com/owner/repo#readme',
    'git@github.com:owner/repo.git\n',
    'https://github.com/owner/%2frepo',
    'https://github.com/owner/.git',
    null,
  ])
    assert.equal(githubURL(input), null);
});

test('Local remotes handle quotes/comments, prefer origin, omit push URLs and deduplicate repositories', async (t) => {
  const { root, project, config } = await fixture(t);
  await fs.writeFile(
    config,
    `
[remote "upstream"]
  url = https://github.com/team/Upstream.git
[remote "mirror"]
  url = git@github.com:owner/demo.git
[remote "origin"]
  url = "https://private-token@github.com/Owner/Demo.git" # local credentials stay private
  pushurl = https://github.com/other/push-only.git
[remote "gitlab"]
  url = https://gitlab.com/team/project.git
[remote "multi"]
  url = https://gitlab.com/team/fetch.git
  url = https://github.com/team/push.git
`,
  );
  assert.deepEqual(await readGitHubRemotes(project), [
    { name: 'origin', repository: 'Owner/Demo', url: 'https://github.com/Owner/Demo' },
    { name: 'upstream', repository: 'team/Upstream', url: 'https://github.com/team/Upstream' },
  ]);
  const scan = await scanWorkspace(root);
  assert.equal(scan.projects.length, 1);
  assert.deepEqual(scan.projects[0].githubRemotes, await readGitHubRemotes(project));
  assert.ok(!JSON.stringify(scan).includes('private-token'));
});

test('Git files resolve linked worktree/submodule metadata and optional worktree configuration', async (t) => {
  const { root, project } = await fixture(t);
  await fs.rm(path.join(project, '.git'), { recursive: true });
  const common = path.join(root, 'main.git');
  const git = path.join(common, 'worktrees/demo');
  await fs.mkdir(git, { recursive: true });
  await fs.writeFile(path.join(project, '.git'), `gitdir: ${path.relative(project, git)}\n`);
  await fs.writeFile(path.join(git, 'commondir'), '../..\n');
  await fs.writeFile(
    path.join(common, 'config'),
    '[extensions]\nworktreeConfig = true\n[remote "origin"]\nurl = git@github.com:team/common.git\n',
  );
  await fs.writeFile(
    path.join(git, 'config.worktree'),
    '[remote "upstream"]\nurl = https://github.com/team/upstream.git\n',
  );
  assert.deepEqual(
    (await readGitHubRemotes(project)).map((r) => r.name),
    ['origin', 'upstream'],
  );
  await fs.rm(path.join(git, 'commondir'));
  await fs.writeFile(
    path.join(git, 'config'),
    '[remote "origin"]\nurl = https://github.com/team/submodule.git\n',
  );
  assert.equal((await readGitHubRemotes(project))[0].url, 'https://github.com/team/submodule');
});

test('Missing, non-GitHub, malformed and oversized metadata leaves projects usable without a GitHub entry', async (t) => {
  const { project, config } = await fixture(t);
  for (const content of [
    '[remote "origin"]\nurl = "https://github.com/owner/broken.git',
    '[remote "origin"]\nurl = file:///tmp/local',
    'x'.repeat(256 * 1024 + 1),
    '{}',
  ]) {
    await fs.writeFile(config, content);
    assert.deepEqual(await readGitHubRemotes(project), []);
  }
  await fs.rm(path.join(project, '.git'), { recursive: true });
  assert.deepEqual(await readGitHubRemotes(project), []);
});
