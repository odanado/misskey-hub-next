import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { modes } from '../shared/pages.mjs';
import { artifactPath } from '../shared/scope.mjs';

const mode = process.env.HUB_CONTENT_PILOT ?? 'baseline';
if (
	![
		...modes,
		'standalone',
		'ox-ported',
		'astro',
		'astro-ox',
		'baseline-vize',
		'ox-ported-vize',
		'astro-vize',
		'astro-ox-vize',
	].includes(mode)
)
	throw new Error('Invalid mode');
const root = resolve(`.pilot/${artifactPath(mode)}/public`);
const mime = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.jpg': 'image/jpeg',
};
createServer(async (req, res) => {
	try {
		let file = resolve(
			root,
			'.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
		);
		if (!file.startsWith(root + sep)) throw new Error('Forbidden');
		if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
		const bytes = await readFile(file);
		res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
		res.end(bytes);
	} catch {
		res.writeHead(404);
		res.end('Not found');
	}
}).listen(Number(process.env.PORT ?? 4173), '127.0.0.1');
