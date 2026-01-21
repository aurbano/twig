import { detectDependencies } from "../dependencies/detectDependencies.js";
import { runInstall } from "../dependencies/runInstall.js";
import { fileExists } from "../system/fs-operations.js";
import { execGitWorktreeAdd } from "../system/git-commands.js";
import { validateBranchName } from "../validation.js";
import { copyUntrackedFiles } from "./copyUntrackedFiles.js";
import { defaultDir } from "./defaultDir.js";
import { repoRoot } from "./repoRoot.js";

/**
 * Creates a git worktree for an existing branch.
 * @param branch - Name of the existing branch
 * @param opts - Options for worktree creation
 * @returns Path to the created worktree directory
 */
export async function createWorktreeForExistingBranch(
	branch: string,
	opts: { dir?: string; yes?: boolean; noInstall?: boolean } = {},
) {
	validateBranchName(branch);

	// Capture the repo root for copying untracked files
	const baseDir = await repoRoot();

	const dir = opts.dir ?? (await defaultDir(branch));

	// Check if directory exists (git will also check, but we provide a better error message)
	if (await fileExists(dir)) {
		throw new Error(
			`Directory already exists: ${dir}. Choose a different directory with --dir`,
		);
	}

	// Create worktree for existing branch (without -b flag)
	await execGitWorktreeAdd(dir, [branch]);
	console.log(`Created worktree at ${dir}`);

	await copyUntrackedFiles(baseDir, dir);

	// Detect and offer to install dependencies
	const depManager = await detectDependencies(dir);
	if (depManager) {
		await runInstall(dir, depManager, {
			...(opts.yes !== undefined && { yes: opts.yes }),
			...(opts.noInstall !== undefined && { noInstall: opts.noInstall }),
		});
	}

	return dir;
}
