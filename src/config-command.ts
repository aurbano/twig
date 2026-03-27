import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import {
	DEFAULT_SKIP_DIRECTORIES,
	getConfigPath,
	getConfigValue,
	loadGlobalConfig,
	saveGlobalConfig,
	setConfigValue,
	type TwigConfig,
	VALID_CONFIG_KEYS,
} from "./utils/config.js";

export async function configPath(): Promise<void> {
	console.log(getConfigPath());
}

export async function configList(): Promise<void> {
	const config = loadGlobalConfig();
	console.log(JSON.stringify(config, null, 2));
}

export async function configGet(key: string): Promise<void> {
	if (!VALID_CONFIG_KEYS.includes(key)) {
		console.error(`Unknown config key: ${key}`);
		console.error(`Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`);
		process.exit(1);
	}

	const config = loadGlobalConfig();
	const value = getConfigValue(config, key);
	if (value === undefined) {
		console.log("(not set)");
		return;
	}
	console.log(JSON.stringify(value));
}

function parseValue(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}

export async function configSet(key: string, value: string): Promise<void> {
	if (!VALID_CONFIG_KEYS.includes(key)) {
		console.error(`Unknown config key: ${key}`);
		console.error(`Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`);
		process.exit(1);
	}

	const config = loadGlobalConfig();
	const parsed = parseValue(value);
	const updated = setConfigValue(config, key, parsed);
	saveGlobalConfig(updated);
	console.log(`Set ${chalk.bold(key)} = ${JSON.stringify(parsed)}`);
}

export async function configWizard(): Promise<void> {
	console.log(chalk.bold("\nTwig Configuration\n"));

	const existing = loadGlobalConfig();

	const editor = await selectEditor(existing);
	const openEditor = await confirm({
		message: "Open editor after creating a branch?",
		default: existing.openEditor ?? true,
	});
	const cdAfterBranch = await confirm({
		message: "cd to worktree directory after creating a branch?",
		default: existing.cdAfterBranch ?? true,
	});
	const skipPatterns = await inputSkipPatterns(existing);
	const autoInstall = await confirm({
		message: "Auto-install dependencies in new worktrees?",
		default: existing.dependencies?.autoInstall ?? true,
	});

	const config: TwigConfig = {
		...(editor && { editor }),
		openEditor,
		cdAfterBranch,
		...(skipPatterns.length > 0 && {
			copyStrategy: { skip: skipPatterns },
		}),
		dependencies: { autoInstall },
	};

	saveGlobalConfig(config);
	console.log(
		`\n${chalk.green("✓")} Config saved to ${chalk.dim(getConfigPath())}\n`,
	);
}

async function selectEditor(existing: TwigConfig): Promise<string | undefined> {
	const currentEditor =
		typeof existing.editor === "string"
			? existing.editor
			: typeof existing.editor === "object"
				? existing.editor.command
				: undefined;

	const choice = await select({
		message: "Editor to open after branching:",
		choices: [
			{ name: "Cursor", value: "cursor" },
			{ name: "VS Code", value: "code" },
			{ name: "Claude Code", value: "claude" },
			{ name: "Vim", value: "vim" },
			{ name: "Neovim", value: "nvim" },
			{ name: "Custom", value: "__custom__" },
			{ name: "Auto-detect", value: "__auto__" },
		],
		default: currentEditor ?? "__auto__",
	});

	if (choice === "__auto__") return undefined;
	if (choice === "__custom__") {
		const opts: { message: string; default?: string } = {
			message: "Editor command:",
		};
		if (currentEditor) {
			opts.default = currentEditor;
		}
		return await input(opts);
	}
	return choice;
}

async function inputSkipPatterns(existing: TwigConfig): Promise<string[]> {
	const current = existing.copyStrategy?.skip ?? DEFAULT_SKIP_DIRECTORIES;

	const raw = await input({
		message: "Directories to skip when copying (comma-separated):",
		default: current.join(", "),
	});

	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}
