#!/usr/bin/env node
import { Command } from "commander";
import { setupCompletion } from "./completion.js";
import { devcontainerUp, initDevcontainer } from "./devcontainer.js";
import { openInEditor } from "./editor.js";
import {
	deleteWorktree,
	installPruneHook,
	listWorktrees,
	openWorktree,
	pruneOrphanedWorktrees,
} from "./git.js";

const program = new Command();
program
	.name("twig")
	.description("Git worktree manager with optional Dev Container integration")
	.version("1.0.0");

program
	.command("branch")
	.alias("b")
	.argument("<branchOrPath>", "branch name or worktree path")
	.option(
		"--base <base>",
		"base branch for new worktrees (auto-detects main or master if not specified)",
	)
	.option(
		"-d, --dir <dir>",
		"target directory for new worktrees (default ../<repo>-<branch>)",
	)
	.option("--in-container", "bring up devcontainer then open")
	.option("-y, --yes", "assume yes to prompts")
	.action(async (target, opts) => {
		// Install the prune hook if not already present
		await installPruneHook();
		const dir = await openWorktree(target, opts);
		if (opts.inContainer) await devcontainerUp(dir);
		await openInEditor(dir);
	});

program
	.command("list")
	.alias("ls")
	.action(async () => {
		await listWorktrees();
	});

program
	.command("delete")
	.alias("d")
	.argument("<branchOrPath>")
	.option("--keep-branch", "do not delete the git branch")
	.option("-y, --yes", "assume yes to prompts")
	.action(async (target, opts) => {
		await deleteWorktree(target, opts);
	});

program
	.command("prune")
	.alias("p")
	.description("remove worktrees for branches that no longer exist")
	.option("-y, --yes", "assume yes to prompts")
	.action(async (opts) => {
		await pruneOrphanedWorktrees(opts);
	});

program
	.command("init-devcontainer")
	.alias("i")
	.option(
		"--image <img>",
		"base image",
		"mcr.microsoft.com/devcontainers/base:ubuntu",
	)
	.option("--packages <list>", "space-separated apt packages")
	.option("--ports <csv>", "e.g. 3000,8000")
	.option("--postcreate <cmd>", "postCreateCommand")
	.option("--mount-node-modules", "add node_modules named volume mount")
	.action(async (opts) => {
		await initDevcontainer(opts);
	});

// Add completion command
program
	.command("completion")
	.description("setup or remove shell completion")
	.option("--setup", "install shell completion")
	.option("--cleanup", "remove shell completion")
	.action(async (opts) => {
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
	});

// Setup shell completion after all commands are registered
setupCompletion(program);

program.parseAsync().catch((err) => {
	console.error(err?.stderr || err?.message || err);
	process.exit(1);
});
