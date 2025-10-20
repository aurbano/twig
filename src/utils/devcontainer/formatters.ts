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
