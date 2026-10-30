import { useEffect, useRef, useState } from 'react';
import { SoundLink } from './audio';
import { packTest, unpackTest } from './codec';
import './link.css';

interface Props {
  onBack: () => void;
}

interface Stats {
  sent: number;
  acked: number;
  retries: number;
  failed: number;
  received: number;
}

const ZERO: Stats = { sent: 0, acked: 0, retries: 0, failed: 0, received: 0 };
const hex = (v: number) => v.toString(16).toUpperCase().padStart(3, '0');

export default function SoundLinkTest({ onBack }: Props) {
  const linkRef = useRef<SoundLink | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [level, setLevel] = useState(-120);
  const [tx, setTx] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selfHear, setSelfHear] = useState(false);
  const [stats, setStats] = useState<Stats>(ZERO);
  const [lastRx, setLastRx] = useState('–');
  const [lastTx, setLastTx] = useState('–');
  const [symbols, setSymbols] = useState<number[]>([]);
  const [report, setReport] = useState('');

  useEffect(() => {
    return () => linkRef.current?.close();
  }, []);

  const bump = (patch: Partial<Stats>) =>
    setStats((s) => {
      const n = { ...s };
      for (const k of Object.keys(patch) as (keyof Stats)[]) n[k] += patch[k] ?? 0;
      return n;
    });

  async function enable() {
    setError('');
    try {
      const link = new SoundLink();
      link.ev = {
        onLevel: (db) => setLevel(db),
        onTx: setTx,
        onSymbol: (s) => setSymbols((a) => [...a.slice(-15), s]),
        onFrame: (f) => {
          if (f.type === 'test') {
            setLastRx(hex(unpackTest(f.payload)));
            bump({ received: 1 });
          }
        },
      };
      await link.listen();
      linkRef.current = link;
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function sendOne(): Promise<boolean> {
    const link = linkRef.current;
    if (!link) return false;
    const v = Math.floor(Math.random() * 4096);
    setLastTx(hex(v));
    bump({ sent: 1 });
    const attempts = await link.sendReliable('test', packTest(v));
    if (attempts > 0) bump({ acked: 1, retries: attempts - 1 });
    else bump({ failed: 1, retries: 4 });
    return attempts > 0;
  }

  async function send() {
    setBusy(true);
    await sendOne();
    setBusy(false);
  }

  async function loopback() {
    const link = linkRef.current;
    if (!link) return;
    setBusy(true);
    setReport('Running…');
    const prev = link.selfHear;
    link.selfHear = true;
    let ok = 0;
    const N = 5;
    for (let i = 0; i < N; i++) if (await sendOne()) ok++;
    link.selfHear = prev;
    setReport(`Loopback: ${ok}/${N} acknowledged${ok === N ? ' ✔' : ok === 0 ? ' – speaker→mic path not working (volume? mic blocked?)' : ''}`);
    setBusy(false);
  }

  function toggleSelf() {
    const link = linkRef.current;
    const v = !selfHear;
    setSelfHear(v);
    if (link) link.selfHear = v;
  }

  const pct = Math.max(0, Math.min(100, ((level + 100) / 70) * 100));
  const rate = stats.sent ? Math.round((stats.acked / stats.sent) * 100) : null;

  return (
    <div className="link-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="home-title">Sound Link Test</h1>

      {!ready ? (
        <>
          <p className="link-note">Open this on two phones, put them close together at medium volume. Needs microphone access.</p>
          <button className="link-btn primary" onClick={enable}>Enable sound &amp; microphone</button>
          {error && <p className="link-error">{error}</p>}
        </>
      ) : (
        <>
          <div className="link-meter" title="Tone level at the three bands">
            <div className="link-meter-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="link-sub">{tx ? '🔊 sending…' : '🎤 listening'} · level {level.toFixed(0)} dB</p>

          <div className="link-row">
            <button className="link-btn primary" onClick={send} disabled={busy}>Send test message</button>
            <button className="link-btn" onClick={loopback} disabled={busy}>Loopback self-test</button>
          </div>
          <label className="link-check">
            <input type="checkbox" checked={selfHear} onChange={toggleSelf} /> Hear myself (for single-device tests)
          </label>
          {report && <p className="link-sub">{report}</p>}

          <div className="link-stats">
            <div><b>{stats.sent}</b><span>sent</span></div>
            <div><b>{stats.acked}</b><span>acked</span></div>
            <div><b>{stats.retries}</b><span>retries</span></div>
            <div><b>{stats.failed}</b><span>failed</span></div>
            <div><b>{stats.received}</b><span>received</span></div>
            <div><b>{rate === null ? '–' : `${rate}%`}</b><span>success</span></div>
          </div>
          <p className="link-sub">Last sent: <code>{lastTx}</code> · Last received: <code>{lastRx}</code></p>
          <p className="link-sub link-syms">Raw symbols: {symbols.length ? symbols.join(' ') : '–'}</p>
          <button className="link-btn small" onClick={() => { setStats(ZERO); setReport(''); }}>Reset counters</button>
        </>
      )}
    </div>
  );
}
