import path from "node:path";
import { fileExists } from "../system/fs-operations.js";
import { parseWorktrees } from "./parseWorktrees.js";

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
