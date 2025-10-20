import { execDevcontainerUp } from "../system/process-operations.js";

/**
 * Brings up a dev container in the specified directory.
 * Requires the Dev Container CLI to be installed.
 * @param dir - The workspace directory containing .devcontainer/
 */
export async function devcontainerUp(dir: string) {
	try {
		await execDevcontainerUp(dir);
	} catch (err: unknown) {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			err.code === "ENOENT"
		) {
			console.log(
				"Dev Container CLI not found. Install from: https://github.com/devcontainers/cli",
			);
		} else {
			throw new Error(
				`Dev Container failed to start: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
