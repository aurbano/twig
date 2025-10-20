import type { Command } from "commander";
import omelette from "omelette";
import { execGitCommand } from "./commands/git-commands.js";

/**
 * Extract command names from a Commander program
 */
export function extractCommandNames(program: Command): string[] {
	return program.commands.map((cmd) => cmd.name());
}

/**
 * Build a map of aliases to their full command names
 */
export function buildAliasMap(program: Command): Record<string, string> {
	const commandMap: Record<string, string> = {};
	for (const cmd of program.commands) {
		const name = cmd.name();
		const aliases = cmd.aliases();
		for (const alias of aliases) {
			commandMap[alias] = name;
		}
	}
	return commandMap;
}

/**
 * Parse branch names from git worktree list porcelain output
 */
export function parseBranchesFromWorktreeOutput(stdout: string): string[] {
	const branches: string[] = [];
	const lines = stdout.split("\n");
	for (const line of lines) {
		if (line.startsWith("branch ")) {
			// Extract branch name from "branch refs/heads/branch-name"
			const branch = line.replace(/^branch refs\/heads\//, "").trim();
			if (branch) {
				branches.push(branch);
			}
		}
	}
	return branches;
}

export function setupCompletion(program: Command): void {
	const complete = omelette("twig <command> [option]");

	// Check for setup/cleanup flags first, before any other logic
	if (process.argv.includes("--setup-completion")) {
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

	complete.on("option", async ({ reply }) => {
		// Get the command from the line - check multiple environment variables
		const line =
			process.env.COMP_LINE ||
			process.env.COMP_WORDS ||
			process.env.COMP_POINT ||
			"";
		const words = line.toString().trim().split(/\s+/);
		const command = words[1] || "";

		// Map aliases to full commands (using the dynamically built map)
		const actualCommand = commandMap[command] || command;

		if (actualCommand === "branch") {
			// For branch command, suggest git branches
			const stdout = await execGitCommand(
				"git branch --format='%(refname:short)'",
			);
			const branches = stdout
				.split("\n")
				.map((b) => b.trim())
				.filter(Boolean);
			reply(branches);
		} else if (actualCommand === "delete") {
			// For delete command, suggest only branches with worktrees
			const stdout = await execGitCommand("git worktree list --porcelain");
			const branches = parseBranchesFromWorktreeOutput(stdout);
			reply(branches);
		} else {
			reply([]);
		}
	});

	// Initialize completion for normal operation
	complete.init();
}
