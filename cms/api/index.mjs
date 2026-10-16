// Vercel Function entry: every /api/* request is rewritten here (vercel.json).
import { handle } from "../server/app.mjs";

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
