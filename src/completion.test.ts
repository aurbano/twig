import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Command } from "commander";
import {
	buildAliasMap,
	extractCommandNames,
	isCompletionInstalled,
	parseBranchesFromWorktreeOutput,
} from "./completion.js";

describe("completion module", () => {
	describe("extractCommandNames", () => {
		it("should extract command names from Commander program", () => {
			const program = new Command();
			program.command("branch").alias("b");
			program.command("list").alias("ls");
			program.command("delete").alias("d");

			const commands = extractCommandNames(program);

			assert.strictEqual(commands.length, 3);
			assert.ok(commands.includes("branch"));
			assert.ok(commands.includes("list"));
			assert.ok(commands.includes("delete"));
		});

		it("should handle program with no commands", () => {
			const program = new Command();
			const commands = extractCommandNames(program);

			assert.strictEqual(commands.length, 0);
		});
	});

	describe("buildAliasMap", () => {
		it("should build alias map correctly", () => {
			const program = new Command();
			program.command("branch").alias("b");
			program.command("list").alias("ls");
			program.command("delete").alias("d");

			const commandMap = buildAliasMap(program);

			assert.strictEqual(commandMap.b, "branch");
			assert.strictEqual(commandMap.ls, "list");
			assert.strictEqual(commandMap.d, "delete");
		});

		it("should handle commands with multiple aliases", () => {
			const program = new Command();
			program.command("branch").alias("b").alias("br");

			const commandMap = buildAliasMap(program);

			assert.strictEqual(commandMap.b, "branch");
			assert.strictEqual(commandMap.br, "branch");
		});

		it("should return empty map for program with no aliases", () => {
			const program = new Command();
			program.command("branch");
			program.command("list");

			const commandMap = buildAliasMap(program);

			assert.deepStrictEqual(commandMap, {});
		});
	});

	describe("parseBranchesFromWorktreeOutput", () => {
		it("should parse branch names from worktree output", () => {
			const stdout = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature-branch`;

			const branches = parseBranchesFromWorktreeOutput(stdout);

			assert.strictEqual(branches.length, 2);
			assert.strictEqual(branches[0], "main");
			assert.strictEqual(branches[1], "feature-branch");
		});

		it("should handle empty worktree output", () => {
			const stdout = "";
			const branches = parseBranchesFromWorktreeOutput(stdout);

			assert.strictEqual(branches.length, 0);
		});

		it("should handle worktree output with no branches (detached HEAD)", () => {
			const stdout = `worktree /path/to/detached
HEAD abc123`;

			const branches = parseBranchesFromWorktreeOutput(stdout);

			assert.strictEqual(branches.length, 0);
		});

		it("should strip refs/heads/ prefix from branch names", () => {
			const stdout = `worktree /path/to/repo
HEAD abc123
branch refs/heads/feature/test-branch`;

			const branches = parseBranchesFromWorktreeOutput(stdout);

			assert.strictEqual(branches.length, 1);
			assert.strictEqual(branches[0], "feature/test-branch");
		});
	});

	describe("delete command completion", () => {
		it("should return branches from worktree list that match what twig ls shows", async () => {
			// Import the actual git functions to get real data
			const { parseWorktrees } = await import("./git.js");
			const { execGitCommand } = await import("./commands/git-commands.js");

			// Get branches the same way `twig ls` does
			const worktrees = await parseWorktrees();
			const expectedBranches = worktrees
				.filter((wt) => wt.branch !== undefined)
				.map((wt) => wt.branch as string);

			// Get branches the same way completion does for delete command
			const stdout = await execGitCommand("git worktree list --porcelain");
			const completionBranches = parseBranchesFromWorktreeOutput(stdout);

			// These should match!
			assert.strictEqual(
				completionBranches.length,
				expectedBranches.length,
				`Completion returned ${completionBranches.length} branches but twig ls shows ${expectedBranches.length}`,
			);

			for (const branch of expectedBranches) {
				assert.ok(
					completionBranches.includes(branch),
					`Branch "${branch}" from twig ls not found in completion suggestions`,
				);
			}
		});

		it("should extract command name from completion line correctly", () => {
			// Test command extraction from various completion scenarios
			const testCases = [
				{ line: "twig delete ", expected: "delete" },
				{ line: "twig d ", expected: "d" },
				{ line: "twig delete feature-branch", expected: "delete" },
				{ line: "twig branch ", expected: "branch" },
				{ line: "twig b ", expected: "b" },
			];

			for (const { line, expected } of testCases) {
				const words = line.trim().split(/\s+/);
				const command = words[1] || "";
				assert.strictEqual(
					command,
					expected,
					`Failed to extract command from line: "${line}"`,
				);
			}
		});

		it("should map aliases to actual commands", () => {
			const program = new Command();
			program.command("branch").alias("b");
			program.command("delete").alias("d");
			program.command("list").alias("ls");

			const commandMap = buildAliasMap(program);

			// Test alias mapping
			assert.strictEqual(commandMap.d, "delete");
			assert.strictEqual(commandMap.b, "branch");
			assert.strictEqual(commandMap.ls, "list");
		});
	});

	describe("isCompletionInstalled", () => {
		it("should return false when SHELL environment variable is not set", () => {
			const originalShell = process.env.SHELL;
			delete process.env.SHELL;

			const result = isCompletionInstalled();

			// Restore original SHELL
			if (originalShell) {
				process.env.SHELL = originalShell;
			}

			assert.strictEqual(result, false);
		});

		it("should return false for unsupported shell", () => {
			const originalShell = process.env.SHELL;
			process.env.SHELL = "/bin/unknown-shell";

			const result = isCompletionInstalled();

			// Restore original SHELL
			if (originalShell) {
				process.env.SHELL = originalShell;
			}

			assert.strictEqual(result, false);
		});

		it("should return false when init file doesn't exist", () => {
			const originalHome = process.env.HOME;
			// Set HOME to a non-existent directory
			const tempDir = mkdtempSync(join(tmpdir(), "twig-test-"));
			process.env.HOME = join(tempDir, "nonexistent");

			const result = isCompletionInstalled();

			// Restore original HOME
			if (originalHome) {
				process.env.HOME = originalHome;
			}

			assert.strictEqual(result, false);
		});

		it("should return false when completion marker is not in init file", () => {
			const originalHome = process.env.HOME;
			const originalShell = process.env.SHELL;

			// Create a temporary directory and init file
			const tempDir = mkdtempSync(join(tmpdir(), "twig-test-"));
			process.env.HOME = tempDir;
			process.env.SHELL = "/bin/zsh";

			const initFile = join(tempDir, ".zshrc");
			writeFileSync(initFile, "# Some other content\nalias ll='ls -la'\n");

			const result = isCompletionInstalled();

			// Restore original values
			if (originalHome) {
				process.env.HOME = originalHome;
			}
			if (originalShell) {
				process.env.SHELL = originalShell;
			}

			assert.strictEqual(result, false);
		});

		it("should return true when completion marker is found in init file", () => {
			const originalHome = process.env.HOME;
			const originalShell = process.env.SHELL;

			// Create a temporary directory and init file
			const tempDir = mkdtempSync(join(tmpdir(), "twig-test-"));
			process.env.HOME = tempDir;
			process.env.SHELL = "/bin/zsh";

			const initFile = join(tempDir, ".zshrc");
			writeFileSync(
				initFile,
				"# Some content\n# begin twig completion\n. <(twig --completion)\n# end twig completion\n",
			);

			const result = isCompletionInstalled();

			// Restore original values
			if (originalHome) {
				process.env.HOME = originalHome;
			}
			if (originalShell) {
				process.env.SHELL = originalShell;
			}

			assert.strictEqual(result, true);
		});

		it("should detect completion for custom program name", () => {
			const originalHome = process.env.HOME;
			const originalShell = process.env.SHELL;

			// Create a temporary directory and init file
			const tempDir = mkdtempSync(join(tmpdir(), "twig-test-"));
			process.env.HOME = tempDir;
			process.env.SHELL = "/bin/bash";

			// Use the correct init file based on platform (macOS uses .bash_profile)
			const initFileName =
				process.platform === "darwin" ? ".bash_profile" : ".bashrc";
			const initFile = join(tempDir, initFileName);
			writeFileSync(
				initFile,
				"# begin mycli completion\nsource ~/.mycli/completion.sh\n# end mycli completion\n",
			);

			const result = isCompletionInstalled("mycli");

			// Restore original values
			if (originalHome) {
				process.env.HOME = originalHome;
			}
			if (originalShell) {
				process.env.SHELL = originalShell;
			}

			assert.strictEqual(result, true);
		});
	});
});
