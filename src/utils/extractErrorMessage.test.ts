import assert from "node:assert";
import { describe, it } from "node:test";
import { extractErrorMessage } from "./extractErrorMessage.js";

describe("extractErrorMessage", () => {
	it("should extract stderr from error objects", () => {
		const err = { stderr: "git error message", message: "ignored" };
		const result = extractErrorMessage(err);

		assert.strictEqual(result, "git error message");
	});

	it("should extract message when stderr is not present", () => {
		const err = { message: "regular error message" };
		const result = extractErrorMessage(err);

		assert.strictEqual(result, "regular error message");
	});

	it("should convert to string when neither stderr nor message exist", () => {
		const err = "string error";
		const result = extractErrorMessage(err);

		assert.strictEqual(result, "string error");
	});

	it("should handle null", () => {
		const result = extractErrorMessage(null);
		assert.strictEqual(result, "null");
	});

	it("should handle undefined", () => {
		const result = extractErrorMessage(undefined);
		assert.strictEqual(result, "undefined");
	});

	it("should handle objects without stderr or message", () => {
		const err = { code: 123 };
		const result = extractErrorMessage(err);
		assert.strictEqual(result, "[object Object]");
	});
});
