import fs from "node:fs/promises";

/**
 * Check if a file or directory exists
 */
export async function fileExists(path: string): Promise<boolean> {
	try {
		await fs.stat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Write content to a file
 */
export async function writeFile(path: string, content: string): Promise<void> {
	await fs.writeFile(path, content);
}

/**
 * Read file content
 */
export async function readFile(path: string): Promise<string> {
	return fs.readFile(path, "utf-8");
}

/**
 * Create a directory recursively
 */
export async function mkdir(path: string): Promise<void> {
	await fs.mkdir(path, { recursive: true });
}

/**
 * Copy files with filtering
 */
export async function copyFilesWithFilter(
	source: string,
	dest: string,
	filter: (src: string, dest: string) => boolean,
): Promise<void> {
	await fs.cp(source, dest, {
		recursive: true,
		filter,
	});
}
