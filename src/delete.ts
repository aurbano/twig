import { confirm } from "@inquirer/prompts";
import { parseWorktrees } from "./utils/git/parseWorktrees.js";
import { resolveWorktreePath } from "./utils/git/resolveWorktreePath.js";
import {
	execGitBranchDelete,
	execGitShowRef,
	execGitWorktreeRemove,
} from "./utils/system/git-commands.js";

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
