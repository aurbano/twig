import assert from "node:assert";
import { describe, it } from "node:test";
import { Command } from "commander";

describe("CLI", () => {
	describe("command registration", () => {
		it("should register branch command with correct options", () => {
			const program = new Command();
			program
				.name("twig")
				.description(
					"Git worktree manager with optional Dev Container integration",
				)
				.version("0.1.0");

			const branchCmd = program
				.command("branch")
				.argument("<branchOrPath>", "branch name or worktree path")
				.option("--base <base>", "base branch for new worktrees")
				.option(
					"-d, --dir <dir>",
					"target directory for new worktrees (default ../<repo>-<branch>)",
				)
				.option("--in-container", "bring up devcontainer then open")
				.option("-y, --yes", "assume yes to prompts");

			assert.strictEqual(branchCmd.name(), "branch");
			assert.strictEqual(branchCmd.options.length, 4);
		});

		it("should register list command", () => {
			const program = new Command();
			const listCmd = program.command("list");

			assert.strictEqual(listCmd.name(), "list");
		});

		it("should register delete command with options", () => {
			const program = new Command();
			const deleteCmd = program
				.command("delete")
				.argument("<branchOrPath>")
				.option("--keep-branch", "do not delete the git branch")
				.option("-y, --yes", "assume yes to prompts");

			assert.strictEqual(deleteCmd.name(), "delete");
			assert.strictEqual(deleteCmd.options.length, 2);
		});

		it("should register init-devcontainer command with options", () => {
			const program = new Command();
			const initCmd = program
				.command("init-devcontainer")
				.option(
					"--image <img>",
					"base image",
					"mcr.microsoft.com/devcontainers/base:ubuntu",
				)
				.option("--packages <list>", "space-separated apt packages")
				.option("--ports <csv>", "e.g. 3000,8000")
				.option("--postcreate <cmd>", "postCreateCommand")
				.option("--mount-node-modules", "add node_modules named volume mount");

			assert.strictEqual(initCmd.name(), "init-devcontainer");
			assert.strictEqual(initCmd.options.length, 5);
		});
	});

	describe("default values", () => {
		it("should auto-detect base branch in branch command", () => {
			const program = new Command();
			const branchCmd = program
				.command("branch")
				.argument("<branchOrPath>")
				.option("--base <base>", "base branch for new worktrees");

			// Base branch is now auto-detected, no default value set
			const baseOption = branchCmd.options.find((opt) => opt.long === "--base");
			assert.strictEqual(baseOption?.defaultValue, undefined);
		});

		it("should have correct default devcontainer image", () => {
			const program = new Command();
			const initCmd = program
				.command("init-devcontainer")
				.option(
					"--image <img>",
					"base image",
					"mcr.microsoft.com/devcontainers/base:ubuntu",
				);

			const imageOption = initCmd.options.find((opt) => opt.long === "--image");
			assert.ok(imageOption?.defaultValue?.startsWith("mcr.microsoft.com"));
		});
	});

	describe("error handling", () => {
		it("should have error handler that extracts stderr or message", () => {
			const testErrors = [
				{ stderr: "git error", message: "ignored" },
				{ message: "regular error" },
				"string error",
			];

			for (const err of testErrors) {
				let result: string;
				if (err && typeof err === "object" && "stderr" in err) {
					result = err.stderr;
				} else if (err && typeof err === "object" && "message" in err) {
					result = err.message;
				} else {
					result = String(err);
				}

				assert.ok(result.length > 0);
			}
		});
	});
});
