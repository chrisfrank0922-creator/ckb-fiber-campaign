import { lockerSizes, type LockerSize } from './constants.ts';

export type LockerDraft = {
  /** Public locker label, e.g. "A-17". */
  name: string;
  location: string;
  size: LockerSize;
  /** Secret 4-digit pickup code. */
  code: string;
  /** Secret parcel description. */
  parcel: string;
  recipient: string;
  note: string;
};

export type LockerManifest = {
  code: string;
  parcel: string;
  recipient: string;
  note: string;
};

export const MAX_NAME = 16;
export const MAX_LOCATION = 80;
export const MAX_PARCEL = 120;
export const MAX_RECIPIENT = 60;
export const MAX_NOTE = 200;

const codePattern = /^\d{4}$/;

export function isLockerSize(value: unknown): value is LockerSize {
  return typeof value === 'string' && value in lockerSizes;
}

export function assertLockerDraft(draft: LockerDraft) {
  const name = draft.name.trim();
  if (name.length < 2 || name.length > MAX_NAME) {
    throw new Error(`Give the locker a label between 2 and ${MAX_NAME} characters.`);
  }
  if (draft.location.trim().length < 3 || draft.location.length > MAX_LOCATION) {
    throw new Error(`Add a location under ${MAX_LOCATION} characters.`);
  }
  if (!isLockerSize(draft.size)) throw new Error('Choose a valid locker size.');
  if (!codePattern.test(draft.code)) {
    throw new Error('The pickup code must be exactly four digits.');
  }
  if (draft.parcel.trim().length < 2 || draft.parcel.length > MAX_PARCEL) {
    throw new Error('Describe the parcel in 2–120 characters.');
  }
  if (draft.recipient.trim().length < 1 || draft.recipient.length > MAX_RECIPIENT) {
    throw new Error('Add the recipient name.');
  }
  if (draft.note.length > MAX_NOTE) {
    throw new Error(`Keep the pickup note under ${MAX_NOTE} characters.`);
  }
}

export function buildManifest(draft: LockerDraft): LockerManifest {
  assertLockerDraft(draft);
  return {
    code: draft.code,
    parcel: draft.parcel.trim(),
    recipient: draft.recipient.trim(),
    note: draft.note.trim(),
  };
}

export function parseManifest(value: unknown): LockerManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The decrypted pickup manifest is not an object.');
  }
  const manifest = value as Record<string, unknown>;
  if (typeof manifest.code !== 'string' || !codePattern.test(manifest.code)) {
    throw new Error('The pickup manifest has an invalid code.');
  }
  if (typeof manifest.parcel !== 'string' || !manifest.parcel.trim()) {
    throw new Error('The pickup manifest is missing the parcel.');
  }
  if (typeof manifest.recipient !== 'string' || !manifest.recipient.trim()) {
    throw new Error('The pickup manifest is missing the recipient.');
  }
  if (typeof manifest.note !== 'string') {
    throw new Error('The pickup manifest note is malformed.');
  }
  return {
    code: manifest.code,
    parcel: manifest.parcel,
    recipient: manifest.recipient,
    note: manifest.note,
  };
}

export const shortHex = (value: string, head = 10, tail = 6) =>
  value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
