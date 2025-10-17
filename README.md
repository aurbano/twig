# 🌿 Twig

Lightweight CLI to manage multiple Git worktrees with optional [VSCode Dev Container](https://code.visualstudio.com/docs/devcontainers/containers) integration. Perfect for concurrent feature development with LLM coding assistants.

## Why?

`twig` makes it effortless to work on multiple branches of the same repo at the same time in isolated folders that are mapped to git branches.

This can be useful for traditional development, where you might need to do a quick bug fix without leaving the branch you were working on.
And it can be even more useful for LLM-assisted coding, allowing you to have multiple parallel instances working independently.

## Installation

```bash
npm install -g @aurbano/twig

# Optional: Enable tab completion
twig completion --setup
```

## Usage
Run from the root of the repo you want to work with.

```bash
# Switch to a branch worktree (creates it if it doesn't exist)
twig branch <branch-or-path>
twig b <branch-or-path>  # short alias

# List all worktrees
twig list
twig ls  # short alias

# Delete a worktree
twig delete <branch-or-path>
twig d <branch-or-path>  # short alias

# Remove orphaned worktrees (branches that no longer exist)
twig prune
twig p  # short alias

# Initialize dev container configuration
twig init-devcontainer [options]
twig i [options]  # short alias

# Enable shell completion (bash/zsh)
twig completion --setup
```

### Options

**`branch`**
- `--base <base>` - Base branch for new worktrees (auto-detects `main` or `master` if not specified)
- `-d, --dir <dir>` - Target directory for new worktrees (default: `../<repo>-<branch>`)
- `--in-container` - Start dev container before opening
- `-y, --yes` - Skip confirmation prompts when creating new worktrees

**`delete`**
- `--keep-branch` - Keep the git branch after removing worktree
- `-y, --yes` - Skip confirmation prompts

**`prune`**
- `-y, --yes` - Skip confirmation prompts

**`init-devcontainer`**
- `--image <img>` - Base Docker image
- `--packages <list>` - Space-separated apt packages to install
- `--ports <csv>` - Comma-separated ports to forward (e.g., `3000,8080`)
- `--postcreate <cmd>` - Command to run after container creation
- `--mount-node-modules` - Add node_modules volume mount

**`completion`**
- `--setup` - Install shell completion (bash/zsh)
- `--cleanup` - Remove shell completion

## Shell Completion

Tab completion makes using `twig` much faster by auto-completing commands and git branches.

### Installation

```bash
# Install shell completion (works for bash and zsh)
twig completion --setup

# Then restart your terminal or source your shell config:
source ~/.bashrc  # for bash
source ~/.zshrc   # for zsh
```

To remove completion:
```bash
twig completion --cleanup
```

### What Gets Completed

- **Commands**: `branch`, `list`, `delete`, `prune`, `init-devcontainer` (and all their aliases: `b`, `ls`, `d`, `p`, `i`)
- **Git branches**: When using `twig branch <TAB>`, all your local git branches will be suggested
- **Worktree branches**: When using `twig delete <TAB>`, only branches that have active worktrees will be suggested

## Configuration

`twig` allows you to configure which editor to open when switching to a worktree. While the shell has an `$EDITOR` variable, most developers set it to `vim` for terminal use, even if they prefer Cursor, VS Code, or Claude for their main development.

### Config File Locations

`twig` looks for configuration in the following order (first match wins):

1. **Per-project**: `.twig` file in the repository root
2. **Global**:
   - `~/.config/twig/config.json` (Linux/macOS)
   - `%APPDATA%\twig\config.json` (Windows)
3. **Smart defaults**: Auto-detected based on project markers (see below)
4. **Fallback**: Tries `cursor`, then `code` commands

### Config Format

You can use either a simple string format or a structured format for more control:

**Simple format** (most common):
```json
{
  "editor": "cursor"
}
```

**Structured format** (with custom arguments):
```json
{
  "editor": {
    "command": "cursor",
    "args": ["--wait", "."]
  }
}
```

### Supported Editor Shortcuts

Common editor shortcuts are recognized and will use friendly names in output:

- `cursor` - Cursor AI editor
- `code` - Visual Studio Code
- `claude` - Claude.ai editor
- `vim` - Vim
- `nvim` - Neovim
- `emacs` - Emacs
- `nano` - Nano
- Custom commands and full paths are also supported

### Smart Defaults

If no configuration file is found, `twig` will try to detect your preferred editor based on project markers:

- `.cursor/` folder → Opens with Cursor
- `.vscode/` folder → Opens with VS Code
- `.claude/` folder → Opens with Claude

This means projects will automatically open in the right editor without any configuration in most cases.

### Configuration Examples

**Skip editor launch entirely** (useful if you prefer to open editors manually):
```json
{
  "editor": "none"
}
```

**Use Vim** (great for quick edits):
```json
{
  "editor": "vim"
}
```

**Use custom editor with specific arguments**:
```json
{
  "editor": {
    "command": "code",
    "args": ["--new-window", "--goto", "."]
  }
}
```

**Use custom editor path**:
```json
{
  "editor": "/usr/local/bin/my-editor"
}
```

**Per-project override**: Create a `.twig` file in your repo:
```bash
echo '{"editor": "vim"}' > .twig
```

You can add `.twig` to `.gitignore` for personal preferences, or commit it for team-wide defaults.

## Examples

### Basic Workflow

```bash
# Switch to a feature branch (creates worktree if it doesn't exist)
# Base branch (main/master) is automatically detected
twig branch feature/new-api

# Work on the feature...

# List all active worktrees
twig list

# Switch to another worktree (or create it if it doesn't exist)
twig branch hotfix/urgent-bug

# Clean up when done
twig delete feature/new-api

# Or, if you deleted branches directly with git, clean up orphaned worktrees
# git branch -D feature/old-feature
twig prune
```

### With Dev Containers

```bash
# Initialize dev container in your repository
twig init-devcontainer \
  --image mcr.microsoft.com/devcontainers/typescript-node:20 \
  --packages "git curl" \
  --ports "3000,8080" \
  --postcreate "npm install"

# Switch to worktree and start it in a container (creates if needed)
twig branch feature/containerized --in-container

# Switch to existing worktree in its container
twig branch main --in-container
```

### Multi-Feature Development

```bash
# Work on multiple features simultaneously
twig branch feature/auth
twig branch feature/api
twig branch feature/ui

# Each worktree is isolated with its own:
# - Working directory
# - Git branch
# - Optional dev container
```

### Automatic Cleanup

When you use `twig branch` for the first time, it automatically installs a git `post-checkout` hook that prunes orphaned worktrees. This means if you delete a branch directly (e.g., `git branch -D feature/old`), the corresponding worktree will be automatically removed the next time you checkout a branch.

You can also manually trigger cleanup anytime:

```bash
twig prune
```

## Development

### Prerequisites

- Node.js 22+
- Git 2.5+

### Setup

```bash
# Clone and install
git clone https://github.com/aurbano/twig.git
cd twig
npm install  # This also sets up git hooks via husky

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

**Note:** A pre-commit hook is automatically installed that runs `lint` and `typecheck` before each commit.

### Running Locally

```bash
# Build and run
npm run build
node dist/index.js <command>

# Or use npm link for global testing
npm link
twig <command>
```
