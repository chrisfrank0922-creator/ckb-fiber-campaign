/** Shared constants for the LockerPay demo. */

export const bottle = {
  pubkey:
    '0x02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71' as const,
  address: '/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo',
};

/** Channel V2 reserves 100 CKB of this for settlement, leaving 400 CKB spendable. */
export const channelFundingCkb = 500n;

export const priceCkb = 1;
export const priceShannons = '0x5f5e100' as const;

export const faucetUrl = 'https://faucet.nervos.org';

export const lockerSizes = {
  Small: '30 × 22 × 15 cm',
  Medium: '40 × 30 × 20 cm',
  Large: '55 × 40 × 30 cm',
} as const;

export type LockerSize = keyof typeof lockerSizes;
