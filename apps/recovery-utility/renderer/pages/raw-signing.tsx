'use client';
import React, { Suspense, useCallback, useState } from 'react';
import { BoxButton } from '.';
import { Grid, Typography } from '@mui/material';
import { useWorkspace } from '../context/Workspace';
import EditNoteIcon from '@mui/icons-material/EditNote';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import { useRawSignMessage } from '@fireblocks/recovery-shared/hooks/useRawSignMessage';
import Signature from '@fireblocks/recovery-shared/components/RawSigningForm/Signature';
import { BaseModal, getLogger } from '@fireblocks/recovery-shared';
import { SignMessageParams } from '@fireblocks/recovery-shared/components';
import { LOGGER_NAME_UTILITY } from '@fireblocks/recovery-shared/constants';

const RawSigningForm = React.lazy(() => import('@fireblocks/recovery-shared/components/RawSigningForm'));
const RawSigningModal = React.lazy(() => import('../components/Modals/RawSigningModal'));
const SignTextMessageForm = React.lazy(() =>
  import('../components/SignTextMessageForm').then((m) => ({ default: m.SignTextMessageForm })),
);

enum PageStatus {
  STATUS_SELECTION = 'statusSelection',
  GENERATE_SIGNATURE = 'generateSignature',
  SIGN_QR = 'signQr',
  SIGN_TEXT_MESSAGE = 'signTextMessage',
}

const logger = getLogger(LOGGER_NAME_UTILITY);

const RawSigning: React.FC = () => {
  const { extendedKeys, accounts } = useWorkspace();

  const [pageStatus, setPageStatus] = useState<PageStatus>(PageStatus.STATUS_SELECTION);
  const [isSignedModalOpen, setIsSignedModalOpen] = useState<boolean>(false);

  const handleCloseQRModal = () => {
    setPageStatus(PageStatus.STATUS_SELECTION);
  };

  const { generateSignature, signature, address, isVerified, error, selectedAlgorithm } = useRawSignMessage(extendedKeys);

  const handleSigningMessage = useCallback(
    async ({
      unsignedMessage,
      rawSignMethod,
      selectedWallet,
      inputChangeIndex,
      inputAdressIndex,
      derivationPath,
      dpAlgorithm,
    }: SignMessageParams) => {
      try {
        await generateSignature({
          unsignedMessage,
          rawSignMethod,
          selectedWallet,
          inputChangeIndex,
          inputAdressIndex,
          derivationPath,
          dpAlgorithm,
        });
        setIsSignedModalOpen(true);
      } catch (error) {
        console.error(`utility raw signing error - ${error}`);
        logger.error(`utility raw signing error - ${error}`);
      }
    },
    [signature, isSignedModalOpen],
  );

  return (
    <>
      {(pageStatus === PageStatus.STATUS_SELECTION || pageStatus === PageStatus.SIGN_QR) && (
        <Grid container spacing={2} display='flex' alignItems='center' justifyContent='center' height='100%'>
          <Grid item xs={4}>
            <BoxButton
              icon={EditNoteIcon}
              title='Generate Signature'
              description={''}
              color='error'
              onClick={() => {
                setPageStatus(PageStatus.GENERATE_SIGNATURE);
                setIsSignedModalOpen(true);
              }}
            />
          </Grid>
          <Grid item xs={4}>
            <BoxButton
              icon={QrCodeScannerIcon}
              title='Sign via QR'
              description=''
              color='primary'
              onClick={() => {
                setPageStatus(PageStatus.SIGN_QR);
              }}
            />
          </Grid>
          <Grid item xs={4}>
            <BoxButton
              icon={HistoryEduIcon}
              title='Sign Text Message'
              description=''
              color='error'
              onClick={() => {
                setPageStatus(PageStatus.SIGN_TEXT_MESSAGE);
              }}
            />
          </Grid>
        </Grid>
      )}

      {pageStatus === PageStatus.SIGN_TEXT_MESSAGE && (
        <Suspense>
          <SignTextMessageForm />
        </Suspense>
      )}

      {pageStatus === PageStatus.GENERATE_SIGNATURE && (
        <>
          <Suspense>
            <RawSigningForm accounts={accounts} onSubmit={handleSigningMessage} />
          </Suspense>

          {(signature || error) && (
            <BaseModal
              open={isSignedModalOpen}
              onClose={() => {
                setIsSignedModalOpen(false);
              }}
              title={error ? 'Signing Failed' : 'Signature'}
            >
              {error ? (
                <Typography variant='body1' fontWeight='600' color={(theme) => theme.palette.error.main}>
                  {error}
                </Typography>
              ) : (
                <Signature
                  selectedAlgorithm={selectedAlgorithm}
                  signature={signature as string}
                  address={address}
                  isVerified={isVerified}
                />
              )}
            </BaseModal>
          )}
        </>
      )}
      <Suspense>
        <RawSigningModal open={pageStatus === PageStatus.SIGN_QR} onClose={handleCloseQRModal} />
      </Suspense>
    </>
  );
};

export default RawSigning;
