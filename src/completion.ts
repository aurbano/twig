import { execaCommand } from "execa";
import omelette from "omelette";

export function setupCompletion(): void {
	const complete = omelette("twig <command> [option]");

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

	// Initialize completion
	complete.init();

	// Handle setup/install command
	if (process.argv.includes("--setup-completion")) {
		complete.setupShellInitFile();
		console.log("\n✓ Shell completion installed successfully!\n");
		console.log("To activate it in your current terminal, run:\n");
		if (process.env.SHELL?.includes("zsh")) {
			console.log("  source ~/.zshrc\n");
		} else {
			console.log("  source ~/.bashrc\n");
		}
		console.log("Or simply restart your terminal.\n");
		process.exit(0);
	}

	// Handle cleanup command
	if (process.argv.includes("--cleanup-completion")) {
		complete.cleanupShellInitFile();
		console.log("\n✓ Shell completion removed! Restart your terminal.\n");
		process.exit(0);
	}
}
