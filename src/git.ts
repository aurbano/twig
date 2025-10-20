import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { execa } from "execa";
import {
	copyFilesWithFilter,
	fileExists,
	mkdir,
	readFile,
	writeFile,
} from "./commands/fs-operations.js";
import {
	execGit,
	execGitBranchDelete,
	execGitCommonDir,
	execGitFetch,
	execGitLsFiles,
	execGitRepoRoot,
	execGitShowRef,
	execGitWorktreeAdd,
	execGitWorktreeList,
	execGitWorktreeRemove,
} from "./commands/git-commands.js";
import { validateBranchName } from "./validation.js";

/**
 * Gets the root directory of the current git repository.
 * @returns Absolute path to the repository root
 */
export async function repoRoot(): Promise<string> {
	return execGitRepoRoot();
}

/**
 * Gets the name of the current git repository (basename of root directory).
 * When called from a worktree, returns the main repository name, not the worktree name.
 * @returns Repository name
 */
export async function repoName(): Promise<string> {
	// Get the common git directory (points to the main .git directory even from worktrees)
	const commonDir = await execGitCommonDir();

	// If it's a main repository (not a worktree), commonDir will be ".git"
	// If it's a worktree, commonDir will be an absolute path to the main .git directory
	if (commonDir === ".git") {
		// We're in the main repository
		return path.basename(await repoRoot());
	}

	// We're in a worktree, get the main repository name from the common git dir
	// The common dir is like /path/to/main-repo/.git, so go up one level
	const mainRepoPath = path.dirname(commonDir);
	return path.basename(mainRepoPath);
}

/**
 * Detects the default branch by trying 'main' first, then 'master'.
 * Checks both local and remote branches.
 * @returns The detected default branch name ('main' or 'master')
 * @throws Error if neither 'main' nor 'master' exists locally or on origin
 */
export async function detectDefaultBranch(): Promise<string> {
	const candidates = ["main", "master"];

	for (const branch of candidates) {
		// Check if branch exists locally
		const localExists = await execGitShowRef(`refs/heads/${branch}`);

		if (localExists) {
			return branch;
		}

		// Check if branch exists on origin
		const remoteExists = await execGitShowRef(`refs/remotes/origin/${branch}`);

		if (remoteExists) {
			return branch;
		}
	}

	throw new Error(
		"Could not detect default branch. Neither 'main' nor 'master' exists locally or on origin. Please specify a base branch with --base.",
	);
}

/**
 * Ensures the base branch is up to date by fetching from origin.
 * Returns the commit SHA to use for creating the worktree.
 * @param base - The base branch name to update
 * @returns The commit SHA of the remote base branch (prevents automatic upstream tracking)
 */
