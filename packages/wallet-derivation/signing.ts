/* eslint-disable max-classes-per-file */
import type { UtilityExtendedKeys, RelayExtendedKeys } from '@fireblocks/recovery-shared';
import { encodeBase58, getBytes, hashMessage, hexlify, toUtf8Bytes } from 'ethers';
import { Algorithm, Input } from './types';
import { EVMWallet } from './wallets/chains/EVM';
import { Solana } from './wallets/chains/SOL';
import { verifyRawSignature } from './verifySignature';

// Signer for ETH (ECDSA)
class EthereumSigner extends EVMWallet {
  public async signDigest(digest: Uint8Array | string) {
    return this.sign(digest);
  }

  public async signTextMessage(message: string) {
    // hashMessage() = keccak256("\x19Ethereum Signed Message:\n" + len + utf8(msg)).
    return this.sign(hashMessage(message));
  }
}

// Signer for SOL (EdDSA)
class SolanaSigner extends Solana {
  public async signDigest(digest: Uint8Array) {
    return this.sign(digest);
  }

  public async signTextMessage(message: string) {
    return this.sign(toUtf8Bytes(message));
  }
}

export const RAW_SIGN_CHAIN_IDS = ['ETH', 'SOL'] as const;

export type RawSignChainId = (typeof RAW_SIGN_CHAIN_IDS)[number];

type ChainDefinition = Readonly<{
  label: string;
  coinType: number;
  algorithm: Algorithm;
  extendedPrivateKey: 'xprv' | 'fprv';
}>;

export const RAW_SIGN_CHAINS: Readonly<Record<RawSignChainId, ChainDefinition>> = {
  ETH: {
    label: 'Ethereum (ECDSA)',
    coinType: 60,
    algorithm: 'ECDSA',
    extendedPrivateKey: 'xprv',
  },
  SOL: {
    label: 'Solana (EdDSA)',
    coinType: 501,
    algorithm: 'EDDSA',
    extendedPrivateKey: 'fprv',
  },
};

export type RawSignInput =
  | { kind: 'digest'; value: string }
  | { kind: 'text'; value: string };

export type ChainSignature = Readonly<{
  chain: RawSignChainId;
  algorithm: Algorithm;
  derivationPath: string;
  address: string;
  addressHex: string;
  publicKey: string;
  signature: string;
  signatureHex: string;
  isVerified: boolean;
}>;

export const signWithChain = async ({
  chain,
  accountIndex,
  extendedKeys,
  input,
}: {
  chain: RawSignChainId;
  accountIndex: number;
  extendedKeys: UtilityExtendedKeys | RelayExtendedKeys;
  input: RawSignInput;
}): Promise<ChainSignature> => {
  const definition = RAW_SIGN_CHAINS[chain];

  if (!input.value) {
    throw new Error('Nothing to sign: provide either a raw digest or a message.');
  }

  const walletInput = {
    ...extendedKeys,
    assetId: chain,
    path: { coinType: definition.coinType, account: accountIndex, changeIndex: 0, addressIndex: 0 },
  } as Input;

  let signedBytes: Uint8Array;
  let signatureHex: string;
  let wallet: EthereumSigner | SolanaSigner;

  if (chain === 'ETH') {
    const ethWallet = new EthereumSigner(walletInput, definition.coinType);
    wallet = ethWallet;

    if (input.kind === 'text') {
      signedBytes = getBytes(hashMessage(input.value));
      signatureHex = await ethWallet.signTextMessage(input.value);
    } else {
      signedBytes = getBytes(hexlify(input.value.startsWith('0x') ? input.value : `0x${input.value}`));
      signatureHex = await ethWallet.signDigest(signedBytes);
    }
  } else {
    const solWallet = new SolanaSigner(walletInput);
    wallet = solWallet;

    signedBytes =
      input.kind === 'text'
        ? toUtf8Bytes(input.value)
        : getBytes(hexlify(input.value.startsWith('0x') ? input.value : `0x${input.value}`));

    signatureHex = hexlify(await solWallet.signDigest(signedBytes));
  }

  const isVerified = verifyRawSignature({
    algorithm: definition.algorithm,
    message: signedBytes,
    signature: signatureHex,
    publicKey: wallet.publicKey,
  });

  return {
    chain,
    algorithm: definition.algorithm,
    derivationPath: `m/${wallet.pathParts.join('/')}`,
    address: wallet.address,
    // for SOL we get the hex form too
    addressHex: chain === 'SOL' ? wallet.publicKey : wallet.address,
    publicKey: wallet.publicKey,
    signature: chain === 'SOL' ? encodeBase58(signatureHex) : signatureHex,
    signatureHex,
    isVerified,
  };
};
