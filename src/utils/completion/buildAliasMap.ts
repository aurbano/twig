import type { Command } from "commander";

/**
 * Build a map of aliases to their full command names
 */
export function buildAliasMap(program: Command): Record<string, string> {
	const commandMap: Record<string, string> = {};
	for (const cmd of program.commands) {
		const name = cmd.name();
		const aliases = cmd.aliases();
		for (const alias of aliases) {
			commandMap[alias] = name;
		}
	}
	return commandMap;
}
