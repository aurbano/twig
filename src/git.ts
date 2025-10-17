import fs from "node:fs/promises";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { execa } from "execa";
import { validateBranchName } from "./validation.js";

/**
 * Gets the root directory of the current git repository.
 * @returns Absolute path to the repository root
 */
export async function repoRoot(): Promise<string> {
	const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"]);
	return stdout.trim();
}

/**
 * Gets the name of the current git repository (basename of root directory).
 * @returns Repository name
 */
export async function repoName(): Promise<string> {
	return path.basename(await repoRoot());
}

/**
 * Detects the default branch by trying 'main' first, then 'master'.
 * Checks both local and remote branches.
 * @returns The detected default branch name ('main' or 'master')
 * @throws Error if neither 'main' nor 'master' exists locally or on origin
 */
export async function detectDefaultBranch(): Promise<string> {
	const candidates = ["main", "master"];

	for (const branch of candidates) {
		// Check if branch exists locally
		const localExists =
			(
				await execa(
					"git",
					["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
					{ reject: false },
				)
			).exitCode === 0;

		if (localExists) {
			return branch;
		}

		// Check if branch exists on origin
		const remoteExists =
			(
				await execa(
					"git",
					["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`],
					{ reject: false },
				)
			).exitCode === 0;

		if (remoteExists) {
			return branch;
		}
	}

	throw new Error(
		"Could not detect default branch. Neither 'main' nor 'master' exists locally or on origin. Please specify a base branch with --base.",
	);
}

/**
 * Ensures the base branch is up to date by fetching and fast-forward merging.
 * Checks for clean working directory and repo state before making changes.
 * @param base - The base branch name to update
 */
export async function ensureBaseUpToDate(base: string) {
	// Check for clean working directory
	const statusResult = await execa("git", ["status", "--porcelain"], {
		reject: false,
	});
	if (statusResult.stdout.trim().length > 0) {
		throw new Error(
			"Working directory has uncommitted changes. Please commit or stash them before creating a worktree.",
		);
	}

	// Check if we're in the middle of a rebase/merge/cherry-pick
	const gitDir = (await execa("git", ["rev-parse", "--git-dir"])).stdout.trim();
	try {
		await fs.access(`${gitDir}/rebase-merge`);
		throw new Error(
			"Repository is in the middle of a rebase. Please complete or abort it first.",
		);
	} catch {}
	try {
		await fs.access(`${gitDir}/MERGE_HEAD`);
		throw new Error(
			"Repository is in the middle of a merge. Please complete or abort it first.",
		);
	} catch {}
	try {
		await fs.access(`${gitDir}/CHERRY_PICK_HEAD`);
		throw new Error(
			"Repository is in the middle of a cherry-pick. Please complete or abort it first.",
		);
	} catch {}

	// Verify origin remote exists
	const remotes = await execa("git", ["remote"], { reject: false });
	if (!remotes.stdout.includes("origin")) {
		throw new Error(
			"No 'origin' remote found. Please add a remote named 'origin' or manually fetch and create the base branch.",
		);
	}

	// Fetch updates
	try {
		await execa("git", ["fetch", "origin", "--prune"]);
	} catch (err) {
		throw new Error(
			`Failed to fetch from origin: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	const haveLocal =
		(
			await execa(
				"git",
				["show-ref", "--verify", "--quiet", `refs/heads/${base}`],
				{ reject: false },
			)
		).exitCode === 0;

	if (haveLocal) {
		await execa("git", ["checkout", base]);
		const pullResult = await execa(
			"git",
			["pull", "--ff-only", "origin", base],
			{ reject: false },
		);
		if (pullResult.exitCode !== 0) {
			throw new Error(
				`Failed to fast-forward ${base}. You may need to manually resolve conflicts.`,
			);
		}
	} else {
		// Check if remote branch exists
		const remoteExists =
			(
				await execa(
					"git",
					["show-ref", "--verify", "--quiet", `refs/remotes/origin/${base}`],
					{ reject: false },
				)
			).exitCode === 0;
		if (!remoteExists) {
			throw new Error(
				`Branch '${base}' does not exist locally or on origin. Please specify a valid base branch.`,
			);
		}
		await execa("git", ["checkout", "-b", base, `origin/${base}`]);
	}
}

/**
 * Generates the default directory path for a worktree.
 * Creates a sibling directory to the repo root named <repo>-<branch>
 * @param branch - The branch name
 * @returns Absolute path to the default worktree directory
 */
export async function defaultDir(branch: string): Promise<string> {
	const root = await repoRoot();
	return path.resolve(path.dirname(root), `${await repoName()}-${branch}`);
}

/**
 * Creates a new git worktree with a new branch.
 * @param branch - Name of the new branch to create
 * @param opts - Options for worktree creation
 * @returns Path to the created worktree directory
 */
export async function createWorktree(
	branch: string,
	opts: { base?: string; dir?: string; yes?: boolean },
) {
	validateBranchName(branch);

	const base = opts.base ?? (await detectDefaultBranch());
	await ensureBaseUpToDate(base);
	const dir = opts.dir ?? (await defaultDir(branch));

	if (
		(
			await execa(
				"git",
				["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
				{ reject: false },
			)
		).exitCode === 0
	) {
		throw new Error(`Branch '${branch}' already exists.`);
	}

	// Check if directory exists (git will also check, but we provide a better error message)
	if (await fs.stat(dir).catch(() => null)) {
		throw new Error(
			`Directory already exists: ${dir}. Choose a different directory with --dir`,
		);
	}

	const proceed =
		opts.yes ||
		(await confirm({
			message: `Create worktree ${dir} from ${base} as ${branch}?`,
			default: false,
		}));
	if (!proceed) throw new Error("Aborted.");

	await execa("git", ["worktree", "add", "-b", branch, dir, base]);
	console.log(`Created worktree at ${dir}`);
	return dir;
}

/**
 * Parses the output of `git worktree list --porcelain` into structured data.
 * Note: This relies on the porcelain format which should be stable across git versions.
 * @returns Array of worktree information objects
 */
export async function parseWorktrees(): Promise<
	Array<{ path: string; branch?: string; head?: string }>
> {
	const { stdout } = await execa("git", ["worktree", "list", "--porcelain"]);
	const lines = stdout.split("\n");
	const items: Array<{ path: string; branch?: string; head?: string }> = [];
	let cur: { path?: string; branch?: string; head?: string } = {};
	for (const line of lines) {
		if (!line.trim()) continue;
		if (line.startsWith("worktree ")) {
			if (cur.path)
				items.push(cur as { path: string; branch?: string; head?: string });
			cur = { path: line.slice("worktree ".length).trim() };
		} else if (line.startsWith("branch ")) {
			cur.branch = line
				.slice("branch ".length)
				.trim()
				.replace(/^refs\/heads\//, "");
		} else if (line.startsWith("HEAD ")) {
			cur.head = line.slice("HEAD ".length).trim();
		}
		// Ignore unknown fields for forward compatibility
	}
	if (cur.path && cur.path.length > 0)
		items.push(cur as { path: string; branch?: string; head?: string });
	return items;
}

/**
 * Lists all git worktrees in a formatted table.
 */
export async function listWorktrees() {
	const items = await parseWorktrees();
	const pad = (s: string, n: number) => s.padEnd(n, " ");
	console.log(`${pad("PATH", 50)}  ${pad("BRANCH", 20)}  HEAD`);
	console.log(`${"-".repeat(50)}  ${"-".repeat(20)}  ${"-".repeat(7)}`);
	for (const it of items) {
		console.log(
			`${pad(it.path, 50)}  ${pad(it.branch ?? "<detached>", 20)}  ${it.head ?? ""}`,
		);
	}
}

/**
 * Resolves a worktree target (path or branch name) to an absolute directory path.
 * Returns null if not found.
 * @param target - Either a directory path or a branch name
 * @returns Absolute path to the worktree directory, or null if not found
 */
export async function resolveWorktreePath(
	target: string,
): Promise<string | null> {
	// if path exists, use it
	try {
		const st = await fs.stat(target);
		if (st.isDirectory()) return path.resolve(target);
	} catch {}
	// else find by branch
	const items = await parseWorktrees();
	const hit = items.find((i) => i.branch === target);
	return hit?.path ?? null;
}

/**
 * Opens a worktree by path or branch name. If the worktree doesn't exist,
 * creates it as a new branch from the base branch.
 * @param target - Either a directory path, existing branch name, or new branch name
 * @param opts - Options for worktree creation if needed
 * @returns Absolute path to the worktree directory
 */
export async function openWorktree(
	target: string,
	opts: { base?: string; dir?: string; yes?: boolean } = {},
) {
	// Try to resolve existing worktree
	const existing = await resolveWorktreePath(target);
	if (existing) {
		return existing;
	}

	// Worktree doesn't exist, create it as a new branch
	console.log(
		`Worktree not found. Creating new worktree for branch: ${target}`,
	);
	return await createWorktree(target, opts);
}

/**
 * Deletes a git worktree and optionally its associated branch.
 * @param target - Either a directory path or a branch name
 * @param opts - Options for deletion
 */
export async function deleteWorktree(
	target: string,
	opts: { keepBranch?: boolean; yes?: boolean },
) {
	const dir = await resolveWorktreePath(target);
	if (!dir) {
		throw new Error(
			`No worktree found for '${target}'. Use 'twig list' to see available worktrees.`,
		);
	}
	const items = await parseWorktrees();
	const it = items.find((i) => i.path === dir);
	const proceed =
		opts.yes ||
		(await confirm({
			message: `Delete worktree ${dir}${opts.keepBranch ? "" : ` and branch ${it?.branch ?? ""}`}?`,
			default: false,
		}));
	if (!proceed) throw new Error("Aborted.");

	await execa("git", ["worktree", "remove", "--force", dir]);
	if (!opts.keepBranch && it?.branch) {
		const exist =
			(
				await execa(
					"git",
					["show-ref", "--verify", "--quiet", `refs/heads/${it.branch}`],
					{ reject: false },
				)
			).exitCode === 0;
		if (exist)
			await execa("git", ["branch", "-D", it.branch], { reject: false });
	}
	console.log(`Removed worktree${opts.keepBranch ? "" : " and branch"}.`);
}
