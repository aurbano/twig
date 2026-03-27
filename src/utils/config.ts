import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
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
	openEditor?: boolean;
	cdAfterBranch?: boolean;
	copyStrategy?: CopyStrategyConfig;
	dependencies?: DependencyConfig;
}

// ── Path helpers ──

export function getGlobalConfigDir(): string {
	return join(homedir(), ".twig");
}

function getGlobalConfigPath(): string {
	return join(getGlobalConfigDir(), "config");
}

export function getConfigPath(): string {
	return getGlobalConfigPath();
}

// ── Config file I/O ──

function loadConfigFile(path: string): TwigConfig | null {
	if (!existsSync(path)) {
		return null;
	}

	try {
		const content = readFileSync(path, "utf-8");
		const config = JSON.parse(content);

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

export function loadGlobalConfig(): TwigConfig {
	return loadConfigFile(getGlobalConfigPath()) ?? {};
}

export function saveGlobalConfig(config: TwigConfig): void {
	const dir = getGlobalConfigDir();
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		getGlobalConfigPath(),
		`${JSON.stringify(config, null, 2)}\n`,
		"utf-8",
	);
}

// ── Generic config field loader (project → global → null) ──

type Validator<T> = (value: unknown, source: string) => T | null;

function loadConfigField<T>(
	targetDir: string,
	field: keyof TwigConfig,
	validate: Validator<T>,
): T | null {
	const projectConfigPath = join(targetDir, ".twig");
	const projectConfig = loadConfigFile(projectConfigPath);
	const projectValue = projectConfig?.[field];
	if (projectValue !== undefined) {
		const validated = validate(projectValue, projectConfigPath);
		if (validated !== null) return validated;
	}

	const globalConfig = loadConfigFile(getGlobalConfigPath());
	const globalValue = globalConfig?.[field];
	if (globalValue !== undefined) {
		const validated = validate(globalValue, getGlobalConfigPath());
		if (validated !== null) return validated;
	}

	return null;
}

// ── Validators ──

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

		if (obj.args) {
			return { command: obj.command, args: obj.args as string[] };
		}
		return { command: obj.command };
	}

	console.warn(
		`Invalid editor config in ${source}: must be a string or object with 'command'`,
	);
	return null;
}

function booleanValidator(field: string): Validator<boolean> {
	return (value: unknown, source: string): boolean | null => {
		if (typeof value !== "boolean") {
			console.warn(`Invalid ${field} in ${source}: must be a boolean`);
			return null;
		}
		return value;
	};
}

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

// ── Public config loaders ──

export function detectSmartDefault(targetDir: string): string | null {
	if (existsSync(join(targetDir, ".cursor"))) return "cursor";
	if (existsSync(join(targetDir, ".vscode"))) return "code";
	if (existsSync(join(targetDir, ".claude"))) return "claude";
	return null;
}

export async function loadEditorConfig(
	targetDir: string,
): Promise<EditorConfig | null> {
	const config = loadConfigField(targetDir, "editor", validateEditorConfig);
	if (config) return config;
	return detectSmartDefault(targetDir);
}

export async function loadOpenEditorConfig(
	targetDir: string,
): Promise<boolean> {
	return (
		loadConfigField(targetDir, "openEditor", booleanValidator("openEditor")) ??
		true
	);
}

export async function loadCdAfterBranchConfig(
	targetDir: string,
): Promise<boolean> {
	return (
		loadConfigField(
			targetDir,
			"cdAfterBranch",
			booleanValidator("cdAfterBranch"),
		) ?? true
	);
}

export async function loadCopyStrategyConfig(
	targetDir: string,
): Promise<CopyStrategyConfig> {
	const validated = loadConfigField(
		targetDir,
		"copyStrategy",
		validateCopyStrategyConfig,
	);
	if (validated) {
		return {
			skip: validated.skip ?? DEFAULT_SKIP_DIRECTORIES,
			timeout: validated.timeout ?? 300000,
			...(validated.symlink && { symlink: validated.symlink }),
		};
	}
	return { skip: DEFAULT_SKIP_DIRECTORIES, timeout: 300000 };
}

