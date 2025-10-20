import {
	formatMounts,
	formatPorts,
	formatPostCreateCommand,
} from "./formatters.js";

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
