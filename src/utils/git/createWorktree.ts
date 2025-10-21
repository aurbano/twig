import path from "node:path";
import { execa } from "execa";
import { fileExists, mkdir } from "../system/fs-operations.js";
import { execGitShowRef, execGitWorktreeAdd } from "../system/git-commands.js";
import { validateBranchName } from "../validation.js";
import { defaultDir } from "./defaultDir.js";
import { detectDefaultBranch } from "./detectDefaultBranch.js";
import { ensureBaseUpToDate } from "./ensureBaseUpToDate.js";
import { repoRoot } from "./repoRoot.js";

/**
 * Copies untracked files from source directory to destination directory.
 * Skips git-tracked files since they're already checked out in the worktree.
 * Includes git-ignored files like node_modules.
 * @param sourceDir - Source directory (base branch's worktree)
 * @param destDir - Destination directory (new worktree)
 */
async function copyUntrackedFiles(
	sourceDir: string,
	destDir: string,
): Promise<void> {
	try {
		// Get list of untracked files using git ls-files --others
		// This includes ALL untracked files, including those ignored by .gitignore
		const { stdout: untrackedOutput } = await execa(
			"git",
			["ls-files", "--others"],
			{ cwd: sourceDir },
		);

		const untrackedFiles = untrackedOutput
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f.length > 0);

		if (untrackedFiles.length === 0) {
			return; // No untracked files to copy
		}

		// Copy each untracked file individually
		const fs = await import("node:fs/promises");
		for (const file of untrackedFiles) {
			const srcPath = path.join(sourceDir, file);
			const destPath = path.join(destDir, file);

			try {
				// Ensure parent directory exists
				await mkdir(path.dirname(destPath));
				// Copy the file
				await fs.copyFile(srcPath, destPath);
			} catch {}
		}
		console.log(
			`Copied ${untrackedFiles.length} untracked file(s) from base branch`,
		);
	} catch (err) {
		// Non-fatal: log but don't fail the worktree creation
		console.warn(
			`Warning: Failed to copy some untracked files: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/**
 * Creates a new git worktree with a new branch.
 * @param branch - Name of the new branch to create
 * @param opts - Options for worktree creation
 * @returns Path to the created worktree directory
 */
export async function createWorktree(
	branch: string,
	opts: { base?: string; dir?: string; yes?: boolean },
) {
	validateBranchName(branch);

	const base = opts.base ?? (await detectDefaultBranch());
	const baseRef = await ensureBaseUpToDate(base);

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

	return dir;
}
