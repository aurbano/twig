import { parseWorktrees } from "./utils/git/parseWorktrees.js";

/**
 * Lists all git worktrees as simple branch names.
 */
export async function list() {
	const items = await parseWorktrees();
	for (const it of items) {
		console.log(it.branch ?? "<detached>");
	}
}
