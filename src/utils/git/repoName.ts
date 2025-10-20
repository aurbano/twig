import path from "node:path";
import { execGitCommonDir } from "../system/git-commands.js";
import { repoRoot } from "./repoRoot.js";

/**
 * Gets the name of the current git repository (basename of root directory).
 * When called from a worktree, returns the main repository name, not the worktree name.
 * @returns Repository name
 */
export async function repoName(): Promise<string> {
	// Get the common git directory (points to the main .git directory even from worktrees)
	const commonDir = await execGitCommonDir();

	// If it's a main repository (not a worktree), commonDir will be ".git"
	// If it's a worktree, commonDir will be an absolute path to the main .git directory
	if (commonDir === ".git") {
		// We're in the main repository
		return path.basename(await repoRoot());
	}

	// We're in a worktree, get the main repository name from the common git dir
	// The common dir is like /path/to/main-repo/.git, so go up one level
	const mainRepoPath = path.dirname(commonDir);
	return path.basename(mainRepoPath);
}
