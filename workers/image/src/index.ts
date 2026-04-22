import "dotenv/config";
import { getImageWorkerConfig } from "./config.js";

const { appEnv, heartbeatMs } = getImageWorkerConfig();

console.log(`Image worker started in ${appEnv} environment`);

setInterval(() => {
  console.log(`Image worker heartbeat: ${new Date().toISOString()}`);
}, heartbeatMs);
