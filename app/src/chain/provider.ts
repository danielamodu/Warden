import { ethers } from 'ethers';
import { COSTON2_RPC_URL } from './config';

let readProvider: ethers.JsonRpcProvider | null = null;

/** Read-only Coston2 provider — no wallet needed for any `view` call. */
export function getReadProvider(): ethers.JsonRpcProvider {
  if (!readProvider) {
    readProvider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  }
  return readProvider;
}
