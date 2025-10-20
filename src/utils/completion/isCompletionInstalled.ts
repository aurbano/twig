import { readFileSync } from "node:fs";
import omelette from "omelette";

/**
 * Check if completion is already installed in the shell init file
 * Uses omelette's own methods to determine the init file path
 */
export function isCompletionInstalled(programName = "twig"): boolean {
	try {
		// Create a temporary omelette instance to access its methods
		// biome-ignore lint/suspicious/noExplicitAny: omelette doesn't have TypeScript definitions for these internal methods
		const tempComplete = omelette(`${programName} <command>`) as any;

		// Use omelette's method to get the init file path
		const initFile = tempComplete.getDefaultShellInitFile() as string;

		// Read the init file and check for the completion marker that omelette adds
		const content = readFileSync(initFile, "utf8");
		// Look for the marker comment that omelette uses in its completion block
		return content.includes(`# begin ${programName} completion`);
	} catch {
		// If we can't read the file or detect the shell, assume it's not installed
		return false;
	}
}
