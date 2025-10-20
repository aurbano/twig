import type { EditorConfig } from "./config.js";
import { getConfigPath, loadEditorConfig } from "./config.js";
import { commandExists, spawnDetached } from "./system/process-operations.js";

/**
 * Get a user-friendly name for common editors
 */
export function getEditorName(command: string): string {
	const names: Record<string, string> = {
		cursor: "Cursor",
		code: "VS Code",
		claude: "Claude",
		vim: "Vim",
		nvim: "Neovim",
		emacs: "Emacs",
		nano: "Nano",
	};
	return names[command] || command;
}

/**
 * Resolve editor config to command and args
 */
export function resolveEditorCommand(config: EditorConfig): {
	command: string;
	args: string[];
} {
	if (typeof config === "string") {
		return { command: config, args: ["."] };
	}
	return {
		command: config.command,
		args: config.args || ["."],
	};
}

/**
 * Opens a directory in an editor.
 * Respects configuration from .twig (per-project) or global config.
 * Falls back to smart defaults based on project markers (.cursor, .vscode, .claude).
 * Finally falls back to trying Cursor, then VS Code.
 * @param dir - The directory to open
 */
export async function openInEditor(dir: string): Promise<void> {
	// Load configuration
	const config = await loadEditorConfig(dir);

	// Handle configured editor
	if (config) {
		// Special case: "none" means skip editor launch
		if (config === "none") {
			console.log(`Editor launch skipped (configured as "none"): ${dir}`);
			console.log(
				`Tip: Edit ${getConfigPath()} or ${dir}/.twig to change this`,
			);
			return;
		}

		const { command, args } = resolveEditorCommand(config);

		// Try to launch the configured editor
		if (await commandExists(command)) {
			spawnDetached(command, args, dir);
			console.log(`Opened in ${getEditorName(command)}: ${dir}`);
			return;
		}

		// Configured editor not found, warn and fall through
		console.warn(
			`Configured editor '${command}' not found on PATH. Trying fallback...`,
		);
		console.log(
			`Tip: Edit ${getConfigPath()} or ${dir}/.twig to change editor config`,
		);
	}

	// Fallback: try common editors
	if (await commandExists("cursor")) {
		spawnDetached("cursor", ["."], dir);
		console.log(`Opened in Cursor: ${dir}`);
		return;
	}

	if (await commandExists("code")) {
		spawnDetached("code", ["."], dir);
		console.log(`Opened in VS Code: ${dir}`);
		return;
	}

	// No editor found
	console.log(`No editor found. Open manually: ${dir}`);
	console.log(
		`Tip: Configure your preferred editor in ${getConfigPath()} or ${dir}/.twig`,
	);
}
