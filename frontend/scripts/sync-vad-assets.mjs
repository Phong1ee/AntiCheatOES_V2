import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assets = [
  ['node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx', 'public/vad/silero_vad_v5.onnx'],
  ['node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js', 'public/vad/vad.worklet.bundle.min.js'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', 'public/mediapipe/vision_wasm_internal.js'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', 'public/mediapipe/vision_wasm_internal.wasm'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js', 'public/mediapipe/vision_wasm_nosimd_internal.js'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm', 'public/mediapipe/vision_wasm_nosimd_internal.wasm'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.js', 'public/mediapipe/vision_wasm_module_internal.js'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.wasm', 'public/mediapipe/vision_wasm_module_internal.wasm'],
];

await Promise.all(assets.map(async ([source, target]) => {
  const destination = resolve(projectRoot, target);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await copyFile(resolve(projectRoot, source), destination);
}));
