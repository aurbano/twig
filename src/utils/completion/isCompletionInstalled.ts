import { readFileSync } from "node:fs";
import { getShellInitFile } from "./getShellInitFile.js";

export function isCompletionInstalled(programName = "twig"): boolean {
	try {
		const initFile = getShellInitFile(programName);
		const content = readFileSync(initFile, "utf8");
		return content.includes(`# begin ${programName} completion`);
	} catch {
		return false;
	}
}
