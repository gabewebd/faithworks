// Next.js App Router entry for the whole CMS API. The router itself stays platform-neutral
// (server/app.mjs: web Request -> Response), so this file only forwards every method to it.
import { handle } from "../../../server/app.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = (request) => handle(request);
export const POST = (request) => handle(request);
export const PUT = (request) => handle(request);
export const PATCH = (request) => handle(request);
export const DELETE = (request) => handle(request);
