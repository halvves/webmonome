/* eslint-env node */
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { rollup } from 'rollup';
import { swc, defineRollupSwcOption } from 'rollup-plugin-swc3';

async function check() {
	let bundle;
	let buildFailed = false;

	try {
		bundle = await rollup({
			input: 'src/Monome.js',
			plugins: [swc(defineRollupSwcOption({ minify: true }))],
		});

		const { output } = await bundle.generate({
			format: 'es',
		});

		for (const chunkOrAsset of output) {
			if (chunkOrAsset.type === 'chunk') {
				console.log('minified', Buffer.byteLength(chunkOrAsset.code, 'utf8'));
				const gz = await promisify(zlib.gzip)(chunkOrAsset.code);
				console.log('minzipped', gz.byteLength);
			}
		}
	} catch (error) {
		buildFailed = true;
		console.error(error);
	}

	if (bundle) {
		await bundle.close();
	}

	process.exit(buildFailed ? 1 : 0);
}

check();
