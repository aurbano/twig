import assert from "node:assert";
import { test } from "node:test";
import { getLastDirPath } from "./lastDir.js";

test("getLastDirPath includes parent PID for concurrency safety", () => {
	const path = getLastDirPath();
	assert.ok(path.includes(".twig"));
	assert.ok(path.includes(`last-dir-${process.ppid}`));
});
