import { Github } from 'lucide-react';
import type { Project } from './types';

export function GitHubButton({
  project,
  busy,
  onOpen,
  workbench = false,
}: {
  project: Project;
  busy: boolean;
  onOpen(): void;
  workbench?: boolean;
}) {
  if (!project.githubRemotes.length) return null;
  const title =
    project.githubRemotes.length === 1
      ? `打开 GitHub 仓库 · ${project.githubRemotes[0].repository}`
      : '选择 GitHub 远程仓库';
  return (
    <button
      className={workbench ? 'external-open github-open' : 'github-open'}
      aria-label={`打开 ${project.name} 的 GitHub 仓库`}
      title={title}
      aria-haspopup={project.githubRemotes.length > 1 ? 'menu' : undefined}
      disabled={busy}
      onClick={onOpen}
    >
      <Github size={workbench ? 18 : 16} />
    </button>
  );
}
