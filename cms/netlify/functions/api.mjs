// Netlify Function entry for every /api/* request.
import { handle } from "../../server/app.mjs";

// NETLIFY is only set during builds, not in the Functions runtime. Set it here so
// config.mjs treats this as a hosted deployment (Sheets store, no dev login, HSTS).
process.env.NETLIFY ||= "true";

export default (request) => handle(request);
export const config = { path: ["/api", "/api/*"] };
