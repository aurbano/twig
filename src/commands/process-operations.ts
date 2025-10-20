import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { execa } from "execa";

const execAsync = promisify(exec);

/**
 * Check if a command exists on the system PATH
 */
export async function commandExists(cmd: string): Promise<boolean> {
	try {
		await execAsync(`command -v ${cmd}`);
		return true;
	} catch {
		return false;
	}
}

/**
 * Launch a process in detached mode without waiting
 */
export function spawnDetached(cmd: string, args: string[], cwd: string): void {
	spawn(cmd, args, {
		cwd,
		detached: true,
		stdio: "ignore",
	}).unref();
}

/**
 * Execute devcontainer up command
 */
export async function execDevcontainerUp(dir: string): Promise<void> {
	await execa("devcontainer", ["up", "--workspace-folder", dir], {
		stdio: "inherit",
	});
}
