// biome-ignore lint/suspicious/noExplicitAny: error message can be any type
export function extractErrorMessage(err: any): string {
	return err?.stderr || err?.message || String(err);
}
