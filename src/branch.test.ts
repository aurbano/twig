import assert from "node:assert";
import { describe, it } from "node:test";
import { execa } from "execa";
import { branch } from "./branch.js";
import { branchExists } from "./utils/git/branchExists.js";
import { parseWorktrees } from "./utils/git/parseWorktrees.js";
import { resolveWorktreePath } from "./utils/git/resolveWorktreePath.js";
import {
	execGit,
	execGitBranchDelete,
	execGitWorktreeRemove,
} from "./utils/system/git-commands.js";

describe("branch command", () => {
	it("should create worktree for existing branch without worktree", async () => {
		// Create a unique test branch name
		const testBranch = `test-existing-branch-${Date.now()}-${Math.random()
			.toString(36)
			.substring(7)}`;

		let worktreePath: string | null = null;

		try {
			// Get the default branch to create our test branch from
			const defaultBranch = await execGit([
				"rev-parse",
				"--abbrev-ref",
				"HEAD",
			]);

			// Create the branch (if it doesn't exist)
			await execa("git", ["checkout", "-b", testBranch, defaultBranch], {
				stdio: "ignore",
			}).catch(() => {
				// Branch might already exist, try to checkout it instead
				return execa("git", ["checkout", testBranch], {
					stdio: "ignore",
				});
			});

			// Switch back to default branch
			await execa("git", ["checkout", defaultBranch], { stdio: "ignore" });

			// Verify branch exists
			assert.strictEqual(
				await branchExists(testBranch),
				true,
				"Test branch should exist",
			);

			// Verify no worktree exists for this branch
			const existingWorktree = await resolveWorktreePath(testBranch);
			assert.strictEqual(
				existingWorktree,
				null,
				"No worktree should exist for test branch before calling branch()",
			);

			// Call branch() function - this should create a worktree for the existing branch
			worktreePath = await branch(testBranch, { yes: true });

			// Verify worktree was created
			assert.ok(worktreePath, "Worktree path should be returned");
			assert.ok(
				worktreePath.includes(testBranch),
				"Worktree path should include branch name",
			);

			// Verify worktree can be resolved
			const resolved = await resolveWorktreePath(testBranch);
			assert.strictEqual(
				resolved,
				worktreePath,
				"Resolved worktree path should match returned path",
			);

			// Verify the worktree points to the correct branch
			const worktrees = await parseWorktrees();
			const worktree = worktrees.find((wt) => wt.path === worktreePath);
			assert.ok(worktree, "Worktree should be found in worktree list");
			assert.strictEqual(
				worktree?.branch,
				testBranch,
				"Worktree should point to test branch",
			);
		} finally {
			// Clean up: remove worktree if created
			if (worktreePath) {
				try {
					await execGitWorktreeRemove(worktreePath, true);
				} catch {
					// Ignore cleanup errors
				}
			}

			// Clean up: delete test branch
			try {
				const branchStillExists = await branchExists(testBranch);
				if (branchStillExists) {
					// Make sure we're not on the branch before deleting
					await execa("git", ["checkout", "-"], { stdio: "ignore" }).catch(
						() => {},
					);
					await execGitBranchDelete(testBranch, true);
				}
			} catch {
				// Ignore cleanup errors
			}
		}
	});
});
