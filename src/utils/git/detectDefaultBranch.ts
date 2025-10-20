import { execGitShowRef } from "../system/git-commands.js";

/**
 * Detects the default branch by trying 'main' first, then 'master'.
 * Checks both local and remote branches.
 * @returns The detected default branch name ('main' or 'master')
 * @throws Error if neither 'main' nor 'master' exists locally or on origin
 */
export async function detectDefaultBranch(): Promise<string> {
	const candidates = ["main", "master"];

	for (const branch of candidates) {
		// Check if branch exists locally
		const localExists = await execGitShowRef(`refs/heads/${branch}`);

		if (localExists) {
			return branch;
		}

		// Check if branch exists on origin
		const remoteExists = await execGitShowRef(`refs/remotes/origin/${branch}`);

		if (remoteExists) {
			return branch;
		}
	}

	throw new Error(
		"Could not detect default branch. Neither 'main' nor 'master' exists locally or on origin. Please specify a base branch with --base.",
	);
}
