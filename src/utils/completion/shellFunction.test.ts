import assert from "node:assert";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
	installShellFunction,
	isShellFunctionInstalled,
	removeShellFunction,
} from "./shellFunction.js";

function createTempFile(content = ""): string {
	const dir = join(tmpdir(), `twig-test-${Date.now()}-${Math.random()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, ".zshrc");
	writeFileSync(file, content, "utf-8");
	return file;
}

function cleanup(file: string): void {
	rmSync(file, { force: true });
}

describe("shellFunction", () => {
	test("installShellFunction appends block to file", () => {
		const file = createTempFile("existing content\n");
		try {
			installShellFunction(file);
			const content = readFileSync(file, "utf-8");
			assert.ok(content.includes("# begin twig shell integration"));
			assert.ok(content.includes("# end twig shell integration"));
			assert.ok(content.startsWith("existing content\n"));
		} finally {
			cleanup(file);
		}
	});

	test("installShellFunction is idempotent", () => {
		const file = createTempFile("");
		try {
			installShellFunction(file);
			const first = readFileSync(file, "utf-8");
			installShellFunction(file);
			const second = readFileSync(file, "utf-8");
			assert.strictEqual(first, second);
		} finally {
			cleanup(file);
		}
	});

	test("isShellFunctionInstalled detects presence", () => {
		const file = createTempFile("");
		try {
			assert.strictEqual(isShellFunctionInstalled(file), false);
			installShellFunction(file);
			assert.strictEqual(isShellFunctionInstalled(file), true);
		} finally {
			cleanup(file);
		}
	});

	test("removeShellFunction strips the block", () => {
		const file = createTempFile("before\n");
		try {
			installShellFunction(file);
			assert.ok(isShellFunctionInstalled(file));
			removeShellFunction(file);
			assert.strictEqual(isShellFunctionInstalled(file), false);
			const content = readFileSync(file, "utf-8");
			assert.ok(content.includes("before"));
			assert.ok(!content.includes("twig shell integration"));
		} finally {
			cleanup(file);
		}
	});

	test("removeShellFunction is safe on file without marker", () => {
		const file = createTempFile("just some content\n");
		try {
			removeShellFunction(file);
			assert.strictEqual(readFileSync(file, "utf-8"), "just some content\n");
		} finally {
			cleanup(file);
		}
	});
});
