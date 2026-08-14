// Calls to the fce-extension-scaffold's extension proxy — the Go tee-node's
// HTTP surface (/info, /action/result/:id). Mirrors
// fce-extension-scaffold/tools/pkg/fccutils/tee_calls.go's TeeInfo() and
// ActionResult() exactly, just via browser fetch() instead of net/http.
//
// The proxy URL is an ephemeral cloudflared tunnel (see chain/config.ts) —
// if it's down, every call here throws a clear, real error. Per this task's
// explicit instructions: do not fall back to mock data if this is
// unreachable, surface the failure.
import { TEE_EXTENSION_PROXY_URL } from './config';

// Same CORS situation as chain/xrpl.ts, so this is always a same-origin path:
// Vite's dev proxy forwards it locally (see vite.config.ts) and a Vercel
// rewrite forwards it in production (see vercel.json). Calling the extension
// proxy directly from the browser is blocked in both. TEE_EXTENSION_PROXY_URL
// stays the single source of truth for where that path points.
const TEE_PROXY_BASE = '/tee-proxy';

export interface TeeInfoResponse {
  teeInfo: {
    publicKey: { x: string; y: string };
    [key: string]: unknown;
  };
  machineData: {
    extensionId: string;
    initialOwner: string;
    codeHash: string;
    platform: string;
    publicKey: { x: string; y: string };
    governanceHash: string;
  };
  dataSignature: string;
  attestation: string;
  proxySignature: string;
}

async function proxyFetch(path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${TEE_PROXY_BASE}${path}`);
  } catch (err) {
    throw new Error(
      `Cannot reach the TEE extension proxy at ${TEE_EXTENSION_PROXY_URL}${path}. ` +
        `This is a live infra dependency (an ephemeral cloudflared tunnel) — if it's down, that's outside this ` +
        `app's control, not a fallback-to-mock situation. Underlying error: ${(err as Error).message}`
    );
  }
  if (!res.ok) {
    throw new Error(`TEE extension proxy ${path} returned HTTP ${res.status} ${res.statusText}`);
  }
  return res;
}

export async function fetchTeeInfo(): Promise<TeeInfoResponse> {
  const res = await proxyFetch('/info');
  return res.json();
}

export interface ActionResultResponse {
  result: {
    id: string;
    submissionTag: string;
    status: number; // 0 = failed, 1 = success, 2 = pending
    log: string;
    data: string; // 0x-prefixed hex, ABI-encoded
  };
  signature: string; // 0x-prefixed hex
  proxySignature: string;
}

export async function fetchActionResult(instructionId: string): Promise<ActionResultResponse> {
  const res = await proxyFetch(`/action/result/${instructionId}`);
  return res.json();
}
