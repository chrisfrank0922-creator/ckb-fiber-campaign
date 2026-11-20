'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  scriptToAddress,
  type Channel,
  type FiberBrowserNode,
  type GetPaymentResult,
} from '@fiber-pay/sdk/browser';
import { channelFundingGuidance, readOnchainCapacity } from '../lib/channel-funding';
import {
  bottle,
  channelFundingCkb,
  faucetUrl,
  lockerSizes,
  priceCkb,
  priceShannons,
  type LockerSize,
} from '../lib/constants';
import { decryptJson, sha256Hex, toHex, verifyPreimage } from '../lib/crypto';
import {
  connectAndOpenChannel,
  isPeerConnected,
  readChannel,
  ready,
  startRole,
  type Role,
} from '../lib/fiber';
import { balanceRatio, formatBytes, formatCkb, padCode } from '../lib/format';
import { sealLocker } from '../lib/locker';
import {
  MAX_LOCATION,
  MAX_NAME,
  MAX_NOTE,
  MAX_PARCEL,
  MAX_RECIPIENT,
  parseManifest,
  shortHex,
  type LockerManifest,
} from '../lib/manifest';
import { parseAccessPass, type LockerAccessPass } from '../lib/access-pass';
import { createBrowserNodeSession } from '../lib/node-session';
import { payForLocker, validateAccessPass } from '../lib/payment';
import {
  customerProfileKey,
  operatorProfileKey,
  progressKey,
  readProgress,
  savedNodeIdentifier,
  type LockerProgress,
} from '../lib/progress';
import { sampleLocker } from '../lib/sample';

const roles = ['customer', 'operator'] as const;

const roleMeta = {
  customer: {
    name: 'Customer A',
    letter: 'A',
    line: 'Pays 1 CKB · collects the parcel',
    blurb: 'Funds the pickup and decrypts the manifest locally.',
  },
  operator: {
    name: 'Operator C',
    letter: 'C',
    line: 'Seals the locker · issues the invoice',
    blurb: 'Keeps the pickup code sealed until Fiber settles the invoice.',
  },
} satisfies Record<Role, { name: string; letter: string; line: string; blurb: string }>;

const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const ckb = (value: string) => formatCkb(value);

function timestampLabel(value?: string) {
  if (!value) return '';
  try {
    const ms = Number(BigInt(value));
    if (ms > 1_000_000_000_000) return new Date(ms).toLocaleString();
  } catch {
    /* Some nodes omit timestamps. */
  }
  return '';
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'lockerpay'
  );
}

function LockerDoor({ label, open }: { label: string; open: boolean }) {
  return (
    <div className={`door-demo ${open ? 'is-open' : ''}`} aria-label={`Locker ${label} ${open ? 'open' : 'closed'}`}>
      <div className="door-cavity" aria-hidden="true">
        <span className="door-parcel">PARCEL</span>
        <span className="door-cavity-label">{label}</span>
      </div>
      <div className="door-panel" aria-hidden="true">
        <span className="door-number">{label}</span>
        <span className="door-vents" />
        <span className="door-handle" />
        <span className={`door-led ${open ? 'is-open' : ''}`} />
      </div>
      {open && <span className="collected-stamp">COLLECTED</span>}
    </div>
  );
}

