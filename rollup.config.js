import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import { string } from 'rollup-plugin-string';

export default {
  input: 'js-funcs/starlings.js',
  output: [
    {
      file: 'dist/starlings.bundle.js',
      format: 'umd',
      name: 'Starlings',
      sourcemap: false,
    },
    {
      file: 'dist/starlings.bundle.min.js',
      format: 'umd',
      name: 'Starlings',
      sourcemap: false,
      plugins: [terser()]
    }
  ],
  plugins: [
    string({ include: '**/*.glsl' }),
    resolve(),
    commonjs(),
  ],
  onwarn(warning, warn) {
    // Suppress eval warnings from some three.js examples
    if (warning.code === 'EVAL') return;
    warn(warning);
  },
};
