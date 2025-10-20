import { branchExists } from "./branchExists.js";
import { parseWorktrees } from "./parseWorktrees.js";

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
