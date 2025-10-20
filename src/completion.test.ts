import assert from "node:assert";
import { describe, it } from "node:test";
import { Command } from "commander";
import {
	buildAliasMap,
	extractCommandNames,
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
});
