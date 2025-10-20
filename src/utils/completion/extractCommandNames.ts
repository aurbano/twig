import type { Command } from "commander";

/**
 * Extract command names from a Commander program
 */
export function extractCommandNames(program: Command): string[] {
	return program.commands.map((cmd) => cmd.name());
}
