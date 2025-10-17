import { mock } from "node:test";

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
