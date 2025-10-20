#!/usr/bin/env node
import { Command } from "commander";
import { branch } from "./branch.js";
import { completion, setupCompletion } from "./completion.js";
import { deleteWorktree } from "./delete.js";
import { initDevcontainer } from "./init-devcontainer.js";
import { list } from "./list.js";
import { prune } from "./prune.js";
import { devcontainerUp } from "./utils/devcontainer/devcontainerUp.js";
import { openInEditor } from "./utils/editor.js";
import { extractErrorMessage } from "./utils/extractErrorMessage.js";
import { installPruneHook } from "./utils/git/installPruneHook.js";

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
		await installPruneHook();
		const dir = await branch(target, opts);
		if (opts.inContainer) await devcontainerUp(dir);
		await openInEditor(dir);
	});

program
	.command("list")
	.alias("ls")
	.action(async () => {
		await list();
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
		await prune(opts);
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

program
	.command("completion")
	.description("setup or remove shell completion")
	.option("--setup", "install shell completion")
	.option("--cleanup", "remove shell completion")
	.action(async (opts) => {
		await completion(opts);
	});

// Setup shell completion after all commands are registered
setupCompletion(program);

program.parseAsync().catch((err) => {
	console.error(extractErrorMessage(err));
	process.exit(1);
});
