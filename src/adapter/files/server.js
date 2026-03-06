import { Server } from "./server/index.js";
import { manifest } from "./server/manifest.js";

const server = new Server(manifest);

export default server;
