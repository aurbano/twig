import path from "node:path";
import { execa } from "execa";
import { mkdir, readFile, writeFile } from "../system/fs-operations.js";
import { execGit } from "../system/git-commands.js";
import { repoRoot } from "./repoRoot.js";

/**
 * Installs the post-checkout git hook to automatically prune orphaned worktrees.
 * The hook will be created if it doesn't exist, or updated if it doesn't contain the prune command.
 * @returns True if the hook was installed/updated, false if it was already present
 */
export async function installPruneHook(): Promise<boolean> {
	const root = await repoRoot();
	const gitDir = await execGit(["rev-parse", "--git-dir"]);
	const hooksDir = path.resolve(root, gitDir, "hooks");
	const hookPath = path.join(hooksDir, "post-checkout");

	// Ensure hooks directory exists
	await mkdir(hooksDir);

	const hookContent = `#!/bin/sh
# Auto-installed by twig: prune orphaned worktrees
twig prune --yes 2>/dev/null || true
`;

	try {
		const existingContent = await readFile(hookPath);

		// Check if our hook is already present
		if (existingContent.includes("twig prune")) {
			return false; // Already installed
		}

		// Append to existing hook
		await writeFile(hookPath, `${existingContent}\n${hookContent}`);
		console.log("Updated existing post-checkout hook to include twig prune.");
	} catch {
		// File doesn't exist, create it
		await writeFile(hookPath, hookContent);
		// Make executable
		await execa("chmod", ["755", hookPath]);
		console.log(
			"Installed post-checkout hook to automatically prune orphaned worktrees.",
		);
	}

	return true;
}
