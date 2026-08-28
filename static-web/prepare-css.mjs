import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('../app/globals.css', 'utf8');
const body = src
  .split('\n')
  .filter((line) => !line.includes("@import 'tailwindcss'"))
  .join('\n');
writeFileSync('globals.css', body);
