import {
	execGit,
	execGitFetch,
	execGitShowRef,
} from "../system/git-commands.js";

/**
 * Ensures the base branch is up to date by fetching from origin.
 * Returns the commit SHA to use for creating the worktree.
 * @param base - The base branch name to update
 * @returns The commit SHA of the remote base branch (prevents automatic upstream tracking)
 */
export async function ensureBaseUpToDate(base: string): Promise<string> {
	// Verify origin remote exists
	const remotes = await execGit(["remote"]);
	if (!remotes.includes("origin")) {
		throw new Error(
			"No 'origin' remote found. Please add a remote named 'origin' or manually fetch and create the base branch.",
		);
	}

	// Fetch updates
	try {
		await execGitFetch();
	} catch (err) {
		throw new Error(
			`Failed to fetch from origin: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Check if remote branch exists
	const remoteExists = await execGitShowRef(`refs/remotes/origin/${base}`);

	if (!remoteExists) {
		throw new Error(
			`Branch '${base}' does not exist on origin. Please specify a valid base branch.`,
		);
	}

	// Get the commit SHA that the remote branch points to
	// Using SHA instead of remote branch ref prevents automatic upstream tracking
	const commitSha = await execGit(["rev-parse", `origin/${base}`]);

	return commitSha;
}
