import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";
import { execa } from "execa";

export interface MockExecaResult {
	stdout: string;
	exitCode: number;
	stderr: string;
	command: string;
	escapedCommand: string;
	failed: boolean;
	timedOut: boolean;
	isCanceled: boolean;
	killed: boolean;
	code?: string | undefined;
}

export function createMockExeca(commands: Map<string, MockExecaResult>) {
	return mock.fn((cmd: string, args?: readonly string[]) => {
		const key = `${cmd} ${args?.join(" ") || ""}`.trim();
		const result = commands.get(key);
		if (!result) {
			throw new Error(`Unexpected command: ${key}`);
		}
		if (result.failed) {
			return Promise.reject(result);
		}
		return Promise.resolve(result);
	});
}

export function mockExecaSuccess(stdout = "", exitCode = 0): MockExecaResult {
	return {
		stdout,
		exitCode,
		stderr: "",
		command: "",
		escapedCommand: "",
		failed: false,
		timedOut: false,
		isCanceled: false,
		killed: false,
	};
}

export function mockExecaFailure(
	exitCode = 1,
	stderr = "",
	code?: string,
): MockExecaResult {
	return {
		stdout: "",
		exitCode,
		stderr,
		command: "",
		escapedCommand: "",
		failed: true,
		timedOut: false,
		isCanceled: false,
		killed: false,
		code,
	};
}

export const sampleWorktreeOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature

worktree /path/to/detached
HEAD ghi789`;

export function createMockConfirm(value: boolean) {
	return mock.fn(() => Promise.resolve(value));
}

export interface MockFsStats {
	isDirectory: () => boolean;
	isFile: () => boolean;
}

export function mockDirectoryStats(): MockFsStats {
	return {
		isDirectory: () => true,
		isFile: () => false,
	};
}

export function mockFileStats(): MockFsStats {
	return {
		isDirectory: () => false,
		isFile: () => true,
	};
}

/**
 * Sets up a temporary git repository for testing.
 * Changes the current working directory to the temp repo and restores it in cleanup.
 * @returns An object with the temp repo path and a cleanup function
 */
export async function setupTempGitRepo(): Promise<{
	repoPath: string;
	cleanup: () => Promise<void>;
}> {
	const originalCwd = process.cwd();
	const repoPath = await mkdtemp(join(tmpdir(), "twig-test-"));

	// Initialize git repository
	await execa("git", ["init"], { cwd: repoPath });

	// Configure git to avoid interactive prompts during tests
	await execa("git", ["config", "user.name", "Test User"], { cwd: repoPath });
	await execa("git", ["config", "user.email", "test@example.com"], {
		cwd: repoPath,
	});

	// Create an initial commit so we have a branch to work with
	await execa("git", ["commit", "--allow-empty", "-m", "Initial commit"], {
		cwd: repoPath,
	});

	// Change to the temp directory
	process.chdir(repoPath);

	return {
		repoPath,
		cleanup: async () => {
			// Restore original working directory
			process.chdir(originalCwd);

			// Clean up temp directory
			try {
				await rm(repoPath, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		},
	};
}
