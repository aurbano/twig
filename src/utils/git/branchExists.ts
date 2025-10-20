import { execGitShowRef } from "../system/git-commands.js";

/**
 * Checks if a branch exists locally.
 * @param branch - The branch name to check
 * @returns True if the branch exists, false otherwise
 */
export async function branchExists(branch: string): Promise<boolean> {
	return execGitShowRef(`refs/heads/${branch}`);
}
