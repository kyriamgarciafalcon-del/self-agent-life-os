import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    '.vinext/**',
    'dist/**',
    'outputs/**',
    'out/**',
    'build/**',
    'android/**/build/**',
    'android/.gradle/**',
    'static-web/dist/**',
    'static-web/node_modules/**',
    '_quarantine/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
