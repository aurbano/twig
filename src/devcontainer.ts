import path from "node:path";
import { fileExists, mkdir, writeFile } from "./commands/fs-operations.js";
import { execDevcontainerUp } from "./commands/process-operations.js";
import { repoRoot } from "./git.js";
import {
	validateDockerImage,
	validatePackageNames,
	validatePortList,
} from "./validation.js";

/**
 * Format package list for Dockerfile with proper backslashes
 */
export function formatPackageList(packages: string): string {
	const pkgList = packages.split(/\s+/);
	return pkgList
		.map((p, i) => `    ${p}${i < pkgList.length - 1 ? " \\" : ""}`)
		.join("\n");
}

/**
 * Format ports for devcontainer.json
 */
export function formatPorts(ports: string): string {
	if (!ports || ports.length === 0) return "[]";
	return `[${ports
		.split(",")
		.map((p) => `"${p.trim()}"`)
		.join(",")}]`;
}

/**
 * Format mounts for devcontainer.json
 */
export function formatMounts(mountNodeModules: boolean): string {
	return mountNodeModules
		? `["source=\${localWorkspaceFolderBasename}-node_modules,target=/work/node_modules,type=volume"]`
		: "[]";
}

/**
 * Format postCreateCommand for devcontainer.json
 */
export function formatPostCreateCommand(postcreate: string): string {
	return postcreate && postcreate.length > 0
		? JSON.stringify(postcreate)
		: "null";
}

/**
 * Generate Dockerfile content
 */
export function generateDockerfileContent(
	image: string,
	packages: string,
): string {
	let content = `FROM ${image}\nSHELL ["/bin/bash","-lc"]\n`;
	if (packages) {
		const pkgLines = formatPackageList(packages);
		content += `
RUN export DEBIAN_FRONTEND=noninteractive && \\
    apt-get update && \\
    apt-get install -y --no-install-recommends \\
${pkgLines} \\
    && apt-get clean && rm -rf /var/lib/apt/lists/*\n`;
	}
	return content;
}

/**
 * Generate devcontainer.json content
 */
export function generateDevcontainerJson(opts: {
	ports: string;
	mountNodeModules: boolean;
	postcreate: string;
}): string {
	const forwardPorts = formatPorts(opts.ports);
	const mounts = formatMounts(opts.mountNodeModules);
	const postCreateCommand = formatPostCreateCommand(opts.postcreate);

	return `{
  "name": "repo-\${localWorkspaceFolderBasename}",
  "build": { "dockerfile": "Dockerfile" },
  "workspaceFolder": "/work",
  "workspaceMount": "source=\${localWorkspaceFolder},target=/work,type=bind,consistency=cached",
  "runArgs": ["--name","dev-\${localWorkspaceFolderBasename}"],
  "forwardPorts": ${forwardPorts},
  "mounts": ${mounts},
  "postCreateCommand": ${postCreateCommand},
  "customizations": { "vscode": { "settings": { "terminal.integrated.defaultProfile.linux": "bash" }, "extensions": [] } }
}
`;
}

/**
 * Generate .dockerignore content
 */
export function generateDockerignoreContent(): string {
	return `.git
.gitignore
node_modules
**/__pycache__
**/*.pyc
.DS_Store
`;
}

/**
 * Brings up a dev container in the specified directory.
 * Requires the Dev Container CLI to be installed.
 * @param dir - The workspace directory containing .devcontainer/
 */
export async function devcontainerUp(dir: string) {
	try {
		await execDevcontainerUp(dir);
	} catch (err: unknown) {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			err.code === "ENOENT"
		) {
			console.log(
				"Dev Container CLI not found. Install from: https://github.com/devcontainers/cli",
			);
		} else {
			throw new Error(
				`Dev Container failed to start: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}

/**
 * Initializes a dev container configuration in the repository.
 * Creates .devcontainer/Dockerfile, devcontainer.json, and .dockerignore
 * @param opts - Configuration options for the dev container
 */
export async function initDevcontainer(opts: {
	image?: string;
	packages?: string;
	ports?: string;
	postcreate?: string;
	mountNodeModules?: boolean;
}) {
	const root = await repoRoot();
	const devDir = path.join(root, ".devcontainer");
	await mkdir(devDir);

	const dockerfile = path.join(devDir, "Dockerfile");
	const devjson = path.join(devDir, "devcontainer.json");
	const dockerignore = path.join(devDir, ".dockerignore");

	const image = opts.image ?? "mcr.microsoft.com/devcontainers/base:ubuntu";
	const packages = (opts.packages ?? "").trim();
	const ports = (opts.ports ?? "").trim();
	const pcc = (opts.postcreate ?? "").trim();

	// Validate inputs
	validateDockerImage(image);
	if (packages) validatePackageNames(packages);
	if (ports) validatePortList(ports);

	if (!(await fileExists(dockerfile))) {
		const content = generateDockerfileContent(image, packages);
		await writeFile(dockerfile, content);
		console.log(`Wrote ${path.relative(root, dockerfile)}`);
	}

	if (!(await fileExists(devjson))) {
		const json = generateDevcontainerJson({
			ports,
			mountNodeModules: opts.mountNodeModules ?? false,
			postcreate: pcc,
		});
		await writeFile(devjson, json);
		console.log(`Wrote ${path.relative(root, devjson)}`);
	}

	if (!(await fileExists(dockerignore))) {
		await writeFile(dockerignore, generateDockerignoreContent());
		console.log(`Wrote ${path.relative(root, dockerignore)}`);
	}

	console.log(
		"Dev container scaffold complete. Commit .devcontainer/ to share across worktrees.",
	);
}
