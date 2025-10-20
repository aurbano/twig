import { createWorktree } from "./utils/git/createWorktree.js";
import { resolveWorktreePath } from "./utils/git/resolveWorktreePath.js";

/**
 * Opens a worktree by path or branch name. If the worktree doesn't exist,
 * creates it as a new branch from the base branch.
 * @param target - Either a directory path, existing branch name, or new branch name
 * @param opts - Options for worktree creation if needed
 * @returns Absolute path to the worktree directory
 */
export async function branch(
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
