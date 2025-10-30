import path from "node:path";
import { execa } from "execa";
import { mkdir } from "../system/fs-operations.js";

/**
 * Copies untracked files from source directory to destination directory.
 * Skips git-tracked files since they're already checked out in the worktree.
 * Includes git-ignored files like node_modules.
 * @param sourceDir - Source directory (base branch's worktree)
 * @param destDir - Destination directory (new worktree)
 */
export async function copyUntrackedFiles(
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
