import path from "node:path";
import { generateDevcontainerJson } from "./utils/devcontainer/generateDevcontainerJson.js";
import { generateDockerfileContent } from "./utils/devcontainer/generateDockerfile.js";
import { generateDockerignoreContent } from "./utils/devcontainer/generateDockerignore.js";
import { repoRoot } from "./utils/git/repoRoot.js";
import { fileExists, mkdir, writeFile } from "./utils/system/fs-operations.js";
import {
	validateDockerImage,
	validatePackageNames,
	validatePortList,
} from "./utils/validation.js";

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
