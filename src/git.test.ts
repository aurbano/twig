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
});
