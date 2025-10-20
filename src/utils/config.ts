import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * Editor configuration - supports both simple string and structured format
 */
export type EditorConfig =
	| string
	| {
			command: string;
			args?: string[];
	  };

/**
 * Full configuration structure
 */
export interface TwigConfig {
	editor?: EditorConfig;
}

/**
 * Get the global config directory path based on platform
 */
function getGlobalConfigPath(): string {
	const isWindows = platform() === "win32";

	if (isWindows) {
		// Use APPDATA on Windows, fall back to home directory
		const appData =
			process.env.APPDATA || join(homedir(), "AppData", "Roaming");
		return join(appData, "twig", "config.json");
	}

	// Use XDG_CONFIG_HOME on Unix-like systems, fall back to ~/.config
	const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(xdgConfig, "twig", "config.json");
}

/**
 * Load and parse a config file
 */
function loadConfigFile(path: string): TwigConfig | null {
	if (!existsSync(path)) {
		return null;
	}

	try {
		const content = readFileSync(path, "utf-8");
		const config = JSON.parse(content);

		// Validate basic structure
		if (typeof config !== "object" || config === null) {
			console.warn(`Invalid config file at ${path}: must be a JSON object`);
			return null;
		}

		return config;
	} catch (error) {
		if (error instanceof SyntaxError) {
			console.warn(
				`Malformed JSON in config file at ${path}: ${error.message}`,
			);
		} else {
			console.warn(`Error reading config file at ${path}: ${error}`);
		}
		return null;
	}
}

/**
 * Validate and normalize editor config
 */
function validateEditorConfig(
	config: unknown,
	source: string,
): EditorConfig | null {
	if (typeof config === "string") {
		return config;
	}

	if (typeof config === "object" && config !== null) {
		const obj = config as Record<string, unknown>;

		if (typeof obj.command !== "string") {
			console.warn(
				`Invalid editor config in ${source}: 'command' must be a string`,
			);
			return null;
		}

		if (obj.args !== undefined && !Array.isArray(obj.args)) {
			console.warn(
				`Invalid editor config in ${source}: 'args' must be an array`,
			);
			return null;
		}

		if (obj.args && !obj.args.every((arg) => typeof arg === "string")) {
			console.warn(
				`Invalid editor config in ${source}: all 'args' elements must be strings`,
			);
			return null;
		}

		// Only include args if it's defined to satisfy exactOptionalPropertyTypes
		if (obj.args) {
			return {
				command: obj.command,
				args: obj.args as string[],
			};
		}

		return {
			command: obj.command,
		};
	}

	console.warn(
		`Invalid editor config in ${source}: must be a string or object with 'command'`,
	);
	return null;
}

/**
 * Detect smart defaults based on project markers
 */
export function detectSmartDefault(targetDir: string): string | null {
	// Check for common editor-specific folders
	if (existsSync(join(targetDir, ".cursor"))) {
		return "cursor";
	}

	if (existsSync(join(targetDir, ".vscode"))) {
		return "code";
	}

	if (existsSync(join(targetDir, ".claude"))) {
		return "claude";
	}

	return null;
}

/**
 * Load editor configuration with precedence:
 * 1. Per-project .twig file
 * 2. Global config file
 * 3. Smart defaults from project markers
 * 4. null (use fallback behavior)
 */
export async function loadEditorConfig(
	targetDir: string,
): Promise<EditorConfig | null> {
	// 1. Check for per-project config
	const projectConfigPath = join(targetDir, ".twig");
	const projectConfig = loadConfigFile(projectConfigPath);
	if (projectConfig?.editor) {
		const validated = validateEditorConfig(
			projectConfig.editor,
			projectConfigPath,
		);
		if (validated) {
			return validated;
		}
	}

	// 2. Check for global config
	const globalConfigPath = getGlobalConfigPath();
	const globalConfig = loadConfigFile(globalConfigPath);
	if (globalConfig?.editor) {
		const validated = validateEditorConfig(
			globalConfig.editor,
			globalConfigPath,
		);
		if (validated) {
			return validated;
		}
	}

	// 3. Try smart defaults
	const smartDefault = detectSmartDefault(targetDir);
	if (smartDefault) {
		return smartDefault;
	}

	// 4. No config found, return null for fallback behavior
	return null;
}

/**
 * Get the global config path for user reference
 */
export function getConfigPath(): string {
	return getGlobalConfigPath();
}
