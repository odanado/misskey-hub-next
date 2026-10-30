import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { compareCaptures } from './full-vrt-capture.mjs';

const image = () => {
	const png = new PNG({ width: 3, height: 2 });
	for (let i = 0; i < png.data.length; i += 4) png.data.set([20, 70, 150, 255], i);
	return png;
};
test('different lossless PNG encodings preserve exact RGBA equality', () => {
	const png = image();
	const a = PNG.sync.write(png, { deflateLevel: 0, filterType: 0 });
	const b = PNG.sync.write(png, { deflateLevel: 9, filterType: 4 });
	assert.ok(!a.equals(b));
	assert.equal(compareCaptures({ bytes: a }, { bytes: a }).equal, true);
	assert.equal(compareCaptures({ bytes: a }, { bytes: b }).equal, true);
});
test('a single alpha-channel change is a failing pixel', () => {
	const a = image(),
		b = image();
	b.data[3] = 254;
	const result = compareCaptures({ bytes: PNG.sync.write(a) }, { bytes: PNG.sync.write(b) });
	assert.equal(result.equal, false);
	assert.equal(result.differentPixels, 1);
});
test('different dimensions fail even with the same pixel colors', () => {
	const result = compareCaptures(
		{ bytes: PNG.sync.write(image()) },
		{ bytes: PNG.sync.write(new PNG({ width: 1, height: 1 })) },
	);
	assert.equal(result.equal, false);
	assert.equal(result.reason, 'dimensions');
});
