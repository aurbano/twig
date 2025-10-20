import { confirm } from "@inquirer/prompts";
import { findOrphanedWorktrees } from "./utils/git/findOrphanedWorktrees.js";
import { execGitWorktreeRemove } from "./utils/system/git-commands.js";

/**
 * Prunes orphaned worktrees (worktrees whose branches no longer exist).
 * @param opts - Options for pruning
 * @returns Number of worktrees pruned
 */
export async function prune(opts: { yes?: boolean }): Promise<number> {
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
