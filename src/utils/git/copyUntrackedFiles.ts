import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { execa } from "execa";
import type { CopyStrategyConfig } from "../config.js";
import { DEFAULT_SKIP_DIRECTORIES, loadCopyStrategyConfig } from "../config.js";
import { mkdir } from "../system/fs-operations.js";

/** Tracks warnings during copy operations for final summary */
const copyWarnings: string[] = [];

/**
 * Checks if a path matches any of the skip patterns.
 * Supports exact matches and simple glob patterns.
 * @param filePath - The file path to check (relative, using / separators)
 * @param skipPatterns - Array of patterns to match against
 * @returns True if the path should be skipped
 */
function shouldSkip(filePath: string, skipPatterns: string[]): boolean {
	// Get the top-level directory or file name
	const topLevel = filePath.split("/")[0];
	if (!topLevel) return false;

	for (const pattern of skipPatterns) {
		// Exact match on top-level directory/file
		if (topLevel === pattern) {
			return true;
		}
		// Simple glob: pattern ending with /* matches directory contents
		if (pattern.endsWith("/*") && topLevel === pattern.slice(0, -2)) {
			return true;
		}
	}
	return false;
}

/**
 * Copies untracked files from source directory to destination directory.
 * Skips git-tracked files since they're already checked out in the worktree.
 * Respects copyStrategy config to skip large directories like node_modules.
 * Uses optimized bulk copying for large directories.
 * @param sourceDir - Source directory (base branch's worktree)
 * @param destDir - Destination directory (new worktree)
 * @param config - Optional copy strategy configuration (loaded from .twig if not provided)
 */
export async function copyUntrackedFiles(
	sourceDir: string,
	destDir: string,
	config?: CopyStrategyConfig,
): Promise<void> {
	// Reset warnings for this copy operation
	copyWarnings.length = 0;

	// Load config if not provided
	const copyConfig = config ?? (await loadCopyStrategyConfig(sourceDir));
	const skipPatterns = copyConfig.skip ?? DEFAULT_SKIP_DIRECTORIES;

	try {
		// Get list of untracked files using git ls-files --others
		// This includes ALL untracked files, including those ignored by .gitignore
		const { stdout: untrackedOutput } = await execa(
			"git",
			["ls-files", "--others"],
			{ cwd: sourceDir },
		);

		const allUntrackedFiles = untrackedOutput
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f.length > 0);

		if (allUntrackedFiles.length === 0) {
			return; // No untracked files to copy
		}

		// Filter out files matching skip patterns
		const skippedDirs = new Set<string>();
		const untrackedFiles = allUntrackedFiles.filter((file) => {
			if (shouldSkip(file, skipPatterns)) {
				// Track which directories were skipped for summary
				const topLevel = file.split("/")[0];
				if (topLevel) skippedDirs.add(topLevel);
				return false;
			}
			return true;
		});

		// Report skipped directories
		if (skippedDirs.size > 0) {
			const skippedList = Array.from(skippedDirs).slice(0, 5).join(", ");
			const moreCount =
				skippedDirs.size > 5 ? ` and ${skippedDirs.size - 5} more` : "";
			console.log(`Skipping: ${skippedList}${moreCount} (configure in .twig)`);
		}

		if (untrackedFiles.length === 0) {
			console.log("No untracked files to copy after applying skip patterns.");
			return;
		}

		// Group files by top-level directory for bulk copying
		const { directoriesToCopy, individualFiles } = groupFilesByDirectory(
			untrackedFiles,
			skipPatterns,
		);

		const totalOperations = directoriesToCopy.length + individualFiles.length;
		let completed = 0;

		// Show initial progress (0%)
		updateProgressBar(0, totalOperations, directoriesToCopy.length, 0);

		// Copy entire directories in parallel for better performance
		// Track progress incrementally as each directory completes
		if (directoriesToCopy.length > 0) {
			let directoriesCompleted = 0;

			const directoryPromises = directoriesToCopy.map(async (dir) => {
				const srcPath = path.join(sourceDir, dir);
				const destPath = path.join(destDir, dir);

				try {
					const stats = await fs.stat(srcPath);
					if (!stats.isDirectory()) {
						copyWarnings.push(`Skipped ${dir}: not a directory`);
						return;
					}

					// Copy entire directory recursively, preserving symlinks
					await fs.cp(srcPath, destPath, {
						recursive: true,
						force: false,
						dereference: false, // Preserve symlinks, don't dereference
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					copyWarnings.push(`Failed to copy directory ${dir}: ${message}`);
				} finally {
					// Update progress as each directory completes (success or failure)
					directoriesCompleted++;
					completed++;
					const remainingDirs = directoriesToCopy.length - directoriesCompleted;
					updateProgressBar(
						completed,
						totalOperations,
						remainingDirs,
						individualFiles.length,
					);
				}
			});

			// Wait for all directory copies to complete
			await Promise.all(directoryPromises);
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

					// Check if the source is a symlink and preserve it
					let isSymlink = false;
					try {
						const linkStats = await fs.lstat(srcPath);
						isSymlink = linkStats.isSymbolicLink();
					} catch (statErr) {
						// If we can't stat it, log warning and skip
						const message =
							statErr instanceof Error ? statErr.message : String(statErr);
						copyWarnings.push(`Cannot stat ${file}: ${message}`);
						continue;
					}

					if (isSymlink) {
						// Read the symlink target and preserve it as-is
						// Since we're copying to the same relative structure,
						// relative symlinks will still work correctly
						const linkTarget = await fs.readlink(srcPath);
						try {
							await fs.symlink(linkTarget, destPath);
						} catch (symlinkErr) {
							// If symlink already exists, that's okay - it might have been
							// created by a directory copy operation
							if ((symlinkErr as NodeJS.ErrnoException).code !== "EEXIST") {
								throw symlinkErr;
							}
						}
					} else {
						// Copy the file (for regular files, copyFile is fine)
						await fs.copyFile(srcPath, destPath);
					}

					completed++;
					individualFilesCopied++;

					// Update progress bar for individual files
					updateProgressBar(
						completed,
						totalOperations,
						0,
						individualFiles.length - individualFilesCopied,
					);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					copyWarnings.push(`Failed to copy ${file}: ${message}`);
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

		// Show warnings summary if any occurred
		if (copyWarnings.length > 0) {
			console.warn(
				`Warning: ${copyWarnings.length} file(s) could not be copied:`,
			);
			// Show first few warnings to avoid flooding the console
			const maxWarnings = 5;
			for (const warning of copyWarnings.slice(0, maxWarnings)) {
				console.warn(`  - ${warning}`);
			}
			if (copyWarnings.length > maxWarnings) {
				console.warn(`  ... and ${copyWarnings.length - maxWarnings} more`);
			}
		}
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
 * @param files - List of untracked file paths (already filtered by skip patterns)
 * @param _skipPatterns - Skip patterns (unused, kept for API compatibility)
 * @returns Object containing directories to copy and individual files to copy
 */
export function groupFilesByDirectory(
	files: string[],
	_skipPatterns: string[] = [],
): {
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
		// Note: Git always outputs paths with '/' regardless of platform
		const parts = file.split("/");
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
