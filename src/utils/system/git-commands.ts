import { execSync } from "node:child_process";
import { execa, execaCommand } from "execa";

/**
 * Execute a git command with the given arguments
 */
export async function execGit(args: string[]): Promise<string> {
	const { stdout } = await execa("git", args);
	return stdout.trim();
}

/**
 * Execute a git command synchronously (for use in completion handlers)
 */
export function execGitSync(args: string[]): string {
	try {
		return execSync(`git ${args.join(" ")}`, {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		}).trim();
	} catch {
		return "";
	}
}

/**
 * Get the repository root directory
 */
export async function execGitRepoRoot(): Promise<string> {
	return execGit(["rev-parse", "--show-toplevel"]);
}

/**
 * Get the git common directory
 */
export async function execGitCommonDir(): Promise<string> {
	return execGit(["rev-parse", "--git-common-dir"]);
}

/**
 * Get worktree list in porcelain format
 */
export async function execGitWorktreeList(): Promise<string> {
	return execGit(["worktree", "list", "--porcelain"]);
}

/**
 * Check if a git ref exists
 */
export async function execGitShowRef(ref: string): Promise<boolean> {
	try {
		await execGit(["show-ref", "--verify", ref]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get list of git branches
 */
export async function execGitBranchList(): Promise<string> {
	return execGit(["branch", "--format=%(refname:short)"]);
}

/**
 * Create a new git worktree
 */
export async function execGitWorktreeAdd(
	path: string,
	args: string[],
): Promise<void> {
	await execa("git", ["worktree", "add", path, ...args], { stdio: "inherit" });
}

/**
 * Remove a git worktree
 */
export async function execGitWorktreeRemove(
	path: string,
	force = false,
): Promise<void> {
	const args = ["worktree", "remove"];
	if (force) args.push("--force");
	args.push(path);
	await execa("git", args, { stdio: "inherit" });
}

/**
 * Delete a git branch
 */
export async function execGitBranchDelete(
	branch: string,
	force = false,
): Promise<void> {
	const flag = force ? "-D" : "-d";
	await execa("git", ["branch", flag, branch], { stdio: "inherit" });
}

/**
 * Fetch from origin
 */
export async function execGitFetch(): Promise<void> {
	await execa("git", ["fetch", "--quiet", "origin"]);
}

/**
 * Get list of tracked files
 */
export async function execGitLsFiles(cwd: string): Promise<string[]> {
	const { stdout } = await execa("git", ["ls-files"], { cwd });
	return stdout
		.split("\n")
		.map((f) => f.trim())
		.filter((f) => f.length > 0);
}

/**
 * Execute a git command string (for completion)
 */
export async function execGitCommand(command: string): Promise<string> {
	try {
		const { stdout } = await execaCommand(command);
		return stdout;
	} catch {
		return "";
	}
}