export async function loadDependencyConfig(
	targetDir: string,
): Promise<DependencyConfig> {
	const validated = loadConfigField(
		targetDir,
		"dependencies",
		validateDependencyConfig,
	);
	if (validated) {
		return {
			autoInstall: validated.autoInstall ?? true,
			...(validated.command && { command: validated.command }),
		};
	}
	return { autoInstall: true };
}

// ── Dot-notation config access for `twig config get/set` ──
//
// Uses an explicit allowlist of known keys to avoid dynamic property
// traversal (which triggers prototype-pollution warnings).

type ConfigGetter = (config: TwigConfig) => unknown;
type ConfigSetter = (config: TwigConfig, value: unknown) => TwigConfig;

const CONFIG_GETTERS: Record<string, ConfigGetter> = {
	editor: (c) => c.editor,
	"editor.command": (c) =>
		typeof c.editor === "object" ? c.editor.command : undefined,
	"editor.args": (c) =>
		typeof c.editor === "object" ? c.editor.args : undefined,
	openEditor: (c) => c.openEditor,
	cdAfterBranch: (c) => c.cdAfterBranch,
	copyStrategy: (c) => c.copyStrategy,
	"copyStrategy.skip": (c) => c.copyStrategy?.skip,
	"copyStrategy.symlink": (c) => c.copyStrategy?.symlink,
	"copyStrategy.timeout": (c) => c.copyStrategy?.timeout,
	dependencies: (c) => c.dependencies,
	"dependencies.autoInstall": (c) => c.dependencies?.autoInstall,
	"dependencies.command": (c) => c.dependencies?.command,
};

const CONFIG_SETTERS: Record<string, ConfigSetter> = {
	editor: (c, v) => ({ ...c, editor: v as EditorConfig }),
	"editor.command": (c, v) => {
		const base = typeof c.editor === "object" ? c.editor : {};
		return { ...c, editor: { ...base, command: v as string } };
	},
	"editor.args": (c, v) => {
		const base = typeof c.editor === "object" ? c.editor : { command: "" };
		return { ...c, editor: { ...base, args: v as string[] } };
	},
	openEditor: (c, v) => ({ ...c, openEditor: v as boolean }),
	cdAfterBranch: (c, v) => ({ ...c, cdAfterBranch: v as boolean }),
	copyStrategy: (c, v) => ({ ...c, copyStrategy: v as CopyStrategyConfig }),
	"copyStrategy.skip": (c, v) => ({
		...c,
		copyStrategy: { ...c.copyStrategy, skip: v as string[] },
	}),
	"copyStrategy.symlink": (c, v) => ({
		...c,
		copyStrategy: { ...c.copyStrategy, symlink: v as string[] },
	}),
	"copyStrategy.timeout": (c, v) => ({
		...c,
		copyStrategy: { ...c.copyStrategy, timeout: v as number },
	}),
	dependencies: (c, v) => ({ ...c, dependencies: v as DependencyConfig }),
	"dependencies.autoInstall": (c, v) => ({
		...c,
		dependencies: { ...c.dependencies, autoInstall: v as boolean },
	}),
	"dependencies.command": (c, v) => ({
		...c,
		dependencies: { ...c.dependencies, command: v as string[] },
	}),
};

export const VALID_CONFIG_KEYS = Object.keys(CONFIG_GETTERS);

export function getConfigValue(config: TwigConfig, key: string): unknown {
	const getter = CONFIG_GETTERS[key];
	if (!getter) return undefined;
	return getter(config);
}

export function setConfigValue(
	config: TwigConfig,
	key: string,
	value: unknown,
): TwigConfig {
	const setter = CONFIG_SETTERS[key];
	if (!setter) return config;
	return setter(config, value);
}
