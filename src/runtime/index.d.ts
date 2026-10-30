/**
 * The entry adapter-node generates beside server.js in the build output
 * (`dist/build/index.js`). It does not exist in the source tree; this
 * declaration types the import in server.js.
 */
import type { Server } from 'node:http';

export const server: Server;
