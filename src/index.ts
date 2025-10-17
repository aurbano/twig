#!/usr/bin/env node
import { Command } from "commander";
import { devcontainerUp, initDevcontainer } from "./devcontainer.js";
import { openInEditor } from "./editor.js";
import { deleteWorktree, listWorktrees, openWorktree } from "./git.js";

const program = new Command();
program
	.name("twig")
	.description("Git worktree manager with optional Dev Container integration")
	.version("0.1.0");

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

program.parseAsync().catch((err) => {
	console.error(err?.stderr || err?.message || err);
	process.exit(1);
});
