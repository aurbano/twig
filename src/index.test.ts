import assert from "node:assert";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Get the path to the compiled CLI entry point
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "index.js");

/**
 * Helper to run the CLI and return stdout/stderr
 */
function runCLI(args: string[]): {
	stdout: string;
	stderr: string;
	status: number | null;
} {
	const result = spawnSync(process.execPath, [cliPath, ...args], {
		encoding: "utf-8",
		timeout: 5000,
	});

	return {
		stdout: result.stdout || "",
		stderr: result.stderr || "",
		status: result.status,
	};
}

describe("twig CLI", () => {
	describe("help output", () => {
		it("should display help with -h flag", () => {
			const { stdout, status } = runCLI(["-h"]);

			assert.strictEqual(status, 0);
			assert.ok(stdout.includes("twig"), "should contain program name");
			assert.ok(
				stdout.includes("Git worktree") || stdout.includes("worktree"),
				"should contain description",
			);
			assert.ok(stdout.includes("Commands:"), "should list commands");
		});

		it("should display help with --help flag", () => {
			const { stdout, status } = runCLI(["--help"]);

			assert.strictEqual(status, 0);
			assert.ok(stdout.includes("twig"));
			assert.ok(stdout.includes("Commands:"));
		});
	});

	describe("version output", () => {
		it("should display version with -V flag", () => {
			const { stdout, status } = runCLI(["-V"]);

			assert.strictEqual(status, 0);
			assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
		});

		it("should display version with --version flag", () => {
			const { stdout, status } = runCLI(["--version"]);

			assert.strictEqual(status, 0);
			assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
		});
	});

	describe("commands registration", () => {
		it("should register branch command and alias", () => {
			const { stdout } = runCLI(["branch", "-h"]);

			assert.ok(stdout.includes("branch"));
			assert.ok(stdout.includes("branchOrPath"));
		});

		it("should register list command and alias", () => {
			const { stdout } = runCLI(["list", "-h"]);

			assert.ok(stdout.includes("list"));
		});

		it("should work with ls alias", () => {
			const { stdout } = runCLI(["ls", "-h"]);

			assert.ok(stdout.includes("list"));
		});

		it("should register delete command and alias", () => {
			const { stdout } = runCLI(["delete", "-h"]);

			assert.ok(stdout.includes("delete"));
			assert.ok(stdout.includes("branchOrPath"));
		});

		it("should work with d alias", () => {
			const { stdout } = runCLI(["d", "-h"]);

			assert.ok(stdout.includes("delete"));
		});

		it("should register prune command and alias", () => {
			const { stdout } = runCLI(["prune", "-h"]);

			assert.ok(stdout.includes("prune"));
			assert.ok(
				stdout.includes("remove worktrees for branches that no longer exist"),
			);
		});

		it("should work with p alias", () => {
			const { stdout } = runCLI(["p", "-h"]);

			assert.ok(stdout.includes("prune"));
		});

		it("should register init-devcontainer command", () => {
			const { stdout } = runCLI(["init-devcontainer", "-h"]);

			assert.ok(stdout.includes("init-devcontainer"));
			assert.ok(stdout.includes("--image"));
		});

		it("should work with i alias", () => {
			const { stdout } = runCLI(["i", "-h"]);

			assert.ok(stdout.includes("init-devcontainer"));
		});

		it("should register completion command", () => {
			const { stdout } = runCLI(["completion", "-h"]);

			assert.ok(stdout.includes("completion"));
			assert.ok(stdout.includes("--setup"));
			assert.ok(stdout.includes("--cleanup"));
		});
	});

	describe("command options", () => {
		it("branch command should have expected options", () => {
			const { stdout } = runCLI(["branch", "-h"]);

			assert.ok(stdout.includes("--base"), "should have --base option");
			assert.ok(stdout.includes("--dir"), "should have --dir option");
			assert.ok(
				stdout.includes("--in-container"),
				"should have --in-container option",
			);
			assert.ok(stdout.includes("--yes"), "should have --yes option");
		});

		it("delete command should have expected options", () => {
			const { stdout } = runCLI(["delete", "-h"]);

			assert.ok(
				stdout.includes("--keep-branch"),
				"should have --keep-branch option",
			);
			assert.ok(stdout.includes("--yes"), "should have --yes option");
		});

		it("init-devcontainer command should have expected options", () => {
			const { stdout } = runCLI(["init-devcontainer", "-h"]);

			assert.ok(stdout.includes("--image"), "should have --image option");
			assert.ok(stdout.includes("--packages"), "should have --packages option");
			assert.ok(stdout.includes("--ports"), "should have --ports option");
			assert.ok(
				stdout.includes("--postcreate"),
				"should have --postcreate option",
			);
			assert.ok(
				stdout.includes("--mount-node-modules"),
				"should have --mount-node-modules option",
			);
		});
	});

	describe("error handling", () => {
		it("should display error for unknown command", () => {
			const { stderr, status } = runCLI(["unknown-command"]);

			assert.notStrictEqual(status, 0, "should exit with non-zero status");
			assert.ok(
				stderr.includes("unknown command") || stderr.includes("Unknown"),
				"should show error message",
			);
		});

		it("should handle missing required arguments gracefully", () => {
			const { status } = runCLI(["delete"]);

			assert.notStrictEqual(status, 0, "should exit with non-zero status");
		});
	});
});
