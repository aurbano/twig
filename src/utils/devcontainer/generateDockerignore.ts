/**
 * Generate .dockerignore content
 */
export function generateDockerignoreContent(): string {
	return `.git
.gitignore
node_modules
**/__pycache__
**/*.pyc
.DS_Store
`;
}
