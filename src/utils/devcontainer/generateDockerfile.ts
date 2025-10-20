import { formatPackageList } from "./formatters.js";

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
