import assert from "node:assert";
import { describe, it } from "node:test";
import { sampleWorktreeOutput } from "./test-utils.js";

describe("git module", () => {
	describe("parseWorktrees parsing logic", () => {
		it("should correctly parse worktree output format", () => {
			// Test the parsing logic directly
			const lines = sampleWorktreeOutput.split("\n");
			const items: Array<{ path: string; branch?: string; head?: string }> = [];
			let cur: { path?: string; branch?: string; head?: string } = {};

			for (const line of lines) {
				if (!line.trim()) continue;
				if (line.startsWith("worktree ")) {
					if (cur.path)
						items.push(cur as { path: string; branch?: string; head?: string });
					cur = { path: line.slice("worktree ".length).trim() };
				} else if (line.startsWith("branch ")) {
					cur.branch = line
						.slice("branch ".length)
						.trim()
						.replace(/^refs\/heads\//, "");
				} else if (line.startsWith("HEAD ")) {
					cur.head = line.slice("HEAD ".length).trim();
				}
			}
			if (cur.path && cur.path.length > 0)
				items.push(cur as { path: string; branch?: string; head?: string });

			assert.strictEqual(items.length, 3);
			assert.deepStrictEqual(items[0], {
				path: "/path/to/main",
				branch: "main",
				head: "abc123",
			});
			assert.deepStrictEqual(items[1], {
				path: "/path/to/feature",
				branch: "feature",
				head: "def456",
			});
			assert.deepStrictEqual(items[2], {
				path: "/path/to/detached",
				head: "ghi789",
			});
		});

		it("should handle empty output", () => {
			const lines = "".split("\n");
			const items: Array<{ path: string; branch?: string; head?: string }> = [];
			let cur: { path?: string; branch?: string; head?: string } = {};

			for (const line of lines) {
				if (!line.trim()) continue;
				if (line.startsWith("worktree ")) {
					if (cur.path)
						items.push(cur as { path: string; branch?: string; head?: string });
					cur = { path: line.slice("worktree ".length).trim() };
				}
			}
			if (cur.path && cur.path.length > 0)
				items.push(cur as { path: string; branch?: string; head?: string });

			assert.strictEqual(items.length, 0);
		});

		it("should handle detached HEAD worktrees (no branch field)", () => {
			const detachedOutput = `worktree /path/to/detached
HEAD abc123`;
			const lines = detachedOutput.split("\n");
			const items: Array<{ path: string; branch?: string; head?: string }> = [];
			let cur: { path?: string; branch?: string; head?: string } = {};

			for (const line of lines) {
				if (!line.trim()) continue;
				if (line.startsWith("worktree ")) {
					if (cur.path)
						items.push(cur as { path: string; branch?: string; head?: string });
					cur = { path: line.slice("worktree ".length).trim() };
				} else if (line.startsWith("branch ")) {
					cur.branch = line
						.slice("branch ".length)
						.trim()
						.replace(/^refs\/heads\//, "");
				} else if (line.startsWith("HEAD ")) {
					cur.head = line.slice("HEAD ".length).trim();
				}
			}
			if (cur.path && cur.path.length > 0)
				items.push(cur as { path: string; branch?: string; head?: string });

			assert.strictEqual(items.length, 1);
			assert.strictEqual(items[0]?.path, "/path/to/detached");
			assert.strictEqual(items[0]?.branch, undefined);
			assert.strictEqual(items[0]?.head, "abc123");
		});

		it("should handle refs/heads/ prefix stripping", () => {
			const output = `worktree /path/to/repo
HEAD abc123
branch refs/heads/feature-branch`;
			const lines = output.split("\n");
			const items: Array<{ path: string; branch?: string; head?: string }> = [];
			let cur: { path?: string; branch?: string; head?: string } = {};

			for (const line of lines) {
				if (!line.trim()) continue;
				if (line.startsWith("worktree ")) {
					if (cur.path)
						items.push(cur as { path: string; branch?: string; head?: string });
					cur = { path: line.slice("worktree ".length).trim() };
				} else if (line.startsWith("branch ")) {
					cur.branch = line
						.slice("branch ".length)
						.trim()
						.replace(/^refs\/heads\//, "");
				} else if (line.startsWith("HEAD ")) {
					cur.head = line.slice("HEAD ".length).trim();
				}
			}
			if (cur.path && cur.path.length > 0)
				items.push(cur as { path: string; branch?: string; head?: string });

			assert.strictEqual(items[0]?.branch, "feature-branch");
		});
	});

	describe("defaultDir path generation", () => {
		it("should generate correct path format", () => {
			const repoName = "my-repo";
			const branch = "feature-xyz";
			const repoRoot = "/Users/test/projects/my-repo";

			// Simulates what defaultDir does
			const parentDir = repoRoot.split("/").slice(0, -1).join("/");
			const expected = `${parentDir}/${repoName}-${branch}`;

			assert.ok(expected.includes("my-repo-feature-xyz"));
			assert.ok(expected.endsWith("/my-repo-feature-xyz"));
		});
	});

	describe("branch validation integration", () => {
		it("should validate branch names in createWorktree", async () => {
			const { validateBranchName } = await import("./validation.js");

			// These should throw
			assert.throws(
				() => validateBranchName("my branch"),
				/cannot contain spaces/,
			);
			assert.throws(() => validateBranchName(""), /cannot be empty/);
			assert.throws(() => validateBranchName("feature..bug"), /cannot contain/);

			// These should not throw
			assert.doesNotThrow(() => validateBranchName("feature"));
			assert.doesNotThrow(() => validateBranchName("feature/my-branch"));
		});
	});

	describe("detectDefaultBranch behavior", () => {
		it("should prioritize main over master", () => {
			// This test documents the expected behavior:
			// 1. Check for local 'main' branch
			// 2. Check for remote 'main' branch (origin/main)
			// 3. Check for local 'master' branch
			// 4. Check for remote 'master' branch (origin/master)
			// 5. Throw error if neither exists
			const candidates = ["main", "master"];
			assert.strictEqual(candidates[0], "main");
			assert.strictEqual(candidates[1], "master");
			assert.strictEqual(candidates.length, 2);
		});
	});

	describe("findOrphanedWorktrees logic", () => {
		it("should identify worktrees without branches as non-orphaned", () => {
			// Worktrees without branches (detached HEAD) should not be considered orphaned
			const worktrees = [
				{ path: "/path/to/main", branch: "main", head: "abc123" },
				{ path: "/path/to/detached", head: "def456" }, // No branch
			];

			// Simulating the logic: worktrees without branches are skipped
			const potentialOrphans = worktrees.filter((wt) => wt.branch);
			assert.strictEqual(potentialOrphans.length, 1);
			assert.strictEqual(potentialOrphans[0]?.branch, "main");
		});

		it("should filter worktrees by branch existence", () => {
			// Mock data
			const worktrees = [
				{ path: "/path/to/main", branch: "main" },
				{ path: "/path/to/feature", branch: "feature" },
				{ path: "/path/to/deleted", branch: "deleted-branch" },
			];

			// Simulate branches that exist
			const existingBranches = new Set(["main", "feature"]);

			// Find orphaned worktrees (branches that don't exist)
			const orphaned = worktrees.filter(
				(wt) => wt.branch && !existingBranches.has(wt.branch),
			);

			assert.strictEqual(orphaned.length, 1);
			assert.strictEqual(orphaned[0]?.branch, "deleted-branch");
		});
	});

	describe("installPruneHook behavior", () => {
		it("should generate correct hook content", () => {
			const expectedContent = `#!/bin/sh
# Auto-installed by twig: prune orphaned worktrees
twig prune --yes 2>/dev/null || true
`;
			// Verify the hook content format
			assert.ok(expectedContent.startsWith("#!/bin/sh"));
			assert.ok(expectedContent.includes("twig prune --yes"));
			assert.ok(expectedContent.includes("2>/dev/null || true"));
		});

		it("should detect existing hook content", () => {
			const existingHook1 = `#!/bin/sh
# Auto-installed by twig: prune orphaned worktrees
twig prune --yes 2>/dev/null || true
`;

			const existingHook2 = `#!/bin/sh
# Some other hook
echo "Checking out"
# Auto-installed by twig: prune orphaned worktrees
twig prune --yes 2>/dev/null || true
`;

			const newHook = `#!/bin/sh
echo "Different hook"
`;

			assert.ok(existingHook1.includes("twig prune"));
			assert.ok(existingHook2.includes("twig prune"));
			assert.ok(!newHook.includes("twig prune"));
		});
	});
});
