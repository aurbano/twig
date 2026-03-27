import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getGlobalConfigDir } from "./config.js";

/**
 * Uses the parent process PID so concurrent terminals don't clobber
 * each other's last-dir file. The shell function reads the matching
 * file via `last-dir-$$`.
 */
export function getLastDirPath(): string {
	return join(getGlobalConfigDir(), `last-dir-${process.ppid}`);
}

export function writeLastDir(dir: string): void {
	const twigDir = getGlobalConfigDir();
	mkdirSync(twigDir, { recursive: true });
	writeFileSync(getLastDirPath(), dir, "utf-8");
}
