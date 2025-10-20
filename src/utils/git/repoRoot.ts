import { execGitRepoRoot } from "../system/git-commands.js";

/**
 * Gets the root directory of the current git repository.
 * @returns Absolute path to the repository root
 */
export async function repoRoot(): Promise<string> {
	return execGitRepoRoot();
}
