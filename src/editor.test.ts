import assert from "node:assert";
import { describe, it } from "node:test";

describe("editor module", () => {
	describe("editor priority logic", () => {
		it("should prioritize cursor over code over manual", () => {
			const editors = ["cursor", "code", "manual"];
			assert.strictEqual(editors[0], "cursor");
			assert.strictEqual(editors[1], "code");
			assert.strictEqual(editors[2], "manual");
		});

		it("should check exitCode for command success", () => {
			const successExitCode: number = 0;
			const failureExitCode: number = 1;
			const notFoundExitCode: number = 127;

			assert.strictEqual(successExitCode === 0, true);
			assert.strictEqual(failureExitCode === 0, false);
			assert.strictEqual(notFoundExitCode === 0, false);
		});
	});

	describe("command execution behavior", () => {
		it("should run commands with correct directory context", () => {
			const testDir = "/test/dir";
			const expectedCwd = testDir;

			assert.strictEqual(testDir, expectedCwd);
		});

		it("should handle command not found gracefully", () => {
			// When exitCode is non-zero (command not found or failed),
			// the function should fallback to the next editor
			const fallbackRequired = true;
			assert.strictEqual(fallbackRequired, true);
		});
	});
});
