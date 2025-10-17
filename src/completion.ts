import { execaCommand } from "execa";
import omelette from "omelette";

export function setupCompletion(): void {
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

	// Setup completion handlers
	complete.on("command", ({ reply }) => {
		reply([
			"branch",
			"b",
			"list",
			"ls",
			"delete",
			"d",
			"prune",
			"p",
			"init-devcontainer",
			"i",
		]);
	});

	complete.on("option", async ({ reply }) => {
		// Get the command from the line
		const line = process.env.COMP_LINE || process.env.COMP_WORDS || "";
		const words = line.split(" ");
		const command = words[1] || "";

		// Map aliases to full commands
		const commandMap: Record<string, string> = {
			b: "branch",
			ls: "list",
			d: "delete",
			p: "prune",
			i: "init-devcontainer",
		};
		const actualCommand = commandMap[command] || command;

		if (actualCommand === "branch") {
			// For branch command, suggest git branches
			try {
				const { stdout } = await execaCommand(
					"git branch --format='%(refname:short)' 2>/dev/null",
				);
				const branches = stdout.split("\n").filter(Boolean);
				reply(branches);
			} catch {
				reply([]);
			}
		} else if (actualCommand === "delete") {
			// For delete command, suggest only branches with worktrees
			try {
				const { stdout } = await execaCommand(
					"git worktree list --porcelain 2>/dev/null",
				);
				// Parse worktree list to get branches
				const branches: string[] = [];
				const lines = stdout.split("\n");
				for (const line of lines) {
					if (line.startsWith("branch ")) {
						// Extract branch name from "branch refs/heads/branch-name"
						const branch = line.replace("branch refs/heads/", "").trim();
						if (branch) {
							branches.push(branch);
						}
					}
				}
				reply(branches);
			} catch {
				reply([]);
			}
		} else {
			reply([]);
		}
	});

	// Initialize completion for normal operation
	complete.init();
}
