import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Readable output: error class names and stack traces stay intact.
  minify: false,
  keepNames: true,
  target: 'es2022',
  platform: 'neutral',
  // Named and default exports work for both `import` and `require`.
  cjsInterop: false,
  splitting: false,
  treeshake: true,
});
