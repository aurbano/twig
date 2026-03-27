import omelette from "omelette";

export function getShellInitFile(programName = "twig"): string {
	// biome-ignore lint/suspicious/noExplicitAny: omelette lacks types for internal methods
	const tempComplete = omelette(`${programName} <command>`) as any;
	return tempComplete.getDefaultShellInitFile() as string;
}
