import assert from "node:assert";
import { describe, it } from "node:test";
import {
	validateBranchName,
	validateDockerImage,
	validatePackageNames,
	validatePortList,
} from "./validation.js";

describe("validation module", () => {
	describe("validateBranchName", () => {
		it("should accept valid branch names", () => {
			assert.doesNotThrow(() => validateBranchName("feature"));
			assert.doesNotThrow(() => validateBranchName("feature/my-feature"));
			assert.doesNotThrow(() => validateBranchName("feature-123"));
			assert.doesNotThrow(() => validateBranchName("fix_bug"));
		});

		it("should reject empty branch names", () => {
			assert.throws(
				() => validateBranchName(""),
				/Branch name cannot be empty/,
			);
			assert.throws(
				() => validateBranchName("   "),
				/Branch name cannot be empty/,
			);
		});

		it("should reject branch names starting with dot", () => {
			assert.throws(
				() => validateBranchName(".feature"),
				/cannot start with a dot/,
			);
		});

		it("should reject branch names with double dots", () => {
			assert.throws(
				() => validateBranchName("feature..bug"),
				/cannot contain \.\./,
			);
		});

		it("should reject branch names with spaces", () => {
			assert.throws(
				() => validateBranchName("my feature"),
				/cannot contain spaces/,
			);
		});

		it("should reject branch names with special characters", () => {
			assert.throws(() => validateBranchName("feature~123"), /cannot contain/);
			assert.throws(() => validateBranchName("feature^123"), /cannot contain/);
			assert.throws(() => validateBranchName("feature:123"), /cannot contain/);
			assert.throws(() => validateBranchName("feature?123"), /cannot contain/);
			assert.throws(() => validateBranchName("feature*123"), /cannot contain/);
			assert.throws(() => validateBranchName("feature[123]"), /cannot contain/);
		});

		it("should reject branch names ending with slash", () => {
			assert.throws(() => validateBranchName("feature/"), /cannot end with/);
		});

		it("should reject branch names ending with .lock", () => {
			assert.throws(
				() => validateBranchName("feature.lock"),
				/cannot end with \.lock/,
			);
		});

		it("should reject branch names with consecutive slashes", () => {
			assert.throws(
				() => validateBranchName("feature//bug"),
				/cannot start with \/ or contain \/\//,
			);
		});
	});

	describe("validatePortList", () => {
		it("should accept valid port lists", () => {
			assert.doesNotThrow(() => validatePortList("3000"));
			assert.doesNotThrow(() => validatePortList("3000,8080"));
			assert.doesNotThrow(() => validatePortList("3000, 8080, 9000"));
		});

		it("should accept empty port list", () => {
			assert.doesNotThrow(() => validatePortList(""));
			assert.doesNotThrow(() => validatePortList("   "));
		});

		it("should reject non-numeric ports", () => {
			assert.throws(() => validatePortList("abc"), /must be a number/);
			assert.throws(() => validatePortList("3000,abc"), /must be a number/);
		});

		it("should reject ports out of range", () => {
			assert.throws(
				() => validatePortList("0"),
				/must be a number between 1 and 65535/,
			);
			assert.throws(
				() => validatePortList("65536"),
				/must be a number between 1 and 65535/,
			);
			assert.throws(
				() => validatePortList("-1"),
				/must be a number between 1 and 65535/,
			);
		});

		it("should accept ports at boundaries", () => {
			assert.doesNotThrow(() => validatePortList("1"));
			assert.doesNotThrow(() => validatePortList("65535"));
		});
	});

	describe("validateDockerImage", () => {
		it("should accept valid docker images", () => {
			assert.doesNotThrow(() => validateDockerImage("ubuntu"));
			assert.doesNotThrow(() => validateDockerImage("ubuntu:20.04"));
			assert.doesNotThrow(() =>
				validateDockerImage("mcr.microsoft.com/devcontainers/base:ubuntu"),
			);
			assert.doesNotThrow(() =>
				validateDockerImage("registry.io/my-image:latest"),
			);
		});

		it("should reject empty image names", () => {
			assert.throws(
				() => validateDockerImage(""),
				/Docker image name cannot be empty/,
			);
			assert.throws(
				() => validateDockerImage("   "),
				/Docker image name cannot be empty/,
			);
		});

		it("should reject image names with whitespace", () => {
			assert.throws(
				() => validateDockerImage("ubuntu 20.04"),
				/cannot contain whitespace/,
			);
		});

		it("should reject uppercase image names", () => {
			assert.throws(() => validateDockerImage("Ubuntu"), /must be lowercase/);
			assert.throws(
				() => validateDockerImage("my-Image:latest"),
				/must be lowercase/,
			);
		});

		it("should allow uppercase in registry domain", () => {
			// Registry domains can have uppercase
			assert.doesNotThrow(() =>
				validateDockerImage("Registry.io/my-image:latest"),
			);
		});
	});

	describe("validatePackageNames", () => {
		it("should accept valid package names", () => {
			assert.doesNotThrow(() => validatePackageNames("git"));
			assert.doesNotThrow(() => validatePackageNames("git curl wget"));
			assert.doesNotThrow(() => validatePackageNames("libssl-dev"));
			assert.doesNotThrow(() => validatePackageNames("python3.9"));
			assert.doesNotThrow(() => validatePackageNames("g++"));
		});

		it("should accept empty package list", () => {
			assert.doesNotThrow(() => validatePackageNames(""));
			assert.doesNotThrow(() => validatePackageNames("   "));
		});

		it("should reject packages with shell metacharacters", () => {
			assert.throws(
				() => validatePackageNames("git;rm -rf /"),
				/contains shell metacharacters/,
			);
			assert.throws(
				() => validatePackageNames("git&curl"),
				/contains shell metacharacters/,
			);
			assert.throws(
				() => validatePackageNames("git|curl"),
				/contains shell metacharacters/,
			);
			assert.throws(
				() => validatePackageNames("git`whoami`"),
				/contains shell metacharacters/,
			);
			assert.throws(
				() => validatePackageNames("git$(whoami)"),
				/contains shell metacharacters/,
			);
		});

		it("should reject packages with invalid characters", () => {
			assert.throws(
				() => validatePackageNames("git@curl"),
				/must contain only alphanumeric/,
			);
			assert.throws(
				() => validatePackageNames("git curl!"),
				/must contain only alphanumeric/,
			);
		});
	});
});
