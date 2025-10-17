import { execa } from "execa";

/**
 * Opens a directory in an editor (Cursor or VS Code).
 * Tries Cursor first, then VS Code, then prints instructions for manual opening.
 * @param dir - The directory to open
 */
export async function openInEditor(dir: string) {
	const tryRun = async (cmd: string) =>
		(await execa(cmd, ["."], { cwd: dir, reject: false, stdio: "ignore" }))
			.exitCode === 0;
	if (await tryRun("cursor")) {
		console.log(`Opened in Cursor: ${dir}`);
		return;
	}
	if (await tryRun("code")) {
		console.log(`Cursor not found; opened in VS Code: ${dir}`);
		return;
	}
	console.log(`Open manually: ${dir} (no 'cursor' or 'code' on PATH)`);
}
