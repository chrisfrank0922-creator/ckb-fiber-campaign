import type { FiberBrowserNode, SendPaymentParams } from '@fiber-pay/sdk/browser';
import { priceShannons } from './constants.ts';
import type { LockerAccessPass } from './access-pass';
import {
  assertEncryptedInvoiceNotExpired,
  EncryptedPaymentRejectedError,
  submitEncryptedPayment,
} from './payment-submission.ts';

export async function validateAccessPass(node: FiberBrowserNode, pass: LockerAccessPass) {
  const { invoice } = await node.parseInvoice({ invoice: pass.invoice });
  if (
    invoice.currency !== 'Fibt' ||
    BigInt(invoice.amount ?? '0x0') !== BigInt(priceShannons) ||
    invoice.data.payment_hash.toLowerCase() !== pass.paymentHash.toLowerCase()
  ) {
    throw new Error('The invoice does not match this 1 CKB locker access pass.');
  }
  return invoice;
}

export async function payForLocker(
  node: FiberBrowserNode,
  pass: LockerAccessPass,
  attempt: string,
  recordAttempt: (hash: string) => void,
  retry = false,
) {
  const invoice = await validateAccessPass(node, pass);
  if (attempt) {
    if (attempt.toLowerCase() !== pass.paymentHash.toLowerCase()) {
      throw new Error('Restore the pass for the previous payment.');
    }
    const previous = await node.getPayment({ payment_hash: pass.paymentHash });
    if (!retry || previous.status !== 'Failed') return previous;
  }
  assertEncryptedInvoiceNotExpired(invoice);
  // A storage failure aborts before a payment can be submitted.
  recordAttempt(pass.paymentHash);
  try {
    return await submitEncryptedPayment(node, pass.paymentHash, {
      invoice: pass.invoice,
      hop_hints: [pass.lastHop] as unknown as NonNullable<SendPaymentParams['hop_hints']>,
      max_fee_amount: priceShannons,
      max_parts: '0x1',
    });
  } catch (error) {
    if (error instanceof EncryptedPaymentRejectedError) recordAttempt('');
    throw error;
  }
}