function LockerWall({ label, open }: { label: string; open: boolean }) {
  return (
    <div className="wall" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => {
        const number = String(index + 1).padStart(2, '0');
        const isTarget = index === 16;
        return (
          <div
            className={`wall-door ${isTarget ? 'is-target' : ''} ${isTarget && open ? 'is-open' : ''}`}
            key={number}
          >
            <div className="wall-cavity">
              <span className="wall-parcel" />
            </div>
            <div className="wall-panel">
              <span className="wall-number">{isTarget ? label : `A-${number}`}</span>
              <span className="wall-vents" />
              <span className="wall-handle" />
              <span className="wall-led" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Page() {
  const nodes = useRef<Partial<Record<Role, FiberBrowserNode>>>({});
  const sessions = useRef<Partial<Record<Role, ReturnType<typeof createBrowserNodeSession>>>>({});
  const progress = useRef<LockerProgress | null>(null);
  const locked = useRef(false);

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<Partial<Record<Role, string>>>({});
  const [onchain, setOnchain] = useState<Partial<Record<Role, bigint | null>>>({});
  const [connected, setConnected] = useState<Partial<Record<Role, boolean>>>({});
  const [channels, setChannels] = useState<Partial<Record<Role, Channel>>>({});

  const [name, setName] = useState(sampleLocker.name);
  const [location, setLocation] = useState(sampleLocker.location);
  const [size, setSize] = useState<LockerSize>(sampleLocker.size);
  const [code, setCode] = useState(sampleLocker.code);
  const [parcel, setParcel] = useState(sampleLocker.parcel);
  const [recipient, setRecipient] = useState(sampleLocker.recipient);
  const [note, setNote] = useState(sampleLocker.note);

  const [generated, setGenerated] = useState('');
  const [received, setReceived] = useState('');
  const [pass, setPass] = useState<LockerAccessPass | null>(null);
  const [attempt, setAttempt] = useState('');
  const [tested, setTested] = useState(false);
  const [lockRejected, setLockRejected] = useState(false);
  const [payment, setPayment] = useState<GetPaymentResult | null>(null);
  const [key, setKey] = useState('');
  const [preimageOk, setPreimageOk] = useState<boolean | null>(null);
  const [manifest, setManifest] = useState<LockerManifest | null>(null);
  const [digestOk, setDigestOk] = useState(false);
  const [codeEntry, setCodeEntry] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeTries, setCodeTries] = useState(0);
  const [doorOpen, setDoorOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const saved = readProgress(sessionStorage, localStorage);
    progress.current = saved;
    if (saved) {
      setGenerated(saved.generatedPass);
      setReceived(saved.customerPassText);
      setAttempt(saved.attemptedPaymentHash);
      setTested(saved.triedWithoutKey);
    }
    setLoaded(true);

    const owned = sessions.current;
    const stop = () => {
      for (const session of Object.values(owned)) void session.stop().catch(() => {});
    };
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
      nodes.current = {};
      sessions.current = {};
    };
  }, []);

  // Poll only while a started node is still waiting for its channel.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (locked.current) return;
      for (const role of roles) {
        const channel = channels[role];
        if (!nodes.current[role] || (channel && ready(channel))) continue;
        void refresh(role).catch(() => {});
      }
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [channels]);

  function save(update: Partial<LockerProgress>) {    const customerId = savedNodeIdentifier(localStorage, customerProfileKey);
    const operatorId = savedNodeIdentifier(localStorage, operatorProfileKey);
    // Restoring needs both identities. Skipping storage never blocks the demo.
    if (!customerId || !operatorId) return;
    const next: LockerProgress = {
      version: 1,
      customerId,
      operatorId,
      generatedPass: '',
      customerPassText: '',
      attemptedPaymentHash: '',
      triedWithoutKey: false,
      ...progress.current,
      ...update,
    };
    sessionStorage.setItem(progressKey, JSON.stringify(next));
    progress.current = next;
  }

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Action failed. Check status before retrying a transfer.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function refresh(role: Role) {
    const node = nodes.current[role];
    if (!node) return;
    const [channel, peerConnected] = await Promise.all([
      readChannel(node),
      isPeerConnected(node).catch(() => false),
    ]);
    setConnected((previous) => ({ ...previous, [role]: peerConnected }));
    setChannels((previous) => ({ ...previous, [role]: channel }));
  }

  function refreshOnchain(role: Role) {
    const node = nodes.current[role];
    if (!node) return;
    void readOnchainCapacity(node)
      .then((value) => setOnchain((previous) => ({ ...previous, [role]: value })))
      .catch(() => setOnchain((previous) => ({ ...previous, [role]: null })));
  }

  async function start(role: Role) {
    if (nodes.current[role]) return;
    const session = (sessions.current[role] ??= createBrowserNodeSession());
    let started: FiberBrowserNode | undefined;
    await session.start(role === 'customer' ? customerProfileKey : operatorProfileKey, async (track) => {
      started = await startRole(role, track);
    });
    if (!started) return;
    nodes.current[role] = started;
    const info = await started.nodeInfo();
    setAddresses((previous) => ({
      ...previous,
      [role]: scriptToAddress(info.default_funding_lock_script, 'testnet'),
    }));
    refreshOnchain(role);
    if (await readChannel(started)) await started.connectPeer(bottle).catch(() => {});
    await refresh(role);
    setStatus(`${roleMeta[role].name} is running. Fund its address, then open the channel.`);
  }

  async function open(role: Role) {
    const node = nodes.current[role];
    if (!node) return;
    const channel = await connectAndOpenChannel(node);
    setChannels((previous) => ({ ...previous, [role]: channel }));
    await refresh(role);
    refreshOnchain(role);
    setStatus(
      channel && ready(channel)
        ? `${roleMeta[role].name} channel is CHANNEL_READY.`
        : 'Channel opening submitted. Status refreshes automatically; confirmation can take a few minutes.',
    );
  }

  async function moveLiquidity() {
    const node = nodes.current.operator;
    if (!node) return;
    const id = savedNodeIdentifier(localStorage, operatorProfileKey);
    const storageKey = `lockerpay:inbound:${id}`;
    const existing = sessionStorage.getItem(storageKey);
    if (existing === 'submitting') {
      throw new Error('Transfer outcome unknown. Review payment history before sending again.');
    }
    let result: GetPaymentResult;
    if (existing) {
      result = await node.getPayment({ payment_hash: existing as `0x${string}` });
    } else {
      sessionStorage.setItem(storageKey, 'submitting');
      result = await node.sendPayment({
        target_pubkey: bottle.pubkey,
        amount: '0x1dcd65000', // 5 CKB
        keysend: true,
      });
      sessionStorage.setItem(storageKey, result.payment_hash);
    }
    if (!['Success', 'Failed'].includes(result.status)) {
      result = await node.waitForPayment(result.payment_hash, { timeout: 60_000, interval: 1_000 });
    }
    if (result.status === 'Failed') sessionStorage.removeItem(storageKey);
    setStatus(`Liquidity transfer: ${result.status}.`);
    await refresh('operator');
  }

  async function makePass() {
    if (!nodes.current.operator || !channels.operator || !routeReady || generated || attempt) return;
    const result = await sealLocker(nodes.current.operator, channels.operator, {
      name,
      location,
      size,
      code,
      parcel,
      recipient,
      note,
    });
    save({ generatedPass: result.json });
    setGenerated(result.json);
    setStatus('Locker sealed and 1 CKB invoice created. Send the access pass to the customer.');
  }

  async function validate() {
    if (!nodes.current.customer) return;
    const parsed = parseAccessPass(received);
    await validateAccessPass(nodes.current.customer, parsed);
    if (attempt && parsed.paymentHash.toLowerCase() !== attempt.toLowerCase()) {
      throw new Error('Restore the pass for the previous payment.');
    }
    save({ customerPassText: received });
    setPass(parsed);
    setLockRejected(tested);
    setStatus('Pass inspected. The locker listing is public; the pickup manifest is still sealed.');
  }

  async function testLock() {
    if (!pass) return;
    try {
      await decryptJson(pass, toHex(crypto.getRandomValues(new Uint8Array(32))));
      setError('Unexpected: the manifest decrypted without a payment key.');
    } catch {
      save({ triedWithoutKey: true });
      setTested(true);
      setLockRejected(true);
      setStatus('Access denied — the pass contains no pickup code without the payment key.');
    }
  }

  function acceptPayment(result: GetPaymentResult) {
    setPayment(result);
    setStatus(`Payment: ${result.status}.`);
    if (result.status === 'Failed') {
      setError(result.failed_error ?? 'Payment failed. Check route liquidity before retrying.');
      return;
    }
    if (result.status === 'Success') {
      if (result.payment_preimage) {
        setKey(result.payment_preimage);
        void verifyPreimage(result.payment_preimage, pass?.paymentHash ?? '')
          .then((value) => setPreimageOk(value))
          .catch(() => setPreimageOk(false));
      } else {
        setError('Payment settled, but the node did not return a preimage. Check payment status again.');
      }
    }
  }

  async function pay() {
    if (!nodes.current.customer || !pass || !tested || !routeReady) return;
    const result = await payForLocker(
      nodes.current.customer,
      pass,
      attempt,
      (hash) => {
        save({ attemptedPaymentHash: hash });
        setAttempt(hash);
      },
      payment?.status === 'Failed',
    );
    acceptPayment(result);
    await Promise.all([refresh('customer'), refresh('operator')]);
  }

  async function checkPayment() {
    if (!nodes.current.customer || !pass || !attempt) return;
    await validateAccessPass(nodes.current.customer, pass);
    acceptPayment(await nodes.current.customer.getPayment({ payment_hash: attempt as `0x${string}` }));
  }

  async function revealManifest() {
    if (!pass || !key) return;
    const { value, plaintext } = await decryptJson<unknown>(pass, key);
    const pickup = parseManifest(value);
    const digest = await sha256Hex(plaintext);
    const matches = digest.toLowerCase() === pass.contentHash.toLowerCase();
    setManifest(pickup);
    setDigestOk(matches);
    setStatus(
      matches
        ? 'Manifest decrypted. SHA-256 digest matches the published pass.'
        : 'Manifest decrypted, but the digest does not match the published pass.',
    );
  }

  function pressDigit(digit: string) {
    if (doorOpen || !manifest) return;
    setCodeError('');
    setCodeEntry((previous) => (previous.length >= 4 ? previous : previous + digit));
  }

  function submitCode() {
    if (!manifest || !pass || doorOpen) return;
    if (codeEntry.length !== 4) {
      setCodeError('Enter all four digits.');
      return;
    }
    if (codeEntry === manifest.code) {
      setDoorOpen(true);
      setCodeError('');
      setStatus(`Locker ${pass.locker.name} unlocked. Collect your parcel.`);
      return;
    }
    setCodeTries((previous) => previous + 1);
    setCodeError('Code rejected by the locker. Check the manifest and try again.');
    setCodeEntry('');
  }

  function startAnotherLocker() {
    if (busy || (attempt && payment?.status !== 'Failed')) return;
    save({
      generatedPass: '',
      customerPassText: '',
      attemptedPaymentHash: '',
      triedWithoutKey: false,
    });
    setGenerated('');
    setReceived('');
    setPass(null);
    setAttempt('');
    setTested(false);
    setLockRejected(false);
    setPayment(null);
    setKey('');
    setPreimageOk(null);
    setManifest(null);
    setDigestOk(false);
    setCodeEntry('');
    setCodeError('');
    setCodeTries(0);
    setDoorOpen(false);
    setError('');
    setName(sampleLocker.name);
    setLocation(sampleLocker.location);
    setSize(sampleLocker.size);
    setCode(sampleLocker.code);
    setParcel(sampleLocker.parcel);
    setRecipient(sampleLocker.recipient);
    setNote(sampleLocker.note);
    setStatus('Ready to seal a fresh locker.');
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1_600);
    } catch {
      setError('Clipboard access was blocked. Select the text and copy it manually.');
    }
  }

  function download(filename: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const published = useMemo(() => {
    if (!generated) return null;
    try {
      return parseAccessPass(generated);
    } catch {
      return null;
    }
  }, [generated]);

  const bay = pass ?? published;
  const customerChannel = channels.customer;
  const operatorChannel = channels.operator;
  const routeReady = Boolean(
    connected.customer &&
      connected.operator &&
      customerChannel &&
      ready(customerChannel) &&
      BigInt(customerChannel.local_balance) >= 100_000_000n &&
      operatorChannel &&
      ready(operatorChannel) &&
      BigInt(operatorChannel.remote_balance) >= 100_000_000n,
  );
  const routeCapacity =
    customerChannel && operatorChannel
      ? BigInt(customerChannel.local_balance) < BigInt(operatorChannel.remote_balance)
        ? BigInt(customerChannel.local_balance)
        : BigInt(operatorChannel.remote_balance)
      : null;
  const canPay = Boolean(
    pass && tested && routeReady && !key && (!attempt || payment?.status === 'Failed'),
  );
  const channelsReady = Boolean(
    customerChannel &&
      ready(customerChannel) &&
      operatorChannel &&
      ready(operatorChannel) &&
      connected.customer &&
      connected.operator,
  );
  const steps = [
    { label: 'Start nodes', done: Boolean(addresses.customer && addresses.operator) },
    { label: 'Open channels', done: channelsReady },
    { label: 'Seal locker', done: Boolean(generated) },
    { label: 'Pay & collect', done: doorOpen },
  ];
  const activeStep = steps.findIndex((step) => !step.done);

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">LP</span>
          <span>
            LockerPay
            <small>parcel access on Fiber</small>
          </span>
        </a>
        <nav className="nav">
          <a href="#setup">Setup</a>
          <a href="#bank">The bank</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="network-stamp">
          <span className="lamp" /> CKB Testnet
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Paid parcel access · Fiber Network</p>
            <h1>
              Your parcel is waiting.
              <em>Your key is a payment.</em>
            </h1>
            <p className="hero-lead">
              A locker operator seals the pickup manifest — code, parcel, recipient — with a fresh
              AES-256-GCM key. That key becomes the preimage of a 1 CKB Fiber invoice. Pay the
              invoice, decode the code, and the locker opens. No account, no courier app, no trusted
              middleman holding your parcel hostage.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#setup">
                Start the demo
              </a>
              <a className="btn btn-ghost" href="#how">
                Read the mechanics
              </a>
            </div>
            <ul className="hero-facts">
              <li>
                <strong>1 CKB</strong>
                <span>per pickup</span>
              </li>
              <li>
                <strong>AES-256-GCM</strong>
                <span>sealed manifest</span>
              </li>
              <li>
                <strong>SHA-256</strong>
                <span>two checks</span>
              </li>
              <li>
                <strong>0</strong>
                <span>codes in the pass</span>
              </li>
            </ul>
          </div>

          <aside className="machine">
            <div className="machine-head">
              <div>
                <span className="machine-kicker">Northgate Station</span>
                <strong>Bank 02</strong>
              </div>
              <span className={`machine-state ${doorOpen ? 'is-open' : ''}`}>
                <span className="lamp" /> {doorOpen ? 'BAY OPEN' : 'ONLINE'}
              </span>
            </div>
            <LockerWall label={bay?.locker.name ?? 'A-17'} open={doorOpen} />
            <div className="machine-foot">
              <span>
                {bay?.locker.name ?? 'A-17'} · {(bay?.locker.size ?? 'Medium').toUpperCase()} ·{' '}
                {doorOpen ? 'COLLECTED' : 'SEALED'}
              </span>
              <span className="barcode" aria-hidden="true" />
            </div>
          </aside>
        </section>

        <ol className="stepper">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={step.done ? 'is-done' : index === activeStep ? 'is-active' : ''}
            >
              <span>{step.done ? '✓' : String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.done ? 'Complete' : index === activeStep ? 'In progress' : 'Up next'}</small>
              </div>
            </li>
          ))}
        </ol>

        {(status || error) && (
          <div className="notices">
            {status && (
              <p className="notice" role="status" aria-live="polite">
                <span className="notice-icon">↗</span>
                {status}
              </p>
            )}
            {error && (
              <p className="notice notice-error" role="alert">
                <span className="notice-icon">!</span>
                {error}
              </p>
            )}
          </div>
        )}

        <section className="section" id="setup">
          <div className="section-head">
            <span className="section-number">01</span>
            <div>
              <p className="kicker">Testnet setup</p>
              <h2>Bring two nodes to the bank</h2>
              <p className="section-desc">
                Each browser tab runs a real Fiber node. Fund both addresses, open a 500 CKB channel
                to Bottle B from each side, and wait for <code>CHANNEL_READY</code>.
              </p>
            </div>
          </div>

          <div className="node-grid">
            {roles.map((role) => {
              const meta = roleMeta[role];
              const channel = channels[role];
              const channelIsReady = channel ? ready(channel) : false;
              const localPercent = channel
                ? balanceRatio(channel.local_balance, channel.remote_balance)
                : 0;
              const balance = onchain[role];
              return (
                <article className={`node-card ${addresses[role] ? 'is-live' : ''}`} key={role}>
                  <div className="node-head">
                    <div className="node-title">
                      <span className="node-letter">{meta.letter}</span>
                      <div>
                        <h3>{meta.name}</h3>
                        <p>{meta.line}</p>
                      </div>
                    </div>
                    <span className={`status-chip ${addresses[role] ? 'is-on' : ''}`}>
                      {addresses[role] ? (connected[role] ? 'RUNNING' : 'STARTED') : 'IDLE'}
                    </span>
                  </div>

                  {!addresses[role] ? (
                    <div className="node-start">
                      <p>{meta.blurb}</p>
                      <button
                        className="btn btn-primary"
                        disabled={!loaded || busy}
                        onClick={() => void run(() => start(role))}
                      >
                        Start {meta.name}
                      </button>
                      <span className="fineprint">
                        A fresh keypair is generated locally. It is saved in this browser only.
                      </span>
                    </div>
                  ) : (
                    <div className="node-body">
                      <div className="field-label-row">
                        <span className="field-label">Funding address</span>
                        <button
                          className="link-button"
                          onClick={() => void copy(addresses[role]!, `${role}-address`)}
                        >
                          {copied === `${role}-address` ? 'Copied ✓' : 'Copy'}
                        </button>
                      </div>
                      <code className="address">{addresses[role]}</code>

                      <div className="funding-row">
                        <div>
                          <span className="field-label">On-chain CKB</span>
                          <strong
                            className={
                              balance !== undefined &&
                              balance !== null &&
                              balance <= 50_000_000_000n
                                ? 'text-warn'
                                : ''
                            }
                          >
                            {balance === undefined
                              ? 'Checking…'
                              : balance === null
                                ? 'Unavailable'
                                : `${formatCkb(balance)} CKB`}
                          </strong>
                        </div>
                        <div className="funding-actions">
                          <button className="link-button" onClick={() => refreshOnchain(role)}>
                            Refresh
                          </button>
                          <a className="link-button" href={faucetUrl} target="_blank" rel="noreferrer">
                            Faucet ↗
                          </a>
                        </div>
                      </div>

                      {channel ? (
                        <div className="channel-box">
                          <div className="channel-head">
                            <div>
                              <span className="field-label">Channel with Bottle B</span>
                              <strong>{shortHex(channel.channel_id, 12, 8)}</strong>
                            </div>
                            <span className={`pill ${channelIsReady ? 'pill-ok' : 'pill-wait'}`}>
                              {channel.state.state_name.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="balance-labels">
                            <span>
                              You <b>{ckb(channel.local_balance)} CKB</b>
                            </span>
                            <span>
                              Bottle <b>{ckb(channel.remote_balance)} CKB</b>
                            </span>
                          </div>
                          <div className="balance-bar" aria-hidden="true">
                            <span style={{ width: `${localPercent}%` }} />
                            <span />
                          </div>
                          <div className="channel-actions">
                            <button
                              className="btn btn-secondary btn-small"
                              disabled={busy}
                              onClick={() => void run(() => open(role))}
                            >
                              Reconnect / refresh
                            </button>
                            <button
                              className="link-button"
                              disabled={busy}
                              onClick={() => void run(() => refresh(role))}
                            >
                              Read status
                            </button>
                          </div>
                          {!channelIsReady && (
                            <p className="fineprint">
                              Waiting for confirmation. This card refreshes while the tab is visible.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="channel-box channel-empty">
                          <span className="field-label">Channel with Bottle B</span>
                          <p className="fineprint">{channelFundingGuidance}</p>
                          <button
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() => void run(() => open(role))}
                          >
                            Open {channelFundingCkb.toString()} CKB channel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="route-card">
            <div className="route-head">
              <span className="kicker">Live route</span>
              <span className={`pill ${routeReady ? 'pill-ok' : 'pill-wait'}`}>
                {routeReady ? 'READY TO PAY' : 'WAITING FOR LIQUIDITY'}
              </span>
            </div>
            <div className="route-visual">
              <div className="route-node">
                <span className="node-letter">A</span>
                <div>
                  <strong>Customer A</strong>
                  <small>
                    {customerChannel
                      ? `${ckb(customerChannel.local_balance)} CKB outbound`
                      : 'channel not open'}
                  </small>
                </div>
              </div>
              <div className="route-wire">
                <span>{customerChannel ? `${ckb(customerChannel.local_balance)} CKB` : 'A–B'}</span>
              </div>
              <div className="route-node route-bottle">
                <span className="node-letter">B</span>
                <div>
                  <strong>Bottle B</strong>
                  <small>public forwarding node</small>
                </div>
              </div>
              <div className="route-wire">
                <span>{operatorChannel ? `${ckb(operatorChannel.remote_balance)} CKB` : 'B–C'}</span>
              </div>
              <div className="route-node">
                <span className="node-letter">C</span>
                <div>
                  <strong>Operator C</strong>
                  <small>
                    {operatorChannel
                      ? `${ckb(operatorChannel.local_balance)} CKB on its side`
                      : 'channel not open'}
                  </small>
                </div>
              </div>
            </div>
            <p className="route-note">
              {routeCapacity === null
                ? 'Open both channels to see the usable route capacity.'
                : `Usable route capacity ≈ ${formatCkb(routeCapacity)} CKB before fees. Bottle forwards from its side of B–C.`}
            </p>
            <details className="liquidity">
              <summary>Route liquidity helper</summary>
              <p>
                If Bottle&apos;s side of B–C is below 1 CKB, Operator C can send 5 CKB to Bottle. That
                moves balance onto Bottle&apos;s side so it can forward the pickup payment.
              </p>
              <button
                className="btn btn-secondary btn-small"
                disabled={
                  busy ||
                  !operatorChannel ||
                  !ready(operatorChannel) ||
                  BigInt(operatorChannel.local_balance) < 500_000_000n
                }
                onClick={() => void run(moveLiquidity)}
              >
                Send / check 5 CKB transfer
              </button>
            </details>
          </div>
        </section>

        <section className="section" id="bank">
          <div className="section-head">
            <span className="section-number">02</span>
            <div>
              <p className="kicker">The locker bank</p>
              <h2>Seal. Pay. Open the door.</h2>
              <p className="section-desc">
                Operator C publishes the public listing and seals the private pickup manifest. The
                customer pays the invoice, receives the preimage, and uses it to reveal the code.
              </p>
            </div>
          </div>

          <div className="studio-grid">
            <section className="panel" id="operator">
              <div className="panel-head">
                <div>
                  <p className="kicker">Operator C</p>
                  <h3>Seal a locker</h3>
                </div>
                <span className="panel-tag">AES-256-GCM</span>
              </div>

              {!published ? (
                <>
                  <div className="field-pair">
                    <label className="field">
                      <span>
                        Locker label <small>{name.length}/{MAX_NAME}</small>
                      </span>
                      <input
                        value={name}
                        maxLength={MAX_NAME}
                        disabled={busy || Boolean(generated || attempt)}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="A-17"
                      />
                    </label>
                    <label className="field">
                      <span>Size</span>
                      <select
                        value={size}
                        disabled={busy || Boolean(generated || attempt)}
                        onChange={(event) => setSize(event.target.value as LockerSize)}
                      >
                        {Object.keys(lockerSizes).map((value) => (
                          <option value={value} key={value}>
                            {value} · {lockerSizes[value as LockerSize]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    <span>
                      Location <small>{location.length}/{MAX_LOCATION}</small>
                    </span>
                    <input
                      value={location}
                      maxLength={MAX_LOCATION}
                      disabled={busy || Boolean(generated || attempt)}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="Station, bank, and bay"
                    />
                  </label>

                  <div className="field-pair">
                    <label className="field">
                      <span>Pickup code</span>
                      <input
                        className="code-input"
                        value={code}
                        inputMode="numeric"
                        maxLength={4}
                        disabled={busy || Boolean(generated || attempt)}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="0000"
                      />
                      <small className="field-hint">Four digits. Sealed inside the manifest.</small>
                    </label>
                    <label className="field">
                      <span>
                        Recipient <small>{recipient.length}/{MAX_RECIPIENT}</small>
                      </span>
                      <input
                        value={recipient}
                        maxLength={MAX_RECIPIENT}
                        disabled={busy || Boolean(generated || attempt)}
                        onChange={(event) => setRecipient(event.target.value)}
                        placeholder="Who collects it"
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>
                      Parcel description <small>{parcel.length}/{MAX_PARCEL}</small>
                    </span>
                    <input
                      value={parcel}
                      maxLength={MAX_PARCEL}
                      disabled={busy || Boolean(generated || attempt)}
                      onChange={(event) => setParcel(event.target.value)}
                      placeholder="What is inside the locker"
                    />
                  </label>

                  <label className="field">
                    <span>
                      Pickup note <small>{note.length}/{MAX_NOTE}</small>
                    </span>
                    <textarea
                      rows={3}
                      value={note}
                      maxLength={MAX_NOTE}
                      disabled={busy || Boolean(generated || attempt)}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Handling instructions for the recipient"
                    />
                  </label>

                  {generated && !published && (
                    <p className="callout callout-danger">
                      The saved pass could not be read. Reset it and seal the locker again.
                      <button className="link-button" onClick={startAnotherLocker}>
                        Reset
                      </button>
                    </p>
                  )}

                  <button
                    className="btn btn-primary btn-wide"
                    disabled={
                      busy ||
                      !routeReady ||
                      !name.trim() ||
                      !location.trim() ||
                      code.length !== 4 ||
                      !parcel.trim() ||
                      !recipient.trim() ||
                      Boolean(generated || attempt)
                    }
                    onClick={() => void run(makePass)}
                  >
                    Seal locker &amp; create 1 CKB invoice
                  </button>
                  <p className="fineprint">
                    {routeReady
                      ? 'The public pass will list the locker, size, and invoice. The code, parcel, recipient, and note stay encrypted until payment.'
                      : 'Open both channels and confirm the route is ready before sealing a locker.'}
                  </p>
                  <button
                    className="link-button align-start"
                    disabled={busy || Boolean(generated || attempt)}
                    onClick={() => {
                      setName(sampleLocker.name);
                      setLocation(sampleLocker.location);
                      setSize(sampleLocker.size);
                      setCode(sampleLocker.code);
                      setParcel(sampleLocker.parcel);
                      setRecipient(sampleLocker.recipient);
                      setNote(sampleLocker.note);
                      setStatus('Sample locker loaded.');
                    }}
                  >
                    Load sample locker
                  </button>
                </>
              ) : (
                <>
                  <div className="published-head">
                    <div>
                      <span className="pill pill-ok">SEALED</span>
                      <h3>Locker {published.locker.name}</h3>
                      <p className="published-location">{published.locker.location}</p>
                    </div>
                    <span className="price-badge">
                      <strong>1</strong> CKB
                    </span>
                  </div>

                  <div className="listing-card">
                    <div>
                      <span className="mini-label">Size</span>
                      <strong>{published.locker.size}</strong>
                    </div>
                    <div>
                      <span className="mini-label">Dimensions</span>
                      <strong>{published.locker.dimensions}</strong>
                    </div>
                    <div>
                      <span className="mini-label">Contents</span>
                      <strong className="redacted">SEALED</strong>
                    </div>
                  </div>

                  <div className="meta-grid">
                    <div>
                      <span>Manifest</span>
                      <strong>4 private fields</strong>
                    </div>
                    <div>
                      <span>Ciphertext</span>
                      <strong>{formatBytes((published.ciphertext.length - 2) / 2)}</strong>
                    </div>
                    <div>
                      <span>Digest</span>
                      <strong className="mono">{shortHex(published.contentHash, 8, 6)}</strong>
                    </div>
                    <div>
                      <span>Invoice</span>
                      <strong className="mono">{shortHex(published.invoice, 10, 6)}</strong>
                    </div>
                  </div>

                  <div className="sealed-note">
                    <span className="lock-badge">▣</span>
                    <div>
                      <strong>The pickup manifest is sealed</strong>
                      <p>
                        Code, parcel, recipient, and note are encrypted locally. Only the payment
                        preimage can open them.
                      </p>
                    </div>
                  </div>

                  <div className="published-actions">
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => void copy(generated, 'pass')}
                    >
                      {copied === 'pass' ? 'Copied ✓' : 'Copy access pass'}
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() =>
                        download(`${slug(published.locker.name)}-access-pass.json`, generated, 'application/json')
                      }
                    >
                      Download JSON
                    </button>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => {
                        setReceived(generated);
                        setStatus('Access pass loaded into the customer panel. Inspect it to begin.');
                        document.getElementById('customer')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Send to customer →
                    </button>
                  </div>

                  <details className="json-details">
                    <summary>View public access pass JSON</summary>
                    <pre>{generated}</pre>
                  </details>

                  {(!attempt || payment?.status === 'Failed') && (
                    <button
                      className="link-button align-start"
                      disabled={busy}
                      onClick={() => void run(async () => startAnotherLocker())}
                    >
                      Seal another locker
                    </button>
                  )}
                </>
              )}
            </section>

            <section className="panel" id="customer">
              <div className="panel-head">
                <div>
                  <p className="kicker">Customer A</p>
                  <h3>Collect a parcel</h3>
                </div>
                <span className="panel-tag">1 CKB</span>
              </div>

              {!pass ? (
                <>
                  <label className="field">
                    <span>Access pass</span>
                    <textarea
                      className="code-input"
                      rows={10}
                      value={received}
                      disabled={busy || Boolean(pass || attempt)}
                      onChange={(event) => {
                        setReceived(event.target.value);
                        setTested(false);
                        setLockRejected(false);
                      }}
                      placeholder="Paste the JSON access pass the operator shared…"
                    />
                    <small className="field-hint">
                      The pass contains the public listing, invoice, ciphertext, IV, and last-hop
                      hint. It does not contain the pickup code.
                    </small>
                  </label>
                  <button
                    className="btn btn-secondary btn-wide"
                    disabled={busy || !received.trim() || !addresses.customer}
                    onClick={() => void run(validate)}
                  >
                    Inspect access pass
                  </button>
                  <p className="fineprint">
                    {addresses.customer
                      ? 'Inspecting checks the invoice network, amount, and payment hash before any payment is submitted.'
                      : 'Start Customer A above before inspecting a pass.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="ticket">
                    <div className="ticket-head">
                      <div>
                        <span className="mini-label">Claim ticket</span>
                        <h3>Locker {pass.locker.name}</h3>
                        <p>{pass.locker.location}</p>
                      </div>
                      <span className="price-badge">
                        <strong>1</strong> CKB
                      </span>
                    </div>
                    <dl className="ticket-rows">
                      <div>
                        <dt>Locker size</dt>
                        <dd>
                          {pass.locker.size} · {pass.locker.dimensions}
                        </dd>
                      </div>
                      <div>
                        <dt>Contents</dt>
                        <dd className="redacted">SEALED</dd>
                      </div>
                      <div>
                        <dt>Pickup code</dt>
                        <dd className="mono">••••</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{key ? 'KEY RECEIVED' : 'AWAITING PAYMENT'}</dd>
                      </div>
                    </dl>
                    <span className="ticket-cut" aria-hidden="true" />
                  </div>

                  {!manifest && (
                    <div className="sealed-box">
                      <div className="sealed-lines" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="sealed-overlay">
                        <span className="lock-badge">▣</span>
                        <strong>Pickup manifest sealed</strong>
                        <p>The code, parcel, and recipient are inside the ciphertext.</p>
                      </div>
                    </div>
                  )}

                  {!tested ? (
                    <button
                      className="btn btn-secondary btn-wide"
                      disabled={busy || Boolean(key)}
                      onClick={() => void run(testLock)}
                    >
                      Try the locker without paying
                    </button>
                  ) : (
                    lockRejected &&
                    !manifest && (
                      <div className="callout callout-danger">
                        <strong>Access denied.</strong> The pass contains no pickup code, and the
                        ciphertext fails without the payment key. It arrives only when Fiber settles
                        the invoice.
                      </div>
                    )
                  )}

                  {!routeReady && !key && (
                    <p className="fineprint">
                      Payment is disabled until both channels are <code>CHANNEL_READY</code> and the
                      route has at least 1 CKB on both hops.
                    </p>
                  )}

                  {canPay && (
                    <button className="btn btn-primary btn-wide" disabled={busy} onClick={() => void run(pay)}>
                      {attempt ? 'Retry failed payment' : `Pay ${priceCkb} CKB to reveal the code`}
                    </button>
                  )}

                  {attempt && !key && (
                    <button
                      className="btn btn-secondary btn-wide"
                      disabled={busy}
                      onClick={() => void run(checkPayment)}
                    >
                      Check payment status
                    </button>
                  )}

                  {payment?.status === 'Success' && (
                    <div className="receipt">
                      <span className="paid-stamp" aria-hidden="true">
                        PAID
                      </span>
                      <div className="receipt-head">
                        <span className="receipt-check">✓</span>
                        <div>
                          <strong>Payment settled</strong>
                          <small>
                            Fiber Testnet
                            {timestampLabel(payment.created_at)
                              ? ` · ${timestampLabel(payment.created_at)}`
                              : ''}
                          </small>
                        </div>
                      </div>
                      <dl className="receipt-rows">
                        <div>
                          <dt>Locker</dt>
                          <dd>{pass.locker.name}</dd>
                        </div>
                        <div>
                          <dt>Amount</dt>
                          <dd>1 CKB</dd>
                        </div>
                        <div>
                          <dt>Routing fee</dt>
                          <dd>{formatCkb(payment.fee ?? '0x0', 4)} CKB</dd>
                        </div>
                        <div>
                          <dt>Total paid</dt>
                          <dd>{formatCkb(BigInt(priceShannons) + BigInt(payment.fee ?? '0x0'), 4)} CKB</dd>
                        </div>
                        <div>
                          <dt>Payment hash</dt>
                          <dd className="mono receipt-hash">{payment.payment_hash}</dd>
                        </div>
                      </dl>
                      <div className="receipt-foot">
                        <button
                          className="link-button"
                          onClick={() => void copy(payment.payment_hash, 'hash')}
                        >
                          {copied === 'hash' ? 'Copied ✓' : 'Copy payment hash'}
                        </button>
                        {preimageOk !== null && (
                          <p className={preimageOk ? 'verify verify-ok' : 'verify verify-bad'}>
                            {preimageOk
                              ? 'Preimage verified: SHA-256(key) matches the invoice hash.'
                              : 'Preimage check failed. Do not trust this result.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {key && !manifest && (
                    <div className="unlock-box">
                      <div>
                        <span className="mini-label">Key revealed by the payment</span>
                        <p>
                          The settlement preimage is now your AES key. Open the manifest to get the
                          pickup code.
                        </p>
                      </div>
                      <button className="btn btn-primary" disabled={busy} onClick={() => void run(revealManifest)}>
                        Decrypt manifest
                      </button>
                    </div>
                  )}

                  {manifest && (
                    <div className="manifest-card">
                      <div className="manifest-head">
                        <div>
                          <span className="mini-label">Pickup manifest</span>
                          <h3>Locker {pass.locker.name}</h3>
                        </div>
                        <span className={`pill ${digestOk ? 'pill-ok' : 'pill-warn'}`}>
                          {digestOk ? 'DIGEST VERIFIED' : 'DIGEST MISMATCH'}
                        </span>
                      </div>

                      <div className="manifest-grid">
                        <div>
                          <span className="mini-label">Parcel</span>
                          <strong>{manifest.parcel}</strong>
                        </div>
                        <div>
                          <span className="mini-label">Recipient</span>
                          <strong>{manifest.recipient}</strong>
                        </div>
                      </div>
                      {manifest.note && <p className="manifest-note">{manifest.note}</p>}

                      <div className="code-block">
                        <span className="mini-label">Pickup code</span>
                        <div className="code-digits">
                          {manifest.code.split('').map((digit, index) => (
                            <span key={index}>{digit}</span>
                          ))}
                        </div>
                      </div>

                      <div className="unlock-grid">
                        <div className="terminal">
                          <div className="terminal-head">
                            <span>LOCKER TERMINAL</span>
                            <span className={doorOpen ? 'terminal-state is-open' : 'terminal-state'}>
                              {doorOpen ? 'OPEN' : 'SEALED'}
                            </span>
                          </div>
                          <div className="code-display" aria-live="polite">
                            {padCode(codeEntry).split('').map((digit, index) => (
                              <span key={index} className={digit === '·' ? 'is-empty' : ''}>
                                {digit}
                              </span>
                            ))}
                          </div>
                          <div className="keypad">
                            {digits.map((digit) => (
                              <button
                                key={digit}
                                type="button"
                                disabled={busy || doorOpen}
                                onClick={() => pressDigit(digit)}
                              >
                                {digit}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="keypad-clear"
                              disabled={busy || doorOpen}
                              onClick={() => {
                                setCodeEntry('');
                                setCodeError('');
                              }}
                            >
                              CLR
                            </button>
                            <button
                              type="button"
                              disabled={busy || doorOpen}
                              onClick={() => pressDigit('0')}
                            >
                              0
                            </button>
                            <button
                              type="button"
                              className="keypad-enter"
                              disabled={busy || doorOpen || codeEntry.length !== 4}
                              onClick={submitCode}
                            >
                              OPEN
                            </button>
                          </div>
                          {codeError && <p className="code-error">{codeError}</p>}
                          {!codeError && !doorOpen && (
                            <p className="terminal-hint">
                              Enter the four-digit code shown above.
                              {codeTries > 0 ? ` Rejected attempts: ${codeTries}.` : ''}
                            </p>
                          )}
                          {doorOpen && (
                            <p className="terminal-success">Door released. Take your parcel.</p>
                          )}
                        </div>

                        <div className="door-stage">
                          <LockerDoor label={pass.locker.name} open={doorOpen} />
                          <span className="door-stage-label">
                            {doorOpen ? 'BAY OPEN · COLLECTED' : 'BAY LOCKED'}
                          </span>
                        </div>
                      </div>

                      <p className="fineprint mono">SHA-256 {pass.contentHash}</p>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </section>

        <section className="section" id="how">
          <div className="section-head">
            <span className="section-number">03</span>
            <div>
              <p className="kicker">Why it works</p>
              <h2>A parcel, a payment, and a preimage</h2>
              <p className="section-desc">
                The locker never trusts a server to release the code. The payment itself is the
                handover.
              </p>
            </div>
          </div>
          <div className="explain-grid">
            <article className="explain-card">
              <span className="explain-icon">◈</span>
              <h3>Sealed before it ships</h3>
              <p>
                AES-256-GCM runs in the browser. The IV travels with the ciphertext; the key stays
                with the operator node until the invoice settles.
              </p>
            </article>
            <article className="explain-card">
              <span className="explain-icon">⌁</span>
              <h3>The invoice is the lock</h3>
              <p>
                Fiber invoices commit to SHA-256(preimage). The operator sets the AES key as that
                preimage, so paying is the only way to learn it.
              </p>
            </article>
            <article className="explain-card">
              <span className="explain-icon">✓</span>
              <h3>The customer can verify</h3>
              <p>
                After settlement, the customer checks the revealed preimage against the payment hash
                and the decrypted manifest against its published SHA-256 digest.
              </p>
            </article>
          </div>
          <p className="boundary-note">
            <strong>What payment guarantees:</strong> the released key opens this exact manifest. It
            does not prove the parcel is inside the locker or that the listing is honest. In a real
            deployment, the operator would also sign the listing and the locker hardware would
            verify the code locally.
          </p>
        </section>
      </main>

      <footer className="footer">
        <div>
          <span className="brand-mark small">LP</span>
          <span>
            LockerPay
            <small>Built on the Fiber encrypted-data starter.</small>
          </span>
        </div>
        <p>Testnet only. The locker and parcel are fictional. Never send Mainnet CKB to these addresses.</p>
        <a
          href="https://www.fiber.world/docs/build/encrypted-data-payment"
          target="_blank"
          rel="noreferrer"
        >
          Fiber tutorial ↗
        </a>
      </footer>
    </div>
  );
}
