import assert from "node:assert";
import fs, { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { execa } from "execa";
import {
	copyUntrackedFiles,
	groupFilesByDirectory,
} from "./copyUntrackedFiles.js";

describe("groupFilesByDirectory", () => {
	it("should group files by top-level directory", () => {
		const files = [
			"src/index.ts",
			"src/utils.ts",
			"src/components/Button.tsx",
			"package.json",
			"README.md",
		];

		const result = groupFilesByDirectory(files);

		// src has 3 files, below threshold of 10, so files are individual
		assert.deepStrictEqual(result.directoriesToCopy, []);
		assert.deepStrictEqual(result.individualFiles, [
			"package.json",
			"README.md",
			"src/index.ts",
			"src/utils.ts",
			"src/components/Button.tsx",
		]);
	});

	it("should bulk copy directories with 10+ files", () => {
		const files = [
			// 10 files in node_modules - should trigger bulk copy
			"node_modules/a/index.js",
			"node_modules/b/index.js",
			"node_modules/c/index.js",
			"node_modules/d/index.js",
			"node_modules/e/index.js",
			"node_modules/f/index.js",
			"node_modules/g/index.js",
			"node_modules/h/index.js",
			"node_modules/i/index.js",
			"node_modules/j/index.js",
			// Individual files
			"package.json",
		];

		const result = groupFilesByDirectory(files);

		assert.deepStrictEqual(result.directoriesToCopy, ["node_modules"]);
		assert.deepStrictEqual(result.individualFiles, ["package.json"]);
	});

	it("should handle root-level files correctly", () => {
		const files = [".env", "config.json", "README.md"];

		const result = groupFilesByDirectory(files);

		assert.deepStrictEqual(result.directoriesToCopy, []);
		assert.deepStrictEqual(result.individualFiles, [
			".env",
			"config.json",
			"README.md",
		]);
	});

	it("should handle empty file list", () => {
		const result = groupFilesByDirectory([]);

		assert.deepStrictEqual(result.directoriesToCopy, []);
		assert.deepStrictEqual(result.individualFiles, []);
	});

	it("should use forward slashes regardless of platform", () => {
		// Git always outputs paths with forward slashes
		const files = ["src/components/Button.tsx", "src/utils/helpers.ts"];

		const result = groupFilesByDirectory(files);

		// Should correctly parse paths with forward slashes
		assert.deepStrictEqual(result.directoriesToCopy, []);
		assert.deepStrictEqual(result.individualFiles, [
			"src/components/Button.tsx",
			"src/utils/helpers.ts",
		]);
	});

	it("should handle multiple directories at threshold", () => {
		const files: string[] = [];

		// Add 10 files to dir1 (should bulk copy)
		for (let i = 0; i < 10; i++) {
			files.push(`dir1/file${i}.txt`);
		}

		// Add 9 files to dir2 (should copy individually)
		for (let i = 0; i < 9; i++) {
			files.push(`dir2/file${i}.txt`);
		}

		const result = groupFilesByDirectory(files);

		assert.deepStrictEqual(result.directoriesToCopy, ["dir1"]);
		assert.strictEqual(result.individualFiles.length, 9);
		assert.ok(result.individualFiles.every((f) => f.startsWith("dir2/")));
	});
});

describe("copyUntrackedFiles", () => {
	it("should skip directories in skip list", async () => {
		// Create a temporary directory structure
		const tempDir = await mkdtemp(join(tmpdir(), "twig-test-"));
		const sourceDir = join(tempDir, "source");
		const destDir = join(tempDir, "dest");

		try {
			// Initialize git repo in source
			await fs.mkdir(sourceDir, { recursive: true });
			await execa("git", ["init"], { cwd: sourceDir });
			await execa("git", ["config", "user.name", "Test"], { cwd: sourceDir });
			await execa("git", ["config", "user.email", "test@test.com"], {
				cwd: sourceDir,
			});

			// Create initial commit
			await fs.writeFile(join(sourceDir, "tracked.txt"), "tracked");
			await execa("git", ["add", "tracked.txt"], { cwd: sourceDir });
			await execa("git", ["commit", "-m", "Initial"], { cwd: sourceDir });

			// Create untracked files
			await fs.mkdir(join(sourceDir, "node_modules", "pkg"), {
				recursive: true,
			});
			await fs.writeFile(
				join(sourceDir, "node_modules", "pkg", "index.js"),
				"module",
			);
			await fs.writeFile(join(sourceDir, "untracked.txt"), "untracked");

			// Create destination directory
			await fs.mkdir(destDir, { recursive: true });

			// Copy with skip config
			await copyUntrackedFiles(sourceDir, destDir, {
				skip: ["node_modules"],
			});

			// Verify node_modules was skipped
			const nodeModulesExists = await fs
				.stat(join(destDir, "node_modules"))
				.then(() => true)
				.catch(() => false);
			assert.strictEqual(
				nodeModulesExists,
				false,
				"node_modules should be skipped",
			);

			// Verify untracked.txt was copied
			const untrackedExists = await fs
				.stat(join(destDir, "untracked.txt"))
				.then(() => true)
				.catch(() => false);
			assert.strictEqual(
				untrackedExists,
				true,
				"untracked.txt should be copied",
			);
		} finally {
			// Cleanup
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("should handle empty untracked files list", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "twig-test-"));
		const sourceDir = join(tempDir, "source");
		const destDir = join(tempDir, "dest");

		try {
			// Initialize git repo with only tracked files
			await fs.mkdir(sourceDir, { recursive: true });
			await execa("git", ["init"], { cwd: sourceDir });
			await execa("git", ["config", "user.name", "Test"], { cwd: sourceDir });
			await execa("git", ["config", "user.email", "test@test.com"], {
				cwd: sourceDir,
			});

			await fs.writeFile(join(sourceDir, "tracked.txt"), "tracked");
			await execa("git", ["add", "tracked.txt"], { cwd: sourceDir });
			await execa("git", ["commit", "-m", "Initial"], { cwd: sourceDir });

			await fs.mkdir(destDir, { recursive: true });

			// Should not throw when there are no untracked files
			await copyUntrackedFiles(sourceDir, destDir, { skip: [] });
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("should preserve symlinks", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "twig-test-"));
		const sourceDir = join(tempDir, "source");
		const destDir = join(tempDir, "dest");

		try {
			// Initialize git repo
			await fs.mkdir(sourceDir, { recursive: true });
			await execa("git", ["init"], { cwd: sourceDir });
			await execa("git", ["config", "user.name", "Test"], { cwd: sourceDir });
			await execa("git", ["config", "user.email", "test@test.com"], {
				cwd: sourceDir,
			});

			// Create initial commit
			await fs.writeFile(join(sourceDir, "tracked.txt"), "tracked");
			await execa("git", ["add", "tracked.txt"], { cwd: sourceDir });
			await execa("git", ["commit", "-m", "Initial"], { cwd: sourceDir });

			// Create a file and a symlink to it
			await fs.writeFile(join(sourceDir, "original.txt"), "original content");
			await fs.symlink("original.txt", join(sourceDir, "link.txt"));

			await fs.mkdir(destDir, { recursive: true });

			// Copy files
			await copyUntrackedFiles(sourceDir, destDir, { skip: [] });

			// Verify symlink was preserved
			const linkStats = await fs.lstat(join(destDir, "link.txt"));
			assert.strictEqual(
				linkStats.isSymbolicLink(),
				true,
				"Symlink should be preserved",
			);

			// Verify symlink target is correct
			const linkTarget = await fs.readlink(join(destDir, "link.txt"));
			assert.strictEqual(
				linkTarget,
				"original.txt",
				"Symlink target should match",
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
