import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { execa } from "execa";
import type { DependencyManager } from "./detectDependencies.js";

export interface InstallOptions {
	/** Skip prompts and auto-run install */
	yes?: boolean;
	/** Skip install entirely */
	noInstall?: boolean;
}

/**
 * Run the dependency install command for the detected package manager.
 * Prompts the user for confirmation unless --yes is passed.
 */
export async function runInstall(
	dir: string,
	manager: DependencyManager,
	opts: InstallOptions = {},
): Promise<void> {
	// Skip if --no-install was passed
	if (opts.noInstall) {
		return;
	}

	const commandStr = manager.installCommand.join(" ");
	const lockInfo = manager.lockFile ? ` with ${manager.lockFile}` : "";

	console.log(
		`\nDetected ${chalk.cyan(manager.manifestFile)}${lockInfo} (${manager.name})`,
	);

	// If --yes is passed, auto-run without prompting
	const shouldInstall =
		opts.yes ||
		(await confirm({
			message: `Run ${chalk.yellow(commandStr)}?`,
			default: true,
		}));

	if (!shouldInstall) {
		console.log("Skipping dependency installation.");
		return;
	}

	console.log(`Running ${chalk.yellow(commandStr)}...`);

	try {
		const [cmd, ...args] = manager.installCommand;
		if (!cmd) {
			throw new Error("Install command is empty");
		}
		await execa(cmd, args, {
			cwd: dir,
			stdio: "inherit", // Stream output to terminal
		});
		console.log(chalk.green("Dependencies installed successfully."));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.warn(
			chalk.yellow(`Warning: Failed to install dependencies: ${message}`),
		);
		console.warn(chalk.dim(`You can manually run: cd ${dir} && ${commandStr}`));
	}
}
