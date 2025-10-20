import { execGitSync, execGitWorktreeList } from "../system/git-commands.js";

/**
 * Helper function to parse worktree list output into structured data.
 * This is the core parsing logic shared by both sync and async versions.
 * @param stdout - Output from `git worktree list --porcelain`
 * @returns Array of worktree information objects
 */
function parseWorktreeOutput(
	stdout: string,
): Array<{ path: string; branch?: string; head?: string }> {
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
 * Parses the output of `git worktree list --porcelain` into structured data.
 * Note: This relies on the porcelain format which should be stable across git versions.
 * @returns Array of worktree information objects
 */
export async function parseWorktrees(): Promise<
	Array<{ path: string; branch?: string; head?: string }>
> {
	const stdout = await execGitWorktreeList();
	return parseWorktreeOutput(stdout);
}

/**
 * Synchronously parses the output of `git worktree list --porcelain` into structured data.
 * Used by completion handlers which cannot be async.
 * @returns Array of worktree information objects
 */
export function parseWorktreesSync(): Array<{
	path: string;
	branch?: string;
	head?: string;
}> {
	const stdout = execGitSync(["worktree", "list", "--porcelain"]);
	return parseWorktreeOutput(stdout);
}
