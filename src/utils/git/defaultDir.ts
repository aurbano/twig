import path from "node:path";
import { repoName } from "./repoName.js";
import { repoRoot } from "./repoRoot.js";

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
