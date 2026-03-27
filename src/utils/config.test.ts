import assert from "node:assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	detectSmartDefault,
	getConfigValue,
	loadCdAfterBranchConfig,
	loadEditorConfig,
	loadOpenEditorConfig,
	setConfigValue,
} from "./config.js";

function createTempDir(): string {
	const dir = join(tmpdir(), `twig-test-${Date.now()}-${Math.random()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function cleanupDir(dir: string): void {
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true, force: true });
	}
}

// ── detectSmartDefault ──

test("detectSmartDefault - detects .cursor folder", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".cursor"));
		assert.strictEqual(detectSmartDefault(testDir), "cursor");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - detects .vscode folder", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".vscode"));
		assert.strictEqual(detectSmartDefault(testDir), "code");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - detects .claude folder", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".claude"));
		assert.strictEqual(detectSmartDefault(testDir), "claude");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - prefers .cursor over .vscode", () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".cursor"));
		mkdirSync(join(testDir, ".vscode"));
		assert.strictEqual(detectSmartDefault(testDir), "cursor");
	} finally {
		cleanupDir(testDir);
	}
});

test("detectSmartDefault - returns null when no markers found", () => {
	const testDir = createTempDir();
	try {
		assert.strictEqual(detectSmartDefault(testDir), null);
	} finally {
		cleanupDir(testDir);
	}
});

// ── loadEditorConfig ──

test("loadEditorConfig - loads simple string format from project config", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: "vim" }),
			"utf-8",
		);
		assert.strictEqual(await loadEditorConfig(testDir), "vim");
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
				editor: { command: "cursor", args: ["--wait", "."] },
			}),
			"utf-8",
		);
		assert.deepStrictEqual(await loadEditorConfig(testDir), {
			command: "cursor",
			args: ["--wait", "."],
		});
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - falls back to smart defaults when no config", async () => {
	const testDir = createTempDir();
	try {
		mkdirSync(join(testDir, ".vscode"));
		assert.strictEqual(await loadEditorConfig(testDir), "code");
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - returns null when no config and no markers", async () => {
	const testDir = createTempDir();
	try {
		assert.strictEqual(await loadEditorConfig(testDir), null);
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
		assert.strictEqual(await loadEditorConfig(testDir), "vim");
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles malformed JSON gracefully", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(join(testDir, ".twig"), "{ invalid json }", "utf-8");
		assert.strictEqual(await loadEditorConfig(testDir), null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles invalid config structure gracefully", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(join(testDir, ".twig"), JSON.stringify([1, 2, 3]), "utf-8");
		assert.strictEqual(await loadEditorConfig(testDir), null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - validates structured format requires command", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: { args: ["--wait"] } }),
			"utf-8",
		);
		assert.strictEqual(await loadEditorConfig(testDir), null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - validates args must be array", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: { command: "vim", args: "invalid" } }),
			"utf-8",
		);
		assert.strictEqual(await loadEditorConfig(testDir), null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - validates args elements must be strings", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: { command: "vim", args: [1, 2, 3] } }),
			"utf-8",
		);
		assert.strictEqual(await loadEditorConfig(testDir), null);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - structured format without args is valid", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: { command: "vim" } }),
			"utf-8",
		);
		assert.deepStrictEqual(await loadEditorConfig(testDir), {
			command: "vim",
		});
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles custom command path", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ editor: "/usr/local/bin/my-editor" }),
			"utf-8",
		);
		assert.strictEqual(
			await loadEditorConfig(testDir),
			"/usr/local/bin/my-editor",
		);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadEditorConfig - handles empty config file", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(join(testDir, ".twig"), JSON.stringify({}), "utf-8");
		assert.strictEqual(await loadEditorConfig(testDir), null);
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
		assert.strictEqual(await loadEditorConfig(testDir), null);
	} finally {
		cleanupDir(testDir);
	}
});

// ── loadOpenEditorConfig ──

test("loadOpenEditorConfig - defaults to true when no config", async () => {
	const testDir = createTempDir();
	try {
		assert.strictEqual(await loadOpenEditorConfig(testDir), true);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadOpenEditorConfig - reads false from project config", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ openEditor: false }),
			"utf-8",
		);
		assert.strictEqual(await loadOpenEditorConfig(testDir), false);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadOpenEditorConfig - ignores invalid value and defaults to true", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ openEditor: "yes" }),
			"utf-8",
		);
		assert.strictEqual(await loadOpenEditorConfig(testDir), true);
	} finally {
		cleanupDir(testDir);
	}
});

// ── loadCdAfterBranchConfig ──

test("loadCdAfterBranchConfig - defaults to true when no config", async () => {
	const testDir = createTempDir();
	try {
		assert.strictEqual(await loadCdAfterBranchConfig(testDir), true);
	} finally {
		cleanupDir(testDir);
	}
});

test("loadCdAfterBranchConfig - reads false from project config", async () => {
	const testDir = createTempDir();
	try {
		writeFileSync(
			join(testDir, ".twig"),
			JSON.stringify({ cdAfterBranch: false }),
			"utf-8",
		);
		assert.strictEqual(await loadCdAfterBranchConfig(testDir), false);
	} finally {
		cleanupDir(testDir);
	}
});

// ── getConfigValue ──

test("getConfigValue - gets top-level value", () => {
	assert.strictEqual(
		getConfigValue({ openEditor: false }, "openEditor"),
		false,
	);
});

test("getConfigValue - gets nested value", () => {
	assert.strictEqual(
		getConfigValue(
			{ editor: { command: "vim", args: ["."] } },
			"editor.command",
		),
		"vim",
	);
});

test("getConfigValue - returns undefined for unknown key", () => {
	assert.strictEqual(getConfigValue({}, "nonexistent"), undefined);
});

// ── setConfigValue ──

test("setConfigValue - sets top-level value", () => {
	const result = setConfigValue({}, "openEditor", false);
	assert.strictEqual(result.openEditor, false);
});

test("setConfigValue - sets nested value", () => {
	const result = setConfigValue({}, "editor.command", "cursor");
	assert.deepStrictEqual(result.editor, { command: "cursor" });
});

test("setConfigValue - preserves existing values", () => {
	const result = setConfigValue(
		{ openEditor: true, cdAfterBranch: true },
		"openEditor",
		false,
	);
	assert.strictEqual(result.openEditor, false);
	assert.strictEqual(result.cdAfterBranch, true);
});

test("setConfigValue - returns config unchanged for unknown key", () => {
	const original = { openEditor: true };
	const result = setConfigValue(original, "badKey", "val");
	assert.deepStrictEqual(result, original);
});
