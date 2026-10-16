// Netlify Function entry for every /api/* request.
import { handle } from "../../server/app.mjs";

export default (request) => handle(request);
export const config = { path: ["/api", "/api/*"] };
