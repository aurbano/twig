import { detectDependencies } from "../dependencies/detectDependencies.js";
import { runInstall } from "../dependencies/runInstall.js";
import { fileExists } from "../system/fs-operations.js";
import {
	execGit,
	execGitShowRef,
	execGitWorktreeAdd,
} from "../system/git-commands.js";
import { validateBranchName } from "../validation.js";
import { copyUntrackedFiles } from "./copyUntrackedFiles.js";
import { defaultDir } from "./defaultDir.js";
import { detectDefaultBranch } from "./detectDefaultBranch.js";
import { ensureBaseUpToDate } from "./ensureBaseUpToDate.js";
import { repoRoot } from "./repoRoot.js";

/**
 * Creates a new git worktree with a new branch.
 * @param branch - Name of the new branch to create
 * @param opts - Options for worktree creation
 * @returns Path to the created worktree directory
 */
export async function createWorktree(
	branch: string,
	opts: {
		base?: string;
		dir?: string;
		yes?: boolean;
		offline?: boolean;
		noInstall?: boolean;
	},
) {
	validateBranchName(branch);

	const base = opts.base ?? (await detectDefaultBranch());

	let baseRef: string;
	if (opts.offline) {
		// In offline mode, use the local branch directly without fetching
		const localExists = await execGitShowRef(`refs/heads/${base}`);
		if (!localExists) {
			throw new Error(
				`Branch '${base}' does not exist locally. Remove --offline flag to fetch from origin.`,
			);
		}
		// Get the commit SHA of the local branch
		baseRef = await execGit(["rev-parse", base]);
		console.log(`Using local branch ${base} (offline mode)`);
	} else {
		baseRef = await ensureBaseUpToDate(base);
	}

	// Capture the base branch's working directory path for copying untracked files
	const baseDir = await repoRoot();

	const dir = opts.dir ?? (await defaultDir(branch));

	// Check if branch exists (prevent accidental overwrites)
	if (await execGitShowRef(`refs/heads/${branch}`)) {
		throw new Error(`Branch '${branch}' already exists.`);
	}

	// Check if directory exists (git will also check, but we provide a better error message)
	if (await fileExists(dir)) {
		throw new Error(
			`Directory already exists: ${dir}. Choose a different directory with --dir`,
		);
	}

	await execGitWorktreeAdd(dir, ["-b", branch, baseRef]);
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
