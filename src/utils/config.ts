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
 * Copy strategy configuration for untracked files
 */
export interface CopyStrategyConfig {
	/** Directories/files to skip entirely (glob patterns supported) */
	skip?: string[];
	/** Files/dirs to symlink instead of copy */
	symlink?: string[];
	/** Copy timeout in milliseconds (default: 300000 = 5 minutes) */
	timeout?: number;
}

/**
 * Dependency installation configuration
 */
export interface DependencyConfig {
	/** Whether to auto-install dependencies (default: true, will prompt) */
	autoInstall?: boolean;
	/** Custom install command to override auto-detection */
	command?: string[];
}

/**
 * Default directories to skip when copying untracked files.
 * These are typically large dependency/build directories that should be
 * regenerated in the new worktree rather than copied.
 */
export const DEFAULT_SKIP_DIRECTORIES = [
	"node_modules",
	".next",
	".nuxt",
	"dist",
	"build",
	".turbo",
	".cache",
	".parcel-cache",
	".vite",
	"coverage",
	".nyc_output",
	"__pycache__",
	".pytest_cache",
	"venv",
	".venv",
	"target", // Rust/Java
	"vendor", // Go/PHP
];

/**
 * Full configuration structure
 */
export interface TwigConfig {
	editor?: EditorConfig;
	copyStrategy?: CopyStrategyConfig;
	dependencies?: DependencyConfig;
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

/**
 * Validate and normalize copy strategy config
 */
function validateCopyStrategyConfig(
	config: unknown,
	source: string,
): CopyStrategyConfig | null {
	if (typeof config !== "object" || config === null) {
		console.warn(`Invalid copyStrategy config in ${source}: must be an object`);
		return null;
	}

	const obj = config as Record<string, unknown>;
	const result: CopyStrategyConfig = {};

	if (obj.skip !== undefined) {
		if (!Array.isArray(obj.skip)) {
			console.warn(`Invalid copyStrategy.skip in ${source}: must be an array`);
			return null;
		}
		if (!obj.skip.every((item) => typeof item === "string")) {
			console.warn(
				`Invalid copyStrategy.skip in ${source}: all items must be strings`,
			);
			return null;
		}
		result.skip = obj.skip as string[];
	}

	if (obj.symlink !== undefined) {
		if (!Array.isArray(obj.symlink)) {
			console.warn(
				`Invalid copyStrategy.symlink in ${source}: must be an array`,
			);
			return null;
		}
		if (!obj.symlink.every((item) => typeof item === "string")) {
			console.warn(
				`Invalid copyStrategy.symlink in ${source}: all items must be strings`,
			);
			return null;
		}
		result.symlink = obj.symlink as string[];
	}

	if (obj.timeout !== undefined) {
		if (typeof obj.timeout !== "number" || obj.timeout <= 0) {
			console.warn(
				`Invalid copyStrategy.timeout in ${source}: must be a positive number`,
			);
			return null;
		}
		result.timeout = obj.timeout;
	}

	return result;
}

/**
 * Load copy strategy configuration with precedence:
 * 1. Per-project .twig file
 * 2. Global config file
 * 3. Default skip list
 */
export async function loadCopyStrategyConfig(
	targetDir: string,
): Promise<CopyStrategyConfig> {
	// 1. Check for per-project config
	const projectConfigPath = join(targetDir, ".twig");
	const projectConfig = loadConfigFile(projectConfigPath);
	if (projectConfig?.copyStrategy) {
		const validated = validateCopyStrategyConfig(
			projectConfig.copyStrategy,
			projectConfigPath,
		);
		if (validated) {
			// Merge with defaults if skip is not explicitly set
			const result: CopyStrategyConfig = {
				skip: validated.skip ?? DEFAULT_SKIP_DIRECTORIES,
				timeout: validated.timeout ?? 300000,
			};
			if (validated.symlink) {
				result.symlink = validated.symlink;
			}
			return result;
		}
	}

	// 2. Check for global config
	const globalConfigPath = getGlobalConfigPath();
	const globalConfig = loadConfigFile(globalConfigPath);
	if (globalConfig?.copyStrategy) {
		const validated = validateCopyStrategyConfig(
			globalConfig.copyStrategy,
			globalConfigPath,
		);
		if (validated) {
			const result: CopyStrategyConfig = {
				skip: validated.skip ?? DEFAULT_SKIP_DIRECTORIES,
				timeout: validated.timeout ?? 300000,
			};
			if (validated.symlink) {
				result.symlink = validated.symlink;
			}
			return result;
		}
	}

	// 3. Return defaults
	return {
		skip: DEFAULT_SKIP_DIRECTORIES,
		timeout: 300000,
	};
}

/**
 * Validate and normalize dependency config
 */
function validateDependencyConfig(
	config: unknown,
	source: string,
): DependencyConfig | null {
	if (typeof config !== "object" || config === null) {
		console.warn(`Invalid dependencies config in ${source}: must be an object`);
		return null;
	}

	const obj = config as Record<string, unknown>;
	const result: DependencyConfig = {};

	if (obj.autoInstall !== undefined) {
		if (typeof obj.autoInstall !== "boolean") {
			console.warn(
				`Invalid dependencies.autoInstall in ${source}: must be a boolean`,
			);
			return null;
		}
		result.autoInstall = obj.autoInstall;
	}

	if (obj.command !== undefined) {
		if (!Array.isArray(obj.command)) {
			console.warn(
				`Invalid dependencies.command in ${source}: must be an array`,
			);
			return null;
		}
		if (!obj.command.every((item) => typeof item === "string")) {
			console.warn(
				`Invalid dependencies.command in ${source}: all items must be strings`,
			);
			return null;
		}
		result.command = obj.command as string[];
	}

	return result;
}

/**
 * Load dependency configuration with precedence:
 * 1. Per-project .twig file
 * 2. Global config file
 * 3. Default (autoInstall: true)
 */
export async function loadDependencyConfig(
	targetDir: string,
): Promise<DependencyConfig> {
	// 1. Check for per-project config
	const projectConfigPath = join(targetDir, ".twig");
	const projectConfig = loadConfigFile(projectConfigPath);
	if (projectConfig?.dependencies) {
		const validated = validateDependencyConfig(
			projectConfig.dependencies,
			projectConfigPath,
		);
		if (validated) {
			return {
				autoInstall: validated.autoInstall ?? true,
				...(validated.command && { command: validated.command }),
			};
		}
	}

	// 2. Check for global config
	const globalConfigPath = getGlobalConfigPath();
	const globalConfig = loadConfigFile(globalConfigPath);
	if (globalConfig?.dependencies) {
		const validated = validateDependencyConfig(
			globalConfig.dependencies,
			globalConfigPath,
		);
		if (validated) {
			return {
				autoInstall: validated.autoInstall ?? true,
				...(validated.command && { command: validated.command }),
			};
		}
	}

	// 3. Return defaults
	return {
		autoInstall: true,
	};
}
