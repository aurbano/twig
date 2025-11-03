import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { execa } from "execa";
import { mkdir } from "../system/fs-operations.js";

/**
 * Copies untracked files from source directory to destination directory.
 * Skips git-tracked files since they're already checked out in the worktree.
 * Includes git-ignored files like node_modules.
 * Uses optimized bulk copying for large directories.
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

		// Group files by top-level directory for bulk copying
		const { directoriesToCopy, individualFiles } =
			groupFilesByDirectory(untrackedFiles);

		const totalOperations = directoriesToCopy.length + individualFiles.length;
		let completed = 0;

		// Show initial progress (0%)
		updateProgressBar(0, totalOperations, directoriesToCopy.length, 0);

		// Copy entire directories in parallel for better performance
		if (directoriesToCopy.length > 0) {
			const directoryPromises = directoriesToCopy.map(async (dir) => {
				try {
					const srcPath = path.join(sourceDir, dir);
					const destPath = path.join(destDir, dir);

					// Check if source exists and is a directory
					try {
						const stats = await fs.stat(srcPath);
						if (stats.isDirectory()) {
							// Copy entire directory recursively
							await fs.cp(srcPath, destPath, {
								recursive: true,
								force: false,
							});
						}
					} catch {
						// Source doesn't exist or isn't a directory, skip
					}
				} catch {
					// Silently handle errors for individual directories
				}
			});

			// Wait for all directory copies to complete
			await Promise.all(directoryPromises);
			completed += directoriesToCopy.length;

			// Update progress after directories
			updateProgressBar(completed, totalOperations, 0, individualFiles.length);
		}

		// Copy remaining individual files
		if (individualFiles.length > 0) {
			let individualFilesCopied = 0;
			for (const file of individualFiles) {
				const srcPath = path.join(sourceDir, file);
				const destPath = path.join(destDir, file);

				try {
					// Ensure parent directory exists
					await mkdir(path.dirname(destPath));
					// Copy the file
					await fs.copyFile(srcPath, destPath);
					completed++;
					individualFilesCopied++;

					// Update progress bar for individual files
					updateProgressBar(
						completed,
						totalOperations,
						0,
						individualFiles.length - individualFilesCopied,
					);
				} catch {
					// Silently handle errors for individual files
				}
			}
		}

		// Show final progress (100%) before clearing
		updateProgressBar(totalOperations, totalOperations, 0, 0);
		// Clear progress line and show final message
		clearProgressLine();
		const totalFiles = untrackedFiles.length;
		const dirCount = directoriesToCopy.length;
		const dirPlural = dirCount > 1 ? "directories" : "directory";
		const copyPlural = dirCount > 1 ? "copies" : "copy";
		console.log(
			`Copied ${totalFiles} untracked file(s) from base branch${dirCount > 0 ? ` (${dirCount} ${dirPlural} bulk ${copyPlural})` : ""}`,
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
 * Groups untracked files by their top-level directory for bulk copying.
 * Files under the same top-level directory (e.g., node_modules/**) are grouped together.
 * @param files - List of untracked file paths
 * @returns Object containing directories to copy and individual files to copy
 */
function groupFilesByDirectory(files: string[]): {
	directoriesToCopy: string[];
	individualFiles: string[];
} {
	// Threshold: if a directory has this many files, copy it wholesale
	const DIRECTORY_COPY_THRESHOLD = 10;

	// Map: top-level directory -> list of files in that directory
	const directoryMap = new Map<string, string[]>();

	// Files that don't belong to any top-level directory (root-level files)
	const rootLevelFiles: string[] = [];

	for (const file of files) {
		// Get the first directory component
		const parts = file.split(path.sep);
		if (parts.length > 1) {
			const topLevelDir = parts[0];
			if (topLevelDir !== undefined) {
				const filesInDir = directoryMap.get(topLevelDir) ?? [];
				filesInDir.push(file);
				directoryMap.set(topLevelDir, filesInDir);
			}
		} else {
			// Root-level file (no directory prefix)
			rootLevelFiles.push(file);
		}
	}

	// Determine which directories to copy wholesale vs individual files
	const directoriesToCopy: string[] = [];
	const individualFiles: string[] = [];

	// Add root-level files to individual files
	individualFiles.push(...rootLevelFiles);

	// For each directory, decide whether to copy wholesale or individually
	for (const [dir, dirFiles] of directoryMap.entries()) {
		if (dirFiles.length >= DIRECTORY_COPY_THRESHOLD) {
			// Copy entire directory
			directoriesToCopy.push(dir);
		} else {
			// Copy files individually
			individualFiles.push(...dirFiles);
		}
	}

	return { directoriesToCopy, individualFiles };
}

/**
 * Updates the progress bar display on the current line.
 * @param completed - Number of operations completed
 * @param total - Total number of operations (directories + individual files)
 * @param directoriesRemaining - Number of directories still being copied
 * @param filesRemaining - Number of individual files still to copy
 */
function updateProgressBar(
	completed: number,
	total: number,
	directoriesRemaining: number,
	filesRemaining: number,
): void {
	const percentage = Math.round((completed / total) * 100);
	const barLength = 30;
	const completedLength = Math.round((percentage / 100) * barLength);
	const filled = "█".repeat(completedLength);
	const empty = "░".repeat(barLength - completedLength);
	readline.cursorTo(process.stdout, 0);

	let status = "";
	if (directoriesRemaining > 0) {
		status = `Copying ${directoriesRemaining} director${directoriesRemaining > 1 ? "ies" : "y"}...`;
	} else if (filesRemaining > 0) {
		status = `Copying ${filesRemaining} file${filesRemaining > 1 ? "s" : ""}...`;
	} else {
		status = `${completed}/${total} operations`;
	}

	process.stdout.write(`[${filled}${empty}] ${percentage}% ${status}`);
}

/**
 * Clears the current progress line.
 */
function clearProgressLine(): void {
	readline.cursorTo(process.stdout, 0);
	process.stdout.write(" ".repeat(80));
	readline.cursorTo(process.stdout, 0);
}
