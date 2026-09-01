import { useRef, useState } from 'react';
import { Box, Grid, IconButton, InputAdornment, Tooltip, Typography } from '@mui/material';
import { CheckCircle, Cancel, QrCode2, Notes } from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import { BaseModal, Button, Select, TextField, getLogger } from '@fireblocks/recovery-shared';
import { download } from '@fireblocks/recovery-shared/lib/download';
import { LOGGER_NAME_UTILITY } from '@fireblocks/recovery-shared/constants';
import { ChainSignature, RAW_SIGN_CHAINS, RAW_SIGN_CHAIN_IDS, RawSignChainId, signWithChain } from '@fireblocks/wallet-derivation';
import { useWorkspace } from '../../context/Workspace';
import { renderPrintableLabel } from '../../lib/printableLabel';

const logger = getLogger(LOGGER_NAME_UTILITY);

const QR_SOURCE_SIZE = 1024;
const PRINT_WIDTH = 720;

const chainItems = RAW_SIGN_CHAIN_IDS.map((chainId) => ({
  value: chainId,
  children: RAW_SIGN_CHAINS[chainId].label,
}));

export const SignTextMessageForm = () => {
  const { extendedKeys } = useWorkspace();

  const [chain, setChain] = useState<RawSignChainId>('ETH');
  const [accountIndex, setAccountIndex] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [result, setResult] = useState<ChainSignature | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const addressQrRef = useRef<HTMLDivElement>(null);
  const signatureQrRef = useRef<HTMLDivElement>(null);

  const derivationPath = `m/44/${RAW_SIGN_CHAINS[chain].coinType}/${Number.isFinite(accountIndex) ? accountIndex : 0}/0/0`;

  // Solana encodes addresses and signatures in base58; the printed labels and
  // the extra fields carry the hex forms
  const isBase58Chain = result?.chain === 'SOL';
  const qrAddressValue = result ? (isBase58Chain ? result.addressHex : result.address) : '';
  const qrSignatureValue = result ? (isBase58Chain ? result.signatureHex : result.signature) : '';

  // QR and text go on separate labels so each can be cut
  const handleDownloadLabel = async (target: 'address' | 'signature', kind: 'qr' | 'text') => {
    setLabelError(undefined);

    try {
      if (!result) {
        throw new Error('Nothing to print yet');
      }

      const value = target === 'address' ? qrAddressValue : qrSignatureValue;
      const encoding = isBase58Chain ? ' (hex)' : '';

      let qrCanvas: HTMLCanvasElement | undefined;

      if (kind === 'qr') {
        qrCanvas = (target === 'address' ? addressQrRef : signatureQrRef).current?.querySelector('canvas') ?? undefined;

        if (!qrCanvas) {
          throw new Error('The QR code has not finished rendering — try again in a moment');
        }
      }

      const fields =
        kind === 'text'
          ? target === 'address'
            ? [{ value, monospace: true }]
            : [
                { value, monospace: true },
                { value: message },
              ]
          : undefined;

      const blob = await renderPrintableLabel({ width: PRINT_WIDTH, qrCanvas, fields });

      const safePath = result.derivationPath.replace(/\//g, '_');

      download(blob, `${result.chain}-${target}${encoding ? '-hex' : ''}-${kind}-${safePath}.png`, 'image/png');
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      logger.error(`printable label error - ${reason}`);
      setLabelError(reason);
    }
  };

  const labelDownloads = (target: 'address' | 'signature') => (
    <InputAdornment position='end'>
      <Tooltip title='Download QR label'>
        <IconButton aria-label={`Download ${target} QR label`} edge='end' onClick={() => handleDownloadLabel(target, 'qr')}>
          <QrCode2 />
        </IconButton>
      </Tooltip>
      <Tooltip title='Download text label'>
        <IconButton aria-label={`Download ${target} text label`} edge='end' onClick={() => handleDownloadLabel(target, 'text')}>
          <Notes />
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );

  const handleSign = async () => {
    setIsSigning(true);
    setResult(undefined);
    setError(undefined);

    try {
      if (!extendedKeys) {
        throw new Error('No recovered keys in this session. Use your Recovery Kit to recover private keys first.');
      }

      const signed = await signWithChain({
        chain,
        accountIndex,
        extendedKeys,
        input: { kind: 'text', value: message },
      });

      setResult(signed);
      logger.info('Signed text message', {
        chain: signed.chain,
        derivationPath: signed.derivationPath,
        address: signed.address,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      logger.error(`sign text message error - ${reason}`);
      setError(reason);
    } finally {
      setIsSigning(false);
      setIsModalOpen(true);
    }
  };

  return (
    <Box component='form' height='100%' display='flex' flexDirection='column'>
      <Typography variant='h1' component='h2' gutterBottom>
        Sign Text Message
      </Typography>
      <Typography variant='body1' paragraph>
        Sign a message with a key derived from your recovered workspace keys, using the selected chain's own message-signing
        scheme. The resulting address and signature can be verified with standard wallet tooling.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={6}>
          <Select
            id='sign-text-chain'
            label='Chain'
            value={chain}
            items={chainItems}
            onChange={(event) => setChain(event.target.value as RawSignChainId)}
            disabled={isSigning}
          />
        </Grid>

        <Grid item xs={6}>
          <TextField
            id='sign-text-account'
            type='number'
            label='Account'
            value={String(accountIndex)}
            helpText={`Derivation path: ${derivationPath}`}
            inputProps={{ min: 0, step: 1 }}
            onChange={(event) => setAccountIndex(Number(event.target.value))}
            disabled={isSigning}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            id='sign-text-message'
            label='Message'
            multiline
            minRows={4}
            value={message}
            placeholder='Type the message to sign'
            helpText='Signed exactly as typed, including whitespace and line breaks.'
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSigning}
          />
        </Grid>

        <Grid item xs={12}>
          <Button
            sx={{ width: 'fit-content' }}
            color='primary'
            disabled={isSigning || !message || !Number.isFinite(accountIndex) || accountIndex < 0}
            onClick={handleSign}
          >
            {isSigning ? 'Signing...' : 'Sign Message'}
          </Button>
        </Grid>
      </Grid>

      <BaseModal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={error ? 'Signing Failed' : 'Signature'}>
        {error ? (
          <Typography variant='body1' fontWeight='600' color={(theme) => theme.palette.error.main}>
            {error}
          </Typography>
        ) : (
          !!result && (
            <Grid container spacing={2}>
              <Grid item xs={12} display='flex' alignItems='center' gap={1}>
                {result.isVerified ? <CheckCircle color='success' /> : <Cancel color='error' />}
                <Typography
                  variant='body1'
                  fontWeight='600'
                  color={result.isVerified ? 'success.main' : 'error.main'}
                >
                  {result.isVerified
                    ? 'Signature verified against the derived public key'
                    : 'Signature could NOT be verified against the derived public key'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  id='sign-text-address'
                  label={isBase58Chain ? 'Address (base58)' : 'Address'}
                  value={result.address}
                  helpText={result.derivationPath}
                  isMonospace
                  enableCopy
                  {...(isBase58Chain ? {} : { endAdornment: labelDownloads('address') })}
                />
              </Grid>
              {isBase58Chain && (
                <Grid item xs={12}>
                  <TextField
                    id='sign-text-address-hex'
                    label='Address (hex)'
                    value={result.addressHex}
                    isMonospace
                    enableCopy
                    endAdornment={labelDownloads('address')}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  id='sign-text-signature'
                  label={isBase58Chain ? 'Signature (base58)' : 'Signature'}
                  value={result.signature}
                  isMonospace
                  enableCopy
                  multiline
                  minRows={2}
                  {...(isBase58Chain ? {} : { endAdornment: labelDownloads('signature') })}
                />
              </Grid>
              {isBase58Chain && (
                <Grid item xs={12}>
                  <TextField
                    id='sign-text-signature-hex'
                    label='Signature (hex)'
                    value={result.signatureHex}
                    isMonospace
                    enableCopy
                    multiline
                    minRows={2}
                    endAdornment={labelDownloads('signature')}
                  />
                </Grid>
              )}
              {!!labelError && (
                <Grid item xs={12}>
                  <Typography variant='body2' fontWeight='600' color={(theme) => theme.palette.error.main}>
                    {labelError}
                  </Typography>
                </Grid>
              )}

              {/* Rendered offscreen purely as a source to draw into the label. */}
              <Box sx={{ position: 'absolute', left: -99999, top: 0 }} aria-hidden>
                <div ref={addressQrRef}>
                  <QRCodeCanvas value={qrAddressValue} size={QR_SOURCE_SIZE} includeMargin level='M' />
                </div>
                <div ref={signatureQrRef}>
                  <QRCodeCanvas value={qrSignatureValue} size={QR_SOURCE_SIZE} includeMargin level='M' />
                </div>
              </Box>
            </Grid>
          )
        )}
      </BaseModal>
    </Box>
  );
};
