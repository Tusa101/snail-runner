import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const stubUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'stubs', 'three.js')).href;
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: stubUrl, shortCircuit: true };
  return next(specifier, context);
}
