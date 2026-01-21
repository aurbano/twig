import assert from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { detectDependencies } from "./detectDependencies.js";

describe("detectDependencies", () => {
	let testDir: string;

	beforeEach(async () => {
		// Create a unique temp directory for each test
		testDir = join(
			tmpdir(),
			`twig-test-deps-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup
		await rm(testDir, { recursive: true, force: true });
	});

	describe("Node.js detection", () => {
		it("should detect pnpm from pnpm-lock.yaml", async () => {
			await writeFile(join(testDir, "package.json"), "{}");
			await writeFile(join(testDir, "pnpm-lock.yaml"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "pnpm");
			assert.strictEqual(result?.lockFile, "pnpm-lock.yaml");
			assert.deepStrictEqual(result?.installCommand, ["pnpm", "install"]);
		});

		it("should detect yarn from yarn.lock", async () => {
			await writeFile(join(testDir, "package.json"), "{}");
			await writeFile(join(testDir, "yarn.lock"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "yarn");
			assert.strictEqual(result?.lockFile, "yarn.lock");
			assert.deepStrictEqual(result?.installCommand, ["yarn", "install"]);
		});

		it("should detect bun from bun.lockb", async () => {
			await writeFile(join(testDir, "package.json"), "{}");
			await writeFile(join(testDir, "bun.lockb"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "bun");
			assert.strictEqual(result?.lockFile, "bun.lockb");
			assert.deepStrictEqual(result?.installCommand, ["bun", "install"]);
		});

		it("should detect npm from package-lock.json", async () => {
			await writeFile(join(testDir, "package.json"), "{}");
			await writeFile(join(testDir, "package-lock.json"), "{}");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "npm");
			assert.strictEqual(result?.lockFile, "package-lock.json");
			assert.deepStrictEqual(result?.installCommand, ["npm", "install"]);
		});

		it("should default to npm for package.json without lockfile", async () => {
			await writeFile(join(testDir, "package.json"), "{}");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "npm");
			assert.strictEqual(result?.lockFile, undefined);
			assert.deepStrictEqual(result?.installCommand, ["npm", "install"]);
		});
	});

	describe("Python detection", () => {
		it("should detect uv from uv.lock", async () => {
			await writeFile(join(testDir, "pyproject.toml"), "");
			await writeFile(join(testDir, "uv.lock"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "uv");
			assert.strictEqual(result?.lockFile, "uv.lock");
			assert.deepStrictEqual(result?.installCommand, ["uv", "sync"]);
		});

		it("should detect poetry from poetry.lock", async () => {
			await writeFile(join(testDir, "pyproject.toml"), "");
			await writeFile(join(testDir, "poetry.lock"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "poetry");
			assert.strictEqual(result?.lockFile, "poetry.lock");
			assert.deepStrictEqual(result?.installCommand, ["poetry", "install"]);
		});

		it("should detect pipenv from Pipfile", async () => {
			await writeFile(join(testDir, "Pipfile"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "pipenv");
			assert.deepStrictEqual(result?.installCommand, ["pipenv", "install"]);
		});

		it("should detect pip from requirements.txt", async () => {
			await writeFile(join(testDir, "requirements.txt"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "pip");
			assert.deepStrictEqual(result?.installCommand, [
				"pip",
				"install",
				"-r",
				"requirements.txt",
			]);
		});

		it("should detect pip from pyproject.toml without lockfile", async () => {
			await writeFile(join(testDir, "pyproject.toml"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "pip");
			assert.deepStrictEqual(result?.installCommand, [
				"pip",
				"install",
				"-e",
				".",
			]);
		});
	});

	describe("Rust detection", () => {
		it("should detect cargo from Cargo.toml", async () => {
			await writeFile(join(testDir, "Cargo.toml"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "cargo");
			assert.strictEqual(result?.manifestFile, "Cargo.toml");
			assert.deepStrictEqual(result?.installCommand, ["cargo", "fetch"]);
		});

		it("should include Cargo.lock if present", async () => {
			await writeFile(join(testDir, "Cargo.toml"), "");
			await writeFile(join(testDir, "Cargo.lock"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.lockFile, "Cargo.lock");
		});
	});

	describe("Go detection", () => {
		it("should detect go from go.mod", async () => {
			await writeFile(join(testDir, "go.mod"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "go");
			assert.strictEqual(result?.manifestFile, "go.mod");
			assert.deepStrictEqual(result?.installCommand, ["go", "mod", "download"]);
		});
	});

	describe("Ruby detection", () => {
		it("should detect bundler from Gemfile", async () => {
			await writeFile(join(testDir, "Gemfile"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "bundler");
			assert.strictEqual(result?.manifestFile, "Gemfile");
			assert.deepStrictEqual(result?.installCommand, ["bundle", "install"]);
		});
	});

	describe("PHP detection", () => {
		it("should detect composer from composer.json", async () => {
			await writeFile(join(testDir, "composer.json"), "{}");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "composer");
			assert.strictEqual(result?.manifestFile, "composer.json");
			assert.deepStrictEqual(result?.installCommand, ["composer", "install"]);
		});
	});

	describe(".NET detection", () => {
		it("should detect dotnet from .csproj file", async () => {
			await writeFile(join(testDir, "MyProject.csproj"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "dotnet");
			assert.strictEqual(result?.manifestFile, "MyProject.csproj");
			assert.deepStrictEqual(result?.installCommand, ["dotnet", "restore"]);
		});

		it("should detect dotnet from .sln file", async () => {
			await writeFile(join(testDir, "MySolution.sln"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "dotnet");
			assert.strictEqual(result?.manifestFile, "MySolution.sln");
			assert.deepStrictEqual(result?.installCommand, ["dotnet", "restore"]);
		});
	});

	describe("Priority ordering", () => {
		it("should prefer pnpm over npm when both lockfiles exist", async () => {
			await writeFile(join(testDir, "package.json"), "{}");
			await writeFile(join(testDir, "package-lock.json"), "{}");
			await writeFile(join(testDir, "pnpm-lock.yaml"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "pnpm");
		});

		it("should prefer uv over pip when uv.lock exists", async () => {
			await writeFile(join(testDir, "pyproject.toml"), "");
			await writeFile(join(testDir, "uv.lock"), "");
			await writeFile(join(testDir, "requirements.txt"), "");

			const result = await detectDependencies(testDir);

			assert.strictEqual(result?.name, "uv");
		});
	});

	describe("No dependencies", () => {
		it("should return null for empty directory", async () => {
			const result = await detectDependencies(testDir);
			assert.strictEqual(result, null);
		});

		it("should return null for directory with unrelated files", async () => {
			await writeFile(join(testDir, "README.md"), "# Hello");
			await writeFile(join(testDir, "main.c"), "int main() {}");

			const result = await detectDependencies(testDir);
			assert.strictEqual(result, null);
		});
	});
});
