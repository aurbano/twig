import assert from "node:assert";
import { describe, it } from "node:test";
import type { EditorConfig } from "./config.js";
import { getEditorName, resolveEditorCommand } from "./editor.js";

describe("editor module", () => {
	describe("getEditorName", () => {
		it("should return friendly names for common editors", () => {
			assert.strictEqual(getEditorName("cursor"), "Cursor");
			assert.strictEqual(getEditorName("code"), "VS Code");
			assert.strictEqual(getEditorName("claude"), "Claude");
			assert.strictEqual(getEditorName("vim"), "Vim");
			assert.strictEqual(getEditorName("nvim"), "Neovim");
			assert.strictEqual(getEditorName("emacs"), "Emacs");
			assert.strictEqual(getEditorName("nano"), "Nano");
		});

		it("should return the command itself for unknown editors", () => {
			assert.strictEqual(getEditorName("myeditor"), "myeditor");
			assert.strictEqual(getEditorName("custom-editor"), "custom-editor");
		});
	});

	describe("resolveEditorCommand", () => {
		it("should handle string config format", () => {
			const config: EditorConfig = "cursor";
			const result = resolveEditorCommand(config);

			assert.strictEqual(result.command, "cursor");
			assert.deepStrictEqual(result.args, ["."]);
		});

		it("should handle structured config format with args", () => {
			const config: EditorConfig = {
				command: "code",
				args: ["--new-window", "."],
			};
			const result = resolveEditorCommand(config);

			assert.strictEqual(result.command, "code");
			assert.deepStrictEqual(result.args, ["--new-window", "."]);
		});

		it("should use default args if not provided in structured config", () => {
			const config: EditorConfig = {
				command: "vim",
			};
			const result = resolveEditorCommand(config);

			assert.strictEqual(result.command, "vim");
			assert.deepStrictEqual(result.args, ["."]);
		});

		it("should handle empty args array", () => {
			const config: EditorConfig = {
				command: "code",
				args: [],
			};
			const result = resolveEditorCommand(config);

			assert.strictEqual(result.command, "code");
			assert.deepStrictEqual(result.args, []);
		});
	});
});
