import type { Command } from "commander";
import omelette from "omelette";
import { buildAliasMap } from "./utils/completion/buildAliasMap.js";
import { extractCommandNames } from "./utils/completion/extractCommandNames.js";
import { getShellInitFile } from "./utils/completion/getShellInitFile.js";
import { isCompletionInstalled } from "./utils/completion/isCompletionInstalled.js";
import {
	installShellFunction,
	removeShellFunction,
} from "./utils/completion/shellFunction.js";
import { parseWorktreesSync } from "./utils/git/parseWorktrees.js";
import { execGitSync } from "./utils/system/git-commands.js";

/**
 * Handle the completion command action
 */
export async function completion(opts: {
	setup?: boolean;
	cleanup?: boolean;
}): Promise<void> {
	const { spawnSync } = await import("node:child_process");
	const nodeExec = process.argv[0] || process.execPath;
	const scriptPath = process.argv[1] || "";

	if (opts.setup) {
		spawnSync(nodeExec, [scriptPath, "--setup-completion"], {
			stdio: "inherit",
		});
	} else if (opts.cleanup) {
		spawnSync(nodeExec, [scriptPath, "--cleanup-completion"], {
			stdio: "inherit",
		});
	} else {
		console.log("Usage:");
		console.log("  twig completion --setup    Install shell completion");
		console.log("  twig completion --cleanup  Remove shell completion");
	}
}

export function setupCompletion(program: Command): void {
	const complete = omelette("twig <command> [option]");

	if (process.argv.includes("--setup-completion")) {
		if (isCompletionInstalled()) {
			process.stdout.write("\n✓ Shell completion is already installed!\n\n");
			process.stdout.write(
				"To remove and reinstall, run: twig completion --cleanup\n\n",
			);
			process.exit(0);
		}

		// Install the shell wrapper function before omelette's setup
		// (setupShellInitFile exits the process)
		try {
			const initFile = getShellInitFile();
			installShellFunction(initFile);
		} catch {
			// Non-fatal: completion still works without the shell function
			process.stdout.write(
				"Note: Could not install shell integration (cd after branch).\n",
			);
		}

		process.stdout.write(
			"\n✓ Shell completion and shell integration installed!\n\n",
		);
		process.stdout.write("To activate it in your current terminal, run:\n\n");
		if (process.env.SHELL?.includes("zsh")) {
			process.stdout.write("  source ~/.zshrc\n\n");
		} else {
			process.stdout.write("  source ~/.bashrc\n\n");
		}
		process.stdout.write("Or simply restart your terminal.\n\n");
		complete.setupShellInitFile();
		return;
	}

	if (process.argv.includes("--cleanup-completion")) {
		try {
			const initFile = getShellInitFile();
			removeShellFunction(initFile);
		} catch {
			// Non-fatal
		}

		process.stdout.write("\n✓ Shell completion and integration removed!\n\n");
		process.stdout.write("Restart your terminal to complete the removal.\n\n");
		complete.cleanupShellInitFile();
		return;
	}

	const commands = extractCommandNames(program);
	const commandMap = buildAliasMap(program);

	complete.on("command", ({ reply }) => {
		reply(commands);
	});

	complete.on("option", ({ reply, line }) => {
		try {
			const completionLine = line || "";
			const words = completionLine.toString().trim().split(/\s+/);
			const command = words[1] || "";
			const actualCommand = commandMap[command] || command;

			if (actualCommand === "branch") {
				const stdout = execGitSync(["branch", "--format=%(refname:short)"]);
				const branches = stdout
					.split("\n")
					.map((b) => b.trim())
					.filter(Boolean);
				reply(branches);
			} else if (actualCommand === "delete") {
				const worktrees = parseWorktreesSync();
				const branches = worktrees
					.filter((wt) => wt.branch !== undefined)
					.map((wt) => wt.branch as string);
				reply(branches);
			} else if (actualCommand === "config") {
				reply(["set", "get", "list", "path"]);
			} else {
				reply([]);
			}
		} catch {
			reply([]);
		}
	});

	complete.init();
}
