import { readFileSync, writeFileSync } from "node:fs";

const BEGIN_MARKER = "# begin twig shell integration";
const END_MARKER = "# end twig shell integration";

const SHELL_FUNCTION = `
${BEGIN_MARKER}
twig() {
  command twig "$@"
  local exit_code=$?
  local last_dir="$HOME/.twig/last-dir-$$"
  if [ -f "$last_dir" ]; then
    local dir
    dir=$(cat "$last_dir")
    rm -f "$last_dir"
    if [ -d "$dir" ]; then
      cd "$dir" || true
    fi
  fi
  return $exit_code
}
${END_MARKER}
`;

export function isShellFunctionInstalled(initFilePath: string): boolean {
	try {
		const content = readFileSync(initFilePath, "utf-8");
		return content.includes(BEGIN_MARKER);
	} catch {
		return false;
	}
}

export function installShellFunction(initFilePath: string): void {
	if (isShellFunctionInstalled(initFilePath)) return;

	const content = readFileSync(initFilePath, "utf-8");
	writeFileSync(initFilePath, content + SHELL_FUNCTION, "utf-8");
}

export function removeShellFunction(initFilePath: string): void {
	try {
		const content = readFileSync(initFilePath, "utf-8");
		const beginIdx = content.indexOf(`\n${BEGIN_MARKER}`);
		const endIdx = content.indexOf(`${END_MARKER}\n`);

		if (beginIdx === -1 || endIdx === -1) return;

		const before = content.slice(0, beginIdx);
		const after = content.slice(endIdx + END_MARKER.length + 1);
		writeFileSync(initFilePath, before + after, "utf-8");
	} catch {
		// File doesn't exist or can't be read — nothing to remove
	}
}
