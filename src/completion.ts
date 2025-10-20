import type { Command } from "commander";
import omelette from "omelette";
import { buildAliasMap } from "./utils/completion/buildAliasMap.js";
import { extractCommandNames } from "./utils/completion/extractCommandNames.js";
import { isCompletionInstalled } from "./utils/completion/isCompletionInstalled.js";
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
		// Re-run with setup flag
		spawnSync(nodeExec, [scriptPath, "--setup-completion"], {
			stdio: "inherit",
		});
	} else if (opts.cleanup) {
		// Re-run with cleanup flag
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

	// Check for setup/cleanup flags first, before any other logic
	if (process.argv.includes("--setup-completion")) {
		// Check if completion is already installed
		if (isCompletionInstalled()) {
			process.stdout.write("\n✓ Shell completion is already installed!\n\n");
			process.stdout.write(
				"To remove and reinstall, run: twig completion --cleanup\n\n",
			);
			process.exit(0);
		}

		// Print message before calling setupShellInitFile (which exits the process)
		process.stdout.write("\n✓ Shell completion installed successfully!\n\n");
		process.stdout.write("To activate it in your current terminal, run:\n\n");
		if (process.env.SHELL?.includes("zsh")) {
			process.stdout.write("  source ~/.zshrc\n\n");
		} else {
			process.stdout.write("  source ~/.bashrc\n\n");
		}
		process.stdout.write("Or simply restart your terminal.\n\n");
		// setupShellInitFile() will exit the process
		complete.setupShellInitFile();
		return;
	}

	if (process.argv.includes("--cleanup-completion")) {
		// Print message before calling cleanupShellInitFile (which may exit)
		process.stdout.write("\n✓ Shell completion removed!\n\n");
		process.stdout.write("Restart your terminal to complete the removal.\n\n");
		complete.cleanupShellInitFile();
		return;
	}

	// Dynamically extract commands from the Commander program
	const commands = extractCommandNames(program);

	// Build alias map dynamically
	const commandMap = buildAliasMap(program);

	// Setup completion handlers
	complete.on("command", ({ reply }) => {
		reply(commands);
	});

	complete.on("option", ({ reply, line }) => {
		try {
			// Get the command from the completion line provided by omelette
			const completionLine = line || "";
			const words = completionLine.toString().trim().split(/\s+/);
			const command = words[1] || "";

			// Map aliases to full commands (using the dynamically built map)
			const actualCommand = commandMap[command] || command;

			if (actualCommand === "branch") {
				// For branch command, suggest git branches
				const stdout = execGitSync(["branch", "--format=%(refname:short)"]);
				const branches = stdout
					.split("\n")
					.map((b) => b.trim())
					.filter(Boolean);
				reply(branches);
			} else if (actualCommand === "delete") {
				// For delete command, suggest only branches with worktrees
				// This uses the same logic as `twig ls`
				const worktrees = parseWorktreesSync();
				const branches = worktrees
					.filter((wt) => wt.branch !== undefined)
					.map((wt) => wt.branch as string);
				reply(branches);
			} else {
				reply([]);
			}
		} catch {
			// Silently fail on errors to avoid breaking completion
			reply([]);
		}
	});

	// Initialize completion for normal operation
	complete.init();
}