export async function ensureBaseUpToDate(base: string): Promise<string> {
	// Verify origin remote exists
	const remotes = await execGit(["remote"]);
	if (!remotes.includes("origin")) {
		throw new Error(
			"No 'origin' remote found. Please add a remote named 'origin' or manually fetch and create the base branch.",
		);
	}

	// Fetch updates
	try {
		await execGitFetch();
	} catch (err) {
		throw new Error(
			`Failed to fetch from origin: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Check if remote branch exists
	const remoteExists = await execGitShowRef(`refs/remotes/origin/${base}`);

	if (!remoteExists) {
		throw new Error(
			`Branch '${base}' does not exist on origin. Please specify a valid base branch.`,
		);
	}

	// Get the commit SHA that the remote branch points to
	// Using SHA instead of remote branch ref prevents automatic upstream tracking
	const commitSha = await execGit(["rev-parse", `origin/${base}`]);

	return commitSha;
}

/**
 * Generates the default directory path for a worktree.
 * Creates a sibling directory to the repo root named <repo>-<branch>
 * @param branch - The branch name
 * @returns Absolute path to the default worktree directory
 */
export async function defaultDir(branch: string): Promise<string> {
	const root = await repoRoot();
	return path.resolve(path.dirname(root), `${await repoName()}-${branch}`);
}

/**
 * Copies untracked files from source directory to destination directory.
 * Skips git-tracked files since they're already checked out in the worktree.
 * @param sourceDir - Source directory (base branch's worktree)
 * @param destDir - Destination directory (new worktree)
 */
async function copyUntrackedFiles(
	sourceDir: string,
	destDir: string,
): Promise<void> {
	// Get list of tracked files relative to the repo root
	const trackedFilesList = await execGitLsFiles(sourceDir);
	const trackedFiles = new Set(trackedFilesList);

	// Copy files with filtering
	try {
		await copyFilesWithFilter(sourceDir, destDir, (src, _dest) => {
			const relativePath = path.relative(sourceDir, src);

			// Always exclude .git directory
			if (relativePath === ".git" || relativePath.startsWith(".git/")) {
				return false;
			}

			// Skip tracked files (they're already checked out)
			if (trackedFiles.has(relativePath)) {
				return false;
			}

			return true;
		});
		console.log("Copied untracked files from base branch");
	} catch (err) {
		// Non-fatal: log but don't fail the worktree creation
		console.warn(
			`Warning: Failed to copy some untracked files: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/**
 * Creates a new git worktree with a new branch.
 * @param branch - Name of the new branch to create
 * @param opts - Options for worktree creation
 * @returns Path to the created worktree directory
 */
export async function createWorktree(
	branch: string,
	opts: { base?: string; dir?: string; yes?: boolean },
) {
	validateBranchName(branch);

	const base = opts.base ?? (await detectDefaultBranch());
	const baseRef = await ensureBaseUpToDate(base);

	// Capture the base branch's working directory path for copying untracked files
	const baseDir = await repoRoot();

	const dir = opts.dir ?? (await defaultDir(branch));

	// Check if branch exists (prevent accidental overwrites)
	if (await execGitShowRef(`refs/heads/${branch}`)) {
		throw new Error(`Branch '${branch}' already exists.`);
	}

	// Check if directory exists (git will also check, but we provide a better error message)
	if (await fileExists(dir)) {
		throw new Error(
			`Directory already exists: ${dir}. Choose a different directory with --dir`,
		);
	}

	await execGitWorktreeAdd(dir, ["-b", branch, baseRef]);
	console.log(`Created worktree at ${dir}`);

	await copyUntrackedFiles(baseDir, dir);

	return dir;
}

/**
 * Parses the output of `git worktree list --porcelain` into structured data.
 * Note: This relies on the porcelain format which should be stable across git versions.
 * @returns Array of worktree information objects
 */
export async function parseWorktrees(): Promise<
	Array<{ path: string; branch?: string; head?: string }>
> {
	const stdout = await execGitWorktreeList();
	const lines = stdout.split("\n");
	const items: Array<{ path: string; branch?: string; head?: string }> = [];
	let cur: { path?: string; branch?: string; head?: string } = {};
	for (const line of lines) {
		if (!line.trim()) continue;
		if (line.startsWith("worktree ")) {
			if (cur.path)
				items.push(cur as { path: string; branch?: string; head?: string });
			cur = { path: line.slice("worktree ".length).trim() };
		} else if (line.startsWith("branch ")) {
			cur.branch = line
				.slice("branch ".length)
				.trim()
				.replace(/^refs\/heads\//, "");
		} else if (line.startsWith("HEAD ")) {
			cur.head = line.slice("HEAD ".length).trim();
		}
		// Ignore unknown fields for forward compatibility
	}
	if (cur.path && cur.path.length > 0)
		items.push(cur as { path: string; branch?: string; head?: string });
	return items;
}

/**
 * Lists all git worktrees as simple branch names.
 */
export async function listWorktrees() {
	const items = await parseWorktrees();
	for (const it of items) {
		console.log(it.branch ?? "<detached>");
	}
}

/**
 * Resolves a worktree target (path or branch name) to an absolute directory path.
 * Returns null if not found.
 * @param target - Either a directory path or a branch name
 * @returns Absolute path to the worktree directory, or null if not found
 */
export async function resolveWorktreePath(
	target: string,
): Promise<string | null> {
	// if path exists, use it
	if (await fileExists(target)) {
		return path.resolve(target);
	}
	// else find by branch
	const items = await parseWorktrees();
	const hit = items.find((i) => i.branch === target);
	return hit?.path ?? null;
}

/**
 * Opens a worktree by path or branch name. If the worktree doesn't exist,
 * creates it as a new branch from the base branch.
 * @param target - Either a directory path, existing branch name, or new branch name
 * @param opts - Options for worktree creation if needed
 * @returns Absolute path to the worktree directory
 */
export async function openWorktree(
	target: string,
	opts: { base?: string; dir?: string; yes?: boolean } = {},
) {
	// Try to resolve existing worktree
	const existing = await resolveWorktreePath(target);
	if (existing) {
		return existing;
	}

	// Worktree doesn't exist, create it as a new branch
	console.log(
		`Worktree not found. Creating new worktree for branch: ${target}`,
	);
	return await createWorktree(target, opts);
}

/**
 * Deletes a git worktree and optionally its associated branch.
 * @param target - Either a directory path or a branch name
 * @param opts - Options for deletion
 */
export async function deleteWorktree(
	target: string,
	opts: { keepBranch?: boolean; yes?: boolean },
) {
	const dir = await resolveWorktreePath(target);
	if (!dir) {
		throw new Error(
			`No worktree found for '${target}'. Use 'twig list' to see available worktrees.`,
		);
	}
	const items = await parseWorktrees();
	const it = items.find((i) => i.path === dir);
	const proceed =
		opts.yes ||
		(await confirm({
			message: `Delete worktree ${dir}${opts.keepBranch ? "" : ` and branch ${it?.branch ?? ""}`}?`,
			default: false,
		}));
	if (!proceed) throw new Error("Aborted.");

	await execGitWorktreeRemove(dir, true);
	if (!opts.keepBranch && it?.branch) {
		const exist = await execGitShowRef(`refs/heads/${it.branch}`);
		if (exist) {
			await execGitBranchDelete(it.branch, true);
		}
	}
	console.log(`Removed worktree${opts.keepBranch ? "" : " and branch"}.`);
}

/**
 * Checks if a branch exists locally.
 * @param branch - The branch name to check
 * @returns True if the branch exists, false otherwise
 */
export async function branchExists(branch: string): Promise<boolean> {
	return execGitShowRef(`refs/heads/${branch}`);
}

/**
 * Finds worktrees whose branches no longer exist (orphaned worktrees).
 * @returns Array of orphaned worktree information objects
 */
export async function findOrphanedWorktrees(): Promise<
	Array<{ path: string; branch: string }>
> {
	const worktrees = await parseWorktrees();
	const orphaned: Array<{ path: string; branch: string }> = [];

	for (const wt of worktrees) {
		// Skip worktrees without a branch (detached HEAD, or main worktree)
		if (!wt.branch) continue;

		// Check if the branch still exists
		if (!(await branchExists(wt.branch))) {
			orphaned.push({ path: wt.path, branch: wt.branch });
		}
	}

	return orphaned;
}

/**
 * Prunes orphaned worktrees (worktrees whose branches no longer exist).
 * @param opts - Options for pruning
 * @returns Number of worktrees pruned
 */
export async function pruneOrphanedWorktrees(opts: {
	yes?: boolean;
}): Promise<number> {
	const orphaned = await findOrphanedWorktrees();

	if (orphaned.length === 0) {
		console.log("No orphaned worktrees found.");
		return 0;
	}

	console.log(`Found ${orphaned.length} orphaned worktree(s):`);
	for (const wt of orphaned) {
		console.log(`  ${wt.path} (branch: ${wt.branch})`);
	}

	const proceed =
		opts.yes ||
		(await confirm({
			message: `Remove ${orphaned.length} orphaned worktree(s)?`,
			default: true,
		}));

	if (!proceed) {
		throw new Error("Aborted.");
	}

	for (const wt of orphaned) {
		try {
			await execGitWorktreeRemove(wt.path, true);
			console.log(`Removed: ${wt.path}`);
		} catch (err) {
			console.error(
				`Failed to remove ${wt.path}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	return orphaned.length;
}

/**
 * Installs the post-checkout git hook to automatically prune orphaned worktrees.
 * The hook will be created if it doesn't exist, or updated if it doesn't contain the prune command.
 * @returns True if the hook was installed/updated, false if it was already present
 */
export async function installPruneHook(): Promise<boolean> {
	const root = await repoRoot();
	const gitDir = await execGit(["rev-parse", "--git-dir"]);
	const hooksDir = path.resolve(root, gitDir, "hooks");
	const hookPath = path.join(hooksDir, "post-checkout");

	// Ensure hooks directory exists
	await mkdir(hooksDir);

	const hookContent = `#!/bin/sh
# Auto-installed by twig: prune orphaned worktrees
twig prune --yes 2>/dev/null || true
`;

	try {
		const existingContent = await readFile(hookPath);

		// Check if our hook is already present
		if (existingContent.includes("twig prune")) {
			return false; // Already installed
		}

		// Append to existing hook
		await writeFile(hookPath, existingContent + `\n${hookContent}`);
		console.log("Updated existing post-checkout hook to include twig prune.");
	} catch {
		// File doesn't exist, create it
		await writeFile(hookPath, hookContent);
		// Make executable
		await execa("chmod", ["755", hookPath]);
		console.log(
			"Installed post-checkout hook to automatically prune orphaned worktrees.",
		);
	}

	return true;
}
