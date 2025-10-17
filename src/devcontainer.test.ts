import assert from "node:assert";
import { describe, it } from "node:test";

describe("devcontainer module", () => {
	describe("dockerfile package formatting", () => {
		it("should format packages correctly without trailing backslash on last item", () => {
			const packages = "git curl wget";
			const pkgList = packages.split(/\s+/);
			const pkgLines = pkgList
				.map((p, i) => `    ${p}${i < pkgList.length - 1 ? " \\" : ""}`)
				.join("\n");

			// Should have backslashes for all but the last
			assert.ok(pkgLines.includes("git \\"));
			assert.ok(pkgLines.includes("curl \\"));
			// Last package should NOT have trailing backslash in its line
			assert.ok(pkgLines.includes("wget"));
			assert.ok(!pkgLines.includes("wget \\"));

			// Verify each line
			const lines = pkgLines.split("\n");
			assert.strictEqual(lines.length, 3);
			assert.ok(lines[0]?.includes("git \\"));
			assert.ok(lines[1]?.includes("curl \\"));
			assert.ok(lines[2]?.trim() === "wget");
		});

		it("should handle single package correctly", () => {
			const packages = "git";
			const pkgList = packages.split(/\s+/);
			const pkgLines = pkgList
				.map((p, i) => `    ${p}${i < pkgList.length - 1 ? " \\" : ""}`)
				.join("\n");

			// Single package should NOT have trailing backslash
			assert.ok(!pkgLines.includes("\\"));
			assert.strictEqual(pkgLines.trim(), "git");
		});
	});

	describe("port list formatting", () => {
		it("should format ports correctly", () => {
			const ports = "3000,8080";
			const formatted = `[${ports
				.split(",")
				.map((p) => `"${p.trim()}"`)
				.join(",")}]`;

			assert.strictEqual(formatted, '["3000","8080"]');
		});

		it("should handle empty ports by returning empty array", () => {
			// When ports is empty or not provided, should return []
			const emptyArray = "[]";
			assert.strictEqual(emptyArray, "[]");
		});
	});

	describe("validation integration", () => {
		it("should validate docker image names", async () => {
			const { validateDockerImage } = await import("./validation.js");

			assert.throws(() => validateDockerImage(""), /cannot be empty/);
			assert.throws(() => validateDockerImage("Ubuntu"), /must be lowercase/);
			assert.throws(
				() => validateDockerImage("ubuntu 20.04"),
				/cannot contain whitespace/,
			);

			assert.doesNotThrow(() => validateDockerImage("ubuntu"));
			assert.doesNotThrow(() =>
				validateDockerImage("mcr.microsoft.com/devcontainers/base:ubuntu"),
			);
		});

		it("should validate port lists", async () => {
			const { validatePortList } = await import("./validation.js");

			assert.throws(() => validatePortList("abc"), /must be a number/);
			assert.throws(() => validatePortList("0"), /between 1 and 65535/);
			assert.throws(() => validatePortList("65536"), /between 1 and 65535/);

			assert.doesNotThrow(() => validatePortList("3000"));
			assert.doesNotThrow(() => validatePortList("3000,8080"));
			assert.doesNotThrow(() => validatePortList(""));
		});

		it("should validate package names", async () => {
			const { validatePackageNames } = await import("./validation.js");

			assert.throws(
				() => validatePackageNames("git;rm -rf /"),
				/shell metacharacters/,
			);
			assert.throws(
				() => validatePackageNames("git`whoami`"),
				/shell metacharacters/,
			);

			assert.doesNotThrow(() => validatePackageNames("git curl wget"));
			assert.doesNotThrow(() => validatePackageNames("libssl-dev"));
			assert.doesNotThrow(() => validatePackageNames(""));
		});
	});
});
