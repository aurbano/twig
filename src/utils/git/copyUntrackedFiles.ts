import path from "node:path";
import readline from "node:readline";
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

		// Copy each untracked file individually with progress indicator
		const fs = await import("node:fs/promises");
		let completed = 0;
		const total = untrackedFiles.length;
		const updateInterval = Math.max(1, Math.floor(total / 100)); // Update at most 100 times
		let lastUpdateTime = Date.now();
		const throttleMs = 100; // Minimum time between updates in milliseconds

		// Show initial progress (0%)
		updateProgressBar(0, total);

		for (const file of untrackedFiles) {
			const srcPath = path.join(sourceDir, file);
			const destPath = path.join(destDir, file);

			try {
				// Ensure parent directory exists
				await mkdir(path.dirname(destPath));
				// Copy the file
				await fs.copyFile(srcPath, destPath);
				completed++;

				// Update progress bar, throttled to avoid excessive console writes
				const now = Date.now();
				if (
					completed % updateInterval === 0 ||
					completed === total ||
					now - lastUpdateTime >= throttleMs
				) {
					updateProgressBar(completed, total);
					lastUpdateTime = now;
				}
			} catch {}
		}

		// Show final progress (100%) before clearing
		updateProgressBar(total, total);
		// Clear progress line and show final message
		clearProgressLine();
		console.log(
			`Copied ${untrackedFiles.length} untracked file(s) from base branch`,
		);
	} catch (err) {
		// Clear progress line on error too
		clearProgressLine();
		// Non-fatal: log but don't fail the worktree creation
		console.warn(
			`Warning: Failed to copy some untracked files: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/**
 * Updates the progress bar display on the current line.
 * @param completed - Number of files copied so far
 * @param total - Total number of files to copy
 */
function updateProgressBar(completed: number, total: number): void {
	const percentage = Math.round((completed / total) * 100);
	const barLength = 30;
	const completedLength = Math.round((percentage / 100) * barLength);
	const filled = "█".repeat(completedLength);
	const empty = "░".repeat(barLength - completedLength);
	readline.cursorTo(process.stdout, 0);
	process.stdout.write(
		`[${filled}${empty}] ${percentage}% Copying file ${completed}/${total}...`,
	);
}

/**
 * Clears the current progress line.
 */
function clearProgressLine(): void {
	readline.cursorTo(process.stdout, 0);
	process.stdout.write(" ".repeat(80));
	readline.cursorTo(process.stdout, 0);
}
