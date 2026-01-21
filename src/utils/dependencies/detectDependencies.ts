import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface DependencyManager {
	/** Display name of the package manager (e.g., "npm", "yarn", "cargo") */
	name: string;
	/** The manifest file that was detected (e.g., "package.json") */
	manifestFile: string;
	/** The lockfile that was detected, if any (e.g., "package-lock.json") */
	lockFile?: string;
	/** The command to run for installation (e.g., ["npm", "install"]) */
	installCommand: string[];
}

/**
 * Check if a file exists in the given directory
 */
async function fileExists(dir: string, filename: string): Promise<boolean> {
	try {
		await access(join(dir, filename));
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if any file matching a pattern exists (for .csproj, .sln files)
 */
async function hasFileWithExtension(
	dir: string,
	extension: string,
): Promise<string | null> {
	try {
		const files = await readdir(dir);
		const match = files.find((f) => f.endsWith(extension));
		return match ?? null;
	} catch {
		return null;
	}
}

/**
 * Detects dependency manager from manifest files and lockfiles in the given directory.
 * Returns the detected dependency manager or null if none found.
 *
 * Detection is done in priority order - more specific lockfiles take precedence
 * over generic manifest files.
 */
export async function detectDependencies(
	dir: string,
): Promise<DependencyManager | null> {
	// Node.js - check lockfiles first for specific package manager detection
	if (await fileExists(dir, "pnpm-lock.yaml")) {
		return {
			name: "pnpm",
			manifestFile: "package.json",
			lockFile: "pnpm-lock.yaml",
			installCommand: ["pnpm", "install"],
		};
	}

	if (await fileExists(dir, "yarn.lock")) {
		return {
			name: "yarn",
			manifestFile: "package.json",
			lockFile: "yarn.lock",
			installCommand: ["yarn", "install"],
		};
	}

	if (await fileExists(dir, "bun.lockb")) {
		return {
			name: "bun",
			manifestFile: "package.json",
			lockFile: "bun.lockb",
			installCommand: ["bun", "install"],
		};
	}

	if (await fileExists(dir, "package-lock.json")) {
		return {
			name: "npm",
			manifestFile: "package.json",
			lockFile: "package-lock.json",
			installCommand: ["npm", "install"],
		};
	}

	// package.json without lockfile - default to npm
	if (await fileExists(dir, "package.json")) {
		return {
			name: "npm",
			manifestFile: "package.json",
			installCommand: ["npm", "install"],
		};
	}

	// Python - check lockfiles first
	if (await fileExists(dir, "uv.lock")) {
		return {
			name: "uv",
			manifestFile: "pyproject.toml",
			lockFile: "uv.lock",
			installCommand: ["uv", "sync"],
		};
	}

	if (await fileExists(dir, "poetry.lock")) {
		return {
			name: "poetry",
			manifestFile: "pyproject.toml",
			lockFile: "poetry.lock",
			installCommand: ["poetry", "install"],
		};
	}

	if (
		(await fileExists(dir, "Pipfile.lock")) ||
		(await fileExists(dir, "Pipfile"))
	) {
		const hasLockfile = await fileExists(dir, "Pipfile.lock");
		const result: DependencyManager = {
			name: "pipenv",
			manifestFile: "Pipfile",
			installCommand: ["pipenv", "install"],
		};
		if (hasLockfile) {
			result.lockFile = "Pipfile.lock";
		}
		return result;
	}

	if (await fileExists(dir, "requirements.txt")) {
		return {
			name: "pip",
			manifestFile: "requirements.txt",
			installCommand: ["pip", "install", "-r", "requirements.txt"],
		};
	}

	// pyproject.toml without specific lockfile - use pip
	if (await fileExists(dir, "pyproject.toml")) {
		return {
			name: "pip",
			manifestFile: "pyproject.toml",
			installCommand: ["pip", "install", "-e", "."],
		};
	}

	// Rust
	if (await fileExists(dir, "Cargo.toml")) {
		const hasLockfile = await fileExists(dir, "Cargo.lock");
		const result: DependencyManager = {
			name: "cargo",
			manifestFile: "Cargo.toml",
			installCommand: ["cargo", "fetch"],
		};
		if (hasLockfile) {
			result.lockFile = "Cargo.lock";
		}
		return result;
	}

	// Go
	if (await fileExists(dir, "go.mod")) {
		const hasLockfile = await fileExists(dir, "go.sum");
		const result: DependencyManager = {
			name: "go",
			manifestFile: "go.mod",
			installCommand: ["go", "mod", "download"],
		};
		if (hasLockfile) {
			result.lockFile = "go.sum";
		}
		return result;
	}

	// Ruby
	if (await fileExists(dir, "Gemfile")) {
		const hasLockfile = await fileExists(dir, "Gemfile.lock");
		const result: DependencyManager = {
			name: "bundler",
			manifestFile: "Gemfile",
			installCommand: ["bundle", "install"],
		};
		if (hasLockfile) {
			result.lockFile = "Gemfile.lock";
		}
		return result;
	}

	// PHP
	if (await fileExists(dir, "composer.json")) {
		const hasLockfile = await fileExists(dir, "composer.lock");
		const result: DependencyManager = {
			name: "composer",
			manifestFile: "composer.json",
			installCommand: ["composer", "install"],
		};
		if (hasLockfile) {
			result.lockFile = "composer.lock";
		}
		return result;
	}

	// .NET - check for .csproj or .sln files
	const csprojFile = await hasFileWithExtension(dir, ".csproj");
	if (csprojFile) {
		return {
			name: "dotnet",
			manifestFile: csprojFile,
			installCommand: ["dotnet", "restore"],
		};
	}

	const slnFile = await hasFileWithExtension(dir, ".sln");
	if (slnFile) {
		return {
			name: "dotnet",
			manifestFile: slnFile,
			installCommand: ["dotnet", "restore"],
		};
	}

	return null;
}
