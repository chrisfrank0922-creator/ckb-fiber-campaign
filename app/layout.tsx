import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LockerPay — paid parcel access on Fiber',
  description:
    'A smart-locker demo on CKB Testnet. The pickup code is sealed with AES-256-GCM, sold through a 1 CKB Fiber invoice, and revealed by the payment preimage.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
