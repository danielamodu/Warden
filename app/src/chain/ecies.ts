// Browser-side ECIES encryption that byte-for-byte matches go-ethereum's
// crypto/ecies package with ecies.ECIES_AES128_SHA256 params — the exact
// scheme fce-extension-scaffold's Go tooling uses
// (ecies.Encrypt(rand.Reader, teePubKey, plaintext, nil, nil), see
// tools/pkg/utils/instructions.go's EncryptRuleOnEvidenceRequest).
//
// DO NOT replace this with an off-the-shelf npm ECIES library's defaults —
// most (eciesjs etc.) default to HKDF + AES-256-GCM, which the enclave's
// Go-side ecies.Decrypt() cannot read. Every step below is copied from
// go-ethereum@v1.17.4's crypto/ecies/ecies.go + params.go:
//
//   Curve:  secp256k1 (go-ethereum's crypto.S256())
//   KDF:    NIST SP 800-56 Concatenation KDF, single SHA-256 round (see
//           concatKDF in ecies.go) — no shared info (s1 = s2 = nil)
//   Cipher: AES-128-CTR (ECIES_AES128_SHA256: KeyLen=16, BlockSize=16),
//           random 16-byte IV, IV prepended to the ciphertext body
//   MAC:    HMAC-SHA256 over (iv || ciphertextBody), keyed with
//           SHA256(secondHalfOfKdfOutput) — see deriveKeys() in ecies.go
//   Output: ephemeralPubKey(65B uncompressed SEC1: 0x04||X||Y)
//           || iv(16B) || ciphertextBody || tag(32B)
//           — see Encrypt()'s final concatenation in ecies.go.

import { secp256k1 } from '@noble/curves/secp256k1';

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  const padded = clean.length % 2 === 0 ? clean : `0${clean}`;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(padded.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bigIntToBytesBE(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let v = n;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return new Uint8Array(digest);
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

async function aes128CtrEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key.buffer as ArrayBuffer, { name: 'AES-CTR' }, false, [
    'encrypt',
  ]);
  // length: 128 tells WebCrypto to treat the entire 16-byte IV as the
  // counter (incremented as one big-endian 128-bit integer), matching Go's
  // crypto/cipher.NewCTR(block, iv) semantics exactly (whole-block counter,
  // no separate nonce/counter split).
  const ct = await crypto.subtle.encrypt({ name: 'AES-CTR', counter: iv.buffer as ArrayBuffer, length: 128 }, cryptoKey, data.buffer as ArrayBuffer);
  return new Uint8Array(ct);
}

// NIST SP 800-56 Concatenation KDF — matches go-ethereum's concatKDF exactly:
// for each 4-byte big-endian counter starting at 1, hash(counter || z || s1),
// concatenated until kdLen bytes are produced. For ECIES_AES128_SHA256,
// kdLen is always 32 (2 * KeyLen=16) which equals SHA-256's output size, so
// this always resolves in exactly one iteration in practice — implemented as
// a general loop anyway for fidelity to the reference.
async function concatKDF(z: Uint8Array, s1: Uint8Array, kdLen: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let produced = 0;
  let counter = 1;
  while (produced < kdLen) {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, counter, false);
    const chunk = await sha256(concatBytes(counterBytes, z, s1));
    chunks.push(chunk);
    produced += chunk.length;
    counter++;
  }
  return concatBytes(...chunks).slice(0, kdLen);
}

/**
 * ECIES-encrypts `plaintext` to a secp256k1 public key given as raw 32-byte
 * X/Y coordinates (hex strings, with or without 0x prefix) — the same shape
 * the TEE extension proxy's /info response and the on-chain
 * MachineManager.getPublicKey() both return.
 */
export async function eciesEncryptToPubKey(
  pubKeyXHex: string,
  pubKeyYHex: string,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const x = hexToBytes(pubKeyXHex);
  const y = hexToBytes(pubKeyYHex);
  if (x.length !== 32 || y.length !== 32) {
    throw new Error(`TEE public key coordinates must be 32 bytes each (got x=${x.length}B, y=${y.length}B)`);
  }
  const recipientUncompressed = concatBytes(new Uint8Array([4]), x, y);
  const recipientPoint = secp256k1.ProjectivePoint.fromHex(bytesToHex(recipientUncompressed));
  recipientPoint.assertValidity();

  // Ephemeral keypair R, unique per encryption.
  const ephPriv = secp256k1.utils.randomPrivateKey();
  const ephPubUncompressed = secp256k1.getPublicKey(ephPriv, false); // 65B: 0x04||X||Y

  // ECDH: z = X coordinate of (ephPriv * recipientPubKey), big-endian,
  // left-zero-padded to 32 bytes — matches Go's
  // `x, _ := pub.Curve.ScalarMult(...); skBytes := x.Bytes(); copy(sk[padded:], skBytes)`.
  const ephPrivScalar = BigInt(`0x${bytesToHex(ephPriv)}`);
  const sharedPoint = recipientPoint.multiply(ephPrivScalar).toAffine();
  const zBytes = bigIntToBytesBE(sharedPoint.x, 32);

  const keyLen = 16; // AES-128 (ECIES_AES128_SHA256.KeyLen)
  const K = await concatKDF(zBytes, new Uint8Array(0), 2 * keyLen);
  const Ke = K.slice(0, keyLen);
  const KmPre = K.slice(keyLen, 2 * keyLen);
  const Km = await sha256(KmPre); // deriveKeys(): Km = hash(Km_pre)

  const iv = crypto.getRandomValues(new Uint8Array(16)); // BlockSize=16
  const ctBody = await aes128CtrEncrypt(Ke, iv, plaintext);
  const em = concatBytes(iv, ctBody);

  const tag = await hmacSha256(Km, em); // messageTag(): HMAC(Km, em || s2=empty)

  return concatBytes(ephPubUncompressed, em, tag);
}
