// Registers a resolver so `import 'three'` maps to a lightweight stub in tests.
// Rendering is not tested; scene-graph logic (positions, add/remove) is.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./three-hooks.mjs', pathToFileURL(import.meta.filename));
