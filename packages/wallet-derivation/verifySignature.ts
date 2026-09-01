import { ed25519 } from '@noble/curves/ed25519';
import { getBytes, SigningKey } from 'ethers';
import { Algorithm } from './types';

const withPrefix = (hex: string) => (hex.startsWith('0x') ? hex : `0x${hex}`);

// Check a raw signature against the public key that was supposed to produce it
export const verifyRawSignature = ({
  algorithm,
  message,
  signature,
  publicKey,
}: {
  algorithm: Algorithm;
  message: Uint8Array;
  signature: string;
  publicKey: string;
}): boolean => {
  try {
    if (algorithm === 'ECDSA') {
      // get uncompressed pubkey
      const recovered = SigningKey.recoverPublicKey(message, withPrefix(signature));

      return SigningKey.computePublicKey(recovered, true).toLowerCase() === withPrefix(publicKey).toLowerCase();
    }

    return ed25519.verify(getBytes(withPrefix(signature)), message, getBytes(withPrefix(publicKey)));
  } catch {
    return false;
  }
};
