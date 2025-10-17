import assert from "node:assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { detectSmartDefault, loadEditorConfig } from "./config.js";

// Helper to create temporary test directories
function createTempDir(): string {
	const dir = join(tmpdir(), `twig-test-${Date.now()}-${Math.random()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

// Helper to clean up test directories
function cleanupDir(dir: string): void {
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true, force: true });
	}
}

test("detectSmartDefault - detects .cursor folder", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".cursor"));
		const result = detectSmartDefault(testDir);
		assert.strictEqual(result, "cursor");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - detects .vscode folder", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".vscode"));
		const result = detectSmartDefault(testDir);
		assert.strictEqual(result, "code");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - detects .claude folder", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".claude"));
		const result = detectSmartDefault(testDir);
		assert.strictEqual(result, "claude");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - prefers .cursor over .vscode", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".cursor"));
		mkdirSync(join(testDir, ".vscode"));
		const result = detectSmartDefault(testDir);
		assert.strictEqual(result, "cursor");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - returns null when no markers found", () => {
	const testDir = createTempDir();
	try {
		const result = detectSmartDefault(testDir);
		assert.strictEqual(result, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - loads simple string format from project config", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: "vim" }),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, "vim");
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - loads structured format from project config", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({
				editor: {
					command: "cursor",
					args: ["--wait", "."],
				},
			}),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.deepStrictEqual(config, {
			command: "cursor",
			args: ["--wait", "."],
		});
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles 'none' value", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: "none" }),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, "none");
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - falls back to smart defaults when no config", async () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".vscode"));
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, "code");
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - returns null when no config and no markers", async () => {
	const testDir = createTempDir();
	try {
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - project config takes precedence over smart defaults", async () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".vscode"));
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: "vim" }),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, "vim");
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles malformed JSON gracefully", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(join(testDir, ".twig"), "{ invalid json }", "utf-8");
		const config = await loadEditorConfig(testDir);
		// Should fall back to smart defaults or null
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles invalid config structure gracefully", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(join(testDir, ".twig"), JSON.stringify([1, 2, 3]), "utf-8");
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - validates structured format requires command", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({
				editor: { args: ["--wait"] }, // missing command
			}),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - validates args must be array", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({
				editor: { command: "vim", args: "invalid" },
			}),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - validates args elements must be strings", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({
				editor: { command: "vim", args: [1, 2, 3] },
			}),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - structured format without args is valid", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({
				editor: { command: "vim" },
			}),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.deepStrictEqual(config, { command: "vim" });
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles custom command path", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({
				editor: "/usr/local/bin/my-editor",
			}),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, "/usr/local/bin/my-editor");
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles empty config file", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(join(testDir, ".twig"), JSON.stringify({}), "utf-8");
		const config = await loadEditorConfig(testDir);
		// Should fall back to smart defaults
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - ignores config with null editor value", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: null }),
			"utf-8",
		);
		const config = await loadEditorConfig(testDir);
		assert.strictEqual(config, null);
	} finally {
		cleanupDir(testDir);
	}
});
