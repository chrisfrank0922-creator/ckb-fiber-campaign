/** Public demo progress only. AES keys, decrypted manifests, and pickup codes stay out of storage. */
export const progressKey = 'lockerpay:progress-v1';
export const customerProfileKey = 'lockerpay:customer-node-v1';
export const operatorProfileKey = 'lockerpay:operator-node-v1';

type Reader = Pick<Storage, 'getItem'>;

export type LockerProgress = {
  version: 1;
  customerId: string;
  operatorId: string;
  generatedPass: string;
  customerPassText: string;
  attemptedPaymentHash: string;
  triedWithoutKey: boolean;
};

export function savedNodeIdentifier(storage: Reader, key: string): string | null {
  try {
    const profile = JSON.parse(storage.getItem(key) ?? 'null');
    return profile &&
      /^[0-9a-f]{64}$/i.test(profile.fiberKey) &&
      /^[0-9a-f]{64}$/i.test(profile.ckbKey) &&
      typeof profile.identifier === 'string' &&
      profile.identifier.length > 0
      ? profile.identifier
      : null;
  } catch {
    return null;
  }
}

export function readProgress(session: Reader, profiles: Reader): LockerProgress | null {
  try {
    const value = JSON.parse(session.getItem(progressKey) ?? 'null');
    if (
      !value ||
      value.version !== 1 ||
      !value.customerId ||
      value.customerId !== savedNodeIdentifier(profiles, customerProfileKey) ||
      !value.operatorId ||
      value.operatorId !== savedNodeIdentifier(profiles, operatorProfileKey) ||
      typeof value.generatedPass !== 'string' ||
      typeof value.customerPassText !== 'string' ||
      typeof value.attemptedPaymentHash !== 'string' ||
      (value.attemptedPaymentHash && !/^0x[0-9a-f]{64}$/i.test(value.attemptedPaymentHash)) ||
      typeof value.triedWithoutKey !== 'boolean'
    ) {
      return null;
    }
    // Copy known public fields only; never propagate anything else from storage.
    return {
      version: 1,
      customerId: value.customerId,
      operatorId: value.operatorId,
      generatedPass: value.generatedPass,
      customerPassText: value.customerPassText,
      attemptedPaymentHash: value.attemptedPaymentHash,
      triedWithoutKey: value.triedWithoutKey,
    };
  } catch {
    return null;
  }
}
