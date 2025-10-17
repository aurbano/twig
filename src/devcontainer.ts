import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { repoRoot } from "./git.js";
import {
	validateDockerImage,
	validatePackageNames,
	validatePortList,
} from "./validation.js";

/**
 * Brings up a dev container in the specified directory.
 * Requires the Dev Container CLI to be installed.
 * @param dir - The workspace directory containing .devcontainer/
 */
export async function devcontainerUp(dir: string) {
	try {
		await execa("devcontainer", ["up", "--workspace-folder", dir], {
			stdio: "inherit",
		});
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
	await fs.mkdir(devDir, { recursive: true });

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

	if (!(await exists(dockerfile))) {
		let content = `FROM ${image}\nSHELL ["/bin/bash","-lc"]\n`;
		if (packages) {
			const pkgList = packages.split(/\s+/);
			const pkgLines = pkgList
				.map((p, i) => `    ${p}${i < pkgList.length - 1 ? " \\" : ""}`)
				.join("\n");
			content += `
RUN export DEBIAN_FRONTEND=noninteractive && \\
    apt-get update && \\
    apt-get install -y --no-install-recommends \\
${pkgLines} \\
    && apt-get clean && rm -rf /var/lib/apt/lists/*\n`;
		}
		await fs.writeFile(dockerfile, content);
		console.log(`Wrote ${path.relative(root, dockerfile)}`);
	}

	if (!(await exists(devjson))) {
		const forwardPorts = ports
			? `[${ports
					.split(",")
					.map((p) => `"${p.trim()}"`)
					.join(",")}]`
			: "[]";
		const mounts = opts.mountNodeModules
			? `["source=\${localWorkspaceFolderBasename}-node_modules,target=/work/node_modules,type=volume"]`
			: "[]";
		const postCreateCommand = pcc ? JSON.stringify(pcc) : "null";

		const json = `{
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
		await fs.writeFile(devjson, json);
		console.log(`Wrote ${path.relative(root, devjson)}`);
	}

	if (!(await exists(dockerignore))) {
		await fs.writeFile(
			dockerignore,
			`.git
.gitignore
node_modules
**/__pycache__
**/*.pyc
.DS_Store
`,
		);
		console.log(`Wrote ${path.relative(root, dockerignore)}`);
	}

	console.log(
		"Dev container scaffold complete. Commit .devcontainer/ to share across worktrees.",
	);
}

async function exists(p: string) {
	try {
		await fs.stat(p);
		return true;
	} catch {
		return false;
	}
}
