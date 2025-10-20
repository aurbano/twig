import assert from "node:assert";
import { describe, it } from "node:test";
import { branchExists } from "./utils/git/branchExists.js";
import { defaultDir } from "./utils/git/defaultDir.js";
import { detectDefaultBranch } from "./utils/git/detectDefaultBranch.js";
import { repoName } from "./utils/git/repoName.js";
import { repoRoot } from "./utils/git/repoRoot.js";
import { validateBranchName } from "./utils/validation.js";

describe("git module", () => {
	describe("repoRoot", () => {
		it("should return a valid path", async () => {
			const root = await repoRoot();
			assert.ok(root.length > 0);
			assert.ok(root.includes("twig"));
		});
	});

	describe("repoName", () => {
		it("should return repository name", async () => {
			const name = await repoName();
			assert.strictEqual(name, "twig");
		});
	});

	describe("defaultDir", () => {
		it("should generate correct path format", async () => {
			const branch = "test-branch";
			const result = await defaultDir(branch);
			const name = await repoName();

			// Should end with repo-name-branch
			assert.ok(result.endsWith(`${name}-${branch}`));
			assert.ok(result.includes("twig-test-branch"));
		});
	});

	describe("detectDefaultBranch", () => {
		it("should detect main or master branch", async () => {
			const branch = await detectDefaultBranch();
			// Should be either main or master
			assert.ok(branch === "main" || branch === "master");
		});
	});

	describe("branchExists", () => {
		it("should return true for main/master", async () => {
			const defaultBranch = await detectDefaultBranch();
			const exists = await branchExists(defaultBranch);
			assert.strictEqual(exists, true);
		});

		it("should return false for non-existent branch", async () => {
			const exists = await branchExists(
				"this-branch-definitely-does-not-exist-12345",
			);
			assert.strictEqual(exists, false);
		});
	});

	describe("branch validation integration", () => {
		it("should validate branch names", () => {
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
			assert.doesNotThrow(() => validateBranchName("test-branch-123"));
		});
	});

	describe("path generation logic", () => {
		it("should follow naming convention", async () => {
			const name = await repoName();
			const branches = ["feature-1", "bugfix/issue", "main"];

			for (const branch of branches) {
				const path = await defaultDir(branch);
				assert.ok(path.includes(`${name}-${branch}`));
			}
		});
	});
});
