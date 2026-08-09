import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const targetDirectory = resolve(projectRoot, 'public', 'vad');
const assets = [
  ['node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx', 'silero_vad_v5.onnx'],
  ['node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js', 'vad.worklet.bundle.min.js'],
];

await mkdir(targetDirectory, { recursive: true });
await Promise.all(assets.map(([source, target]) => copyFile(resolve(projectRoot, source), resolve(targetDirectory, target))));
