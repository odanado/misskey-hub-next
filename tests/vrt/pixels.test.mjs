import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { compareCaptures } from "./capture.mjs";
const image = (changed = false) => {
	const png = new PNG({ width: 3, height: 2 }); png.data.fill(255);
	if (changed) png.data[png.data.length - 4] = 254;
	return PNG.sync.write(png);
};
const capture = (changed = false) => ({ width: 3, height: 4, tiles: [{ y: 0, bytes: image() }, { y: 2, bytes: image(changed) }] });
test("Tiled comparison accepts identical pixels", () => assert.equal(compareCaptures(capture(), capture()).equal, true));
test("Tiled comparison checks the last pixel of the last tile", () => {
	const result = compareCaptures(capture(), capture(true));
	assert.equal(result.equal, false); assert.equal(result.differentPixels, 1); assert.equal(result.differentTile, 1); assert.equal(result.totalPixels, 12);
});
test("Tiled comparison rejects changed page dimensions", () => assert.equal(compareCaptures(capture(), { ...capture(), height: 5 }).reason, "dimensions"));
test("Single-image comparison checks exact RGBA", () => assert.equal(compareCaptures({ bytes: image() }, { bytes: image(true) }).differentPixels, 1));
