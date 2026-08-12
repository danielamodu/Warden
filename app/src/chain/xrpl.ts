// Live XRPL testnet reads via plain fetch() against the public JSON-RPC
// endpoint — deliberately not the `xrpl` npm package, which pulls in
// Node-only dependencies that need extra polyfilling under Vite. Same
// account_info / account_tx commands and the same meta.delivered_amount
// gotcha as scripts/phase3/06-monitor-xrpl-payout.mjs (NOT tx.Amount /
// DeliverMax — a documented XRPL footgun since the DeliverMax rename).
import { XRPL_TESTNET_JSON_RPC } from './config';

// The public XRPL testnet JSON-RPC endpoint sends no CORS headers (confirmed
// empirically: browser fetch is blocked with "No 'Access-Control-Allow-Origin'
// header"). In local dev, Vite's server.proxy (see vite.config.ts) forwards
// this same-origin path through to the real endpoint. In a production
// deployment (no Vite dev server), the direct URL is used and will hit the
// same CORS wall until a small server-side proxy is stood up — an infra-side
// fix outside this app's scope, called out in the final report.
const XRPL_ENDPOINT = import.meta.env.DEV ? '/xrpl-rpc/' : XRPL_TESTNET_JSON_RPC;

async function xrplRequest<T = any>(method: string, params: Record<string, unknown>[]): Promise<T> {
  const res = await fetch(XRPL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  if (!res.ok) {
    throw new Error(`XRPL testnet JSON-RPC HTTP ${res.status} calling ${method}`);
  }
  const json = await res.json();
  if (json?.result?.status === 'error') {
    throw new Error(`XRPL testnet error (${method}): ${json.result.error_message || json.result.error}`);
  }
  return json.result as T;
}

/** Live XRP balance (in XRP, not drops) for an XRPL testnet address. */
export async function getXrplBalanceXrp(address: string): Promise<number> {
  const result = await xrplRequest<{ account_data: { Balance: string } }>('account_info', [
    { account: address, ledger_index: 'validated' },
  ]);
  return Number(result.account_data.Balance) / 1_000_000;
}

export interface XrplPayoutTx {
  hash: string;
  amountXrp: number;
  fromAccount: string;
}

/**
 * Looks at the most recent transactions for `address` and returns the first
 * successful incoming Payment whose hash isn't in `excludeHashes` — used
 * both to find a fresh payout (poll loop, excludeHashes = already-seen) and
 * to look up a specific known historical payout (excludeHashes = []).
 */
export async function findXrplPayoutTx(address: string, excludeHashes: string[] = []): Promise<XrplPayoutTx | null> {
  const result = await xrplRequest<{ transactions: any[] }>('account_tx', [{ account: address, limit: 20 }]);
  for (const entry of result.transactions ?? []) {
    const tx = entry.tx_json ?? entry.tx;
    if (
      tx?.TransactionType === 'Payment' &&
      tx.Destination === address &&
      entry.meta?.TransactionResult === 'tesSUCCESS'
    ) {
      const hash: string = tx.hash ?? entry.hash;
      if (excludeHashes.includes(hash)) continue;
      const delivered = entry.meta?.delivered_amount;
      if (typeof delivered !== 'string') continue; // skip issued-currency (non-XRP) deliveries
      return { hash, amountXrp: Number(delivered) / 1_000_000, fromAccount: tx.Account };
    }
  }
  return null;
}
