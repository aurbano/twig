import assert from "node:assert";
import { describe, it } from "node:test";
import {
	formatMounts,
	formatPackageList,
	formatPorts,
	formatPostCreateCommand,
} from "./utils/devcontainer/formatters.js";
import { generateDevcontainerJson } from "./utils/devcontainer/generateDevcontainerJson.js";
import { generateDockerfileContent } from "./utils/devcontainer/generateDockerfile.js";
import { generateDockerignoreContent } from "./utils/devcontainer/generateDockerignore.js";
import {
	validateDockerImage,
	validatePackageNames,
	validatePortList,
} from "./utils/validation.js";

describe("devcontainer module", () => {
	describe("formatPackageList", () => {
		it("should format package list without trailing backslash on last item", () => {
			const packages = "git curl wget";
			const pkgLines = formatPackageList(packages);

			assert.ok(pkgLines.includes("git \\"));
			assert.ok(pkgLines.includes("curl \\"));
			assert.ok(!pkgLines.includes("wget \\"));
			assert.ok(pkgLines.endsWith("wget"));
		});

		it("should handle single package correctly", () => {
			const packages = "git";
			const pkgLines = formatPackageList(packages);

			assert.ok(!pkgLines.includes("\\"));
			assert.strictEqual(pkgLines.trim(), "git");
		});
	});

	describe("generateDockerfileContent", () => {
		it("should generate correct Dockerfile structure", () => {
			const image = "ubuntu:22.04";
			const packages = "git curl";
			const content = generateDockerfileContent(image, packages);

			assert.ok(content.startsWith("FROM ubuntu:22.04"));
			assert.ok(content.includes("SHELL"));
			assert.ok(content.includes("DEBIAN_FRONTEND=noninteractive"));
			assert.ok(content.includes("apt-get install"));
			assert.ok(content.includes("apt-get clean"));
		});

		it("should generate Dockerfile without packages", () => {
			const image = "ubuntu:22.04";
			const packages = "";
			const content = generateDockerfileContent(image, packages);

			assert.ok(content.startsWith("FROM ubuntu:22.04"));
			assert.ok(content.includes("SHELL"));
			assert.ok(!content.includes("apt-get install"));
		});
	});

	describe("formatPorts", () => {
		it("should format ports array correctly", () => {
			const ports = "3000,8080,9000";
			const forwardPorts = formatPorts(ports);

			assert.strictEqual(forwardPorts, '["3000","8080","9000"]');
		});

		it("should handle empty ports as empty array", () => {
			const ports = "";
			const forwardPorts = formatPorts(ports);

			assert.strictEqual(forwardPorts, "[]");
		});

		it("should trim whitespace from ports", () => {
			const ports = " 3000 , 8080 , 9000 ";
			const forwardPorts = formatPorts(ports);

			assert.strictEqual(forwardPorts, '["3000","8080","9000"]');
		});
	});

	describe("formatMounts", () => {
		it("should format mounts for node_modules volume", () => {
			const mounts = formatMounts(true);

			assert.ok(mounts.includes("node_modules"));
			assert.ok(mounts.includes("type=volume"));
		});

		it("should return empty array when not mounting node_modules", () => {
			const mounts = formatMounts(false);

			assert.strictEqual(mounts, "[]");
		});
	});

	describe("formatPostCreateCommand", () => {
		it("should format postCreateCommand with value", () => {
			const postCreateCommand = formatPostCreateCommand("npm install");

			assert.strictEqual(postCreateCommand, '"npm install"');
		});

		it("should return null for empty postCreateCommand", () => {
			const postCreateCommand = formatPostCreateCommand("");

			assert.strictEqual(postCreateCommand, "null");
		});
	});

	describe("generateDevcontainerJson", () => {
		it("should generate valid devcontainer.json content", () => {
			const json = generateDevcontainerJson({
				ports: "3000,8080",
				mountNodeModules: true,
				postcreate: "npm install",
			});

			assert.ok(json.includes('"forwardPorts": ["3000","8080"]'));
			assert.ok(json.includes("node_modules"));
			assert.ok(json.includes('"postCreateCommand": "npm install"'));
		});

		it("should handle minimal options", () => {
			const json = generateDevcontainerJson({
				ports: "",
				mountNodeModules: false,
				postcreate: "",
			});

			assert.ok(json.includes('"forwardPorts": []'));
			assert.ok(json.includes('"mounts": []'));
			assert.ok(json.includes('"postCreateCommand": null'));
		});
	});

	describe("generateDockerignoreContent", () => {
		it("should contain standard ignores", () => {
			const dockerignoreContent = generateDockerignoreContent();

			assert.ok(dockerignoreContent.includes(".git"));
			assert.ok(dockerignoreContent.includes("node_modules"));
			assert.ok(dockerignoreContent.includes("__pycache__"));
			assert.ok(dockerignoreContent.includes(".DS_Store"));
		});
	});

	describe("validation", () => {
		it("should validate docker image names", () => {
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

		it("should validate port lists", () => {
			assert.throws(() => validatePortList("abc"), /must be a number/);
			assert.throws(() => validatePortList("0"), /between 1 and 65535/);
			assert.throws(() => validatePortList("65536"), /between 1 and 65535/);

			assert.doesNotThrow(() => validatePortList("3000"));
			assert.doesNotThrow(() => validatePortList("3000,8080"));
			assert.doesNotThrow(() => validatePortList(""));
		});

		it("should validate package names", () => {
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
