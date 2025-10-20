/**
 * Input validation utilities for user-provided values.
 */

/**
 * Validates a git branch name according to git-check-ref-format rules.
 * @param name - The branch name to validate
 * @throws Error if the branch name is invalid
 */
export function validateBranchName(name: string): void {
	if (!name || name.trim().length === 0) {
		throw new Error("Branch name cannot be empty");
	}

	// Git branch name restrictions (simplified but covers most common issues)
	const invalid = [
		{ pattern: /^\./, message: "cannot start with a dot" },
		{ pattern: /\.\.|@\{|\\/, message: "cannot contain .., @{, or \\" },
		{ pattern: /[\s~^:?*[\]]/, message: "cannot contain spaces or ~^:?*[]" },
		{ pattern: /\/$/, message: "cannot end with /" },
		{ pattern: /\.lock$/, message: "cannot end with .lock" },
		{ pattern: /^\/|\/\//, message: "cannot start with / or contain //" },
	];

	for (const { pattern, message } of invalid) {
		if (pattern.test(name)) {
			throw new Error(`Invalid branch name '${name}': ${message}`);
		}
	}
}

/**
 * Validates a comma-separated list of port numbers.
 * @param ports - Comma-separated port numbers (e.g., "3000,8080")
 * @throws Error if any port is invalid
 */
export function validatePortList(ports: string): void {
	if (!ports || ports.trim().length === 0) {
		return; // Empty is ok
	}

	const portArray = ports.split(",").map((p) => p.trim());
	for (const port of portArray) {
		const num = Number.parseInt(port, 10);
		if (Number.isNaN(num) || num < 1 || num > 65535) {
			throw new Error(
				`Invalid port '${port}': must be a number between 1 and 65535`,
			);
		}
	}
}

/**
 * Validates a Docker image name format.
 * @param image - Docker image name (e.g., "ubuntu:20.04" or "mcr.microsoft.com/base:latest")
 * @throws Error if the image name is invalid
 */
export function validateDockerImage(image: string): void {
	if (!image || image.trim().length === 0) {
		throw new Error("Docker image name cannot be empty");
	}

	// Basic validation: no whitespace, reasonable characters
	if (/\s/.test(image)) {
		throw new Error(
			`Invalid Docker image '${image}': cannot contain whitespace`,
		);
	}

	// Image names must be lowercase (except for registry domain)
	const parts = image.split("/");
	const imagePart = parts[parts.length - 1];
	if (imagePart && /[A-Z]/.test(imagePart.split(":")[0] || "")) {
		throw new Error(
			`Invalid Docker image '${image}': image name must be lowercase`,
		);
	}
}

/**
 * Validates package names for apt/system package managers.
 * @param packages - Space-separated package names
 * @throws Error if any package name is suspicious
 */
export function validatePackageNames(packages: string): void {
	if (!packages || packages.trim().length === 0) {
		return; // Empty is ok
	}

	const pkgArray = packages.split(/\s+/);
	for (const pkg of pkgArray) {
		// Check for shell injection attempts
		if (/[;&|`$()]/.test(pkg)) {
			throw new Error(
				`Invalid package name '${pkg}': contains shell metacharacters`,
			);
		}
		// Package names should be alphanumeric with -, +, . only
		if (!/^[a-zA-Z0-9.+-]+$/.test(pkg)) {
			throw new Error(
				`Invalid package name '${pkg}': must contain only alphanumeric characters, dots, hyphens, and plus signs`,
			);
		}
	}
}
