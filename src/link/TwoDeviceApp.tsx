import { useEffect, useMemo, useRef, useState } from 'react';
import { SoundLink } from './audio';
import TwoPlayerApp from '../TwoPlayerApp';
import CheckersApp from '../checkers/CheckersApp';
import type { RemoteConfig } from '../TwoPlayerApp';
import './link.css';

interface Props {
  onBack: () => void;
  kind?: 'chess' | 'checkers';
}

type Stage = 'intro' | 'choose' | 'host' | 'join' | 'playing';
type ColorChoice = 'w' | 'b' | 'random';
const MINUTES = [5, 10, 15] as const;

export default function TwoDeviceApp({ onBack, kind = 'chess' }: Props) {
  const checkers = kind === 'checkers';
  const linkRef = useRef<SoundLink | null>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [error, setError] = useState('');
  const [level, setLevel] = useState(-120);
  const [minutes, setMinutes] = useState<number>(10);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('random');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [game, setGame] = useState<{ myColor: 'w' | 'b'; minutes: number } | null>(null);
  const startedNonce = useRef<number>(-1);

  useEffect(() => () => linkRef.current?.close(), []);

  async function enable() {
    setError('');
    try {
      const link = new SoundLink();
      link.ev = { onLevel: setLevel };
      await link.listen();
      linkRef.current = link;
      setStage('choose');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startJoin() {
    const link = linkRef.current;
    if (!link) return;
    setNote('');
    setStage('join');
    link.ev = {
      onLevel: setLevel,
      onFrame: (f) => {
        if (f.type !== 'hello') return;
        if (!!(f.payload[0] & 8) !== checkers) {
          setNote('An invitation for a different game arrived. Ask the host to open the same game.');
          return;
        }
        const nonce = f.payload[1];
        if (nonce === startedNonce.current) return;
        startedNonce.current = nonce;
        const hostColor: 'w' | 'b' = f.payload[0] & 1 ? 'b' : 'w';
        const mins = MINUTES[(f.payload[0] >> 1) & 3] ?? 10;
        setGame({ myColor: hostColor === 'w' ? 'b' : 'w', minutes: mins });
        setStage('playing');
      },
    };
  }

  async function sendInvitation() {
    const link = linkRef.current;
    if (!link) return;
    setBusy(true);
    setNote('Sending invitation… hold the phones close together.');
    const hostColor: 'w' | 'b' = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    const nonce = Math.floor(Math.random() * 64);
    const minIdx = Math.max(0, MINUTES.indexOf(minutes as 5 | 10 | 15));
    const attempts = await link.sendReliable('hello', [(hostColor === 'b' ? 1 : 0) | (minIdx << 1) | (checkers ? 8 : 0), nonce]);
    setBusy(false);
    if (attempts > 0) {
      setGame({ myColor: hostColor, minutes });
      setStage('playing');
    } else {
      setNote('No answer. Is the other phone on "Join"? Try again, closer and a bit louder.');
    }
  }

  const remote: RemoteConfig | undefined = useMemo(
    () => (game && linkRef.current ? { link: linkRef.current, myColor: game.myColor, minutes: game.minutes } : undefined),
    [game]
  );

  if (stage === 'playing' && remote) {
    if (checkers) {
      return <CheckersApp remote={{ link: remote.link, myPlayer: remote.myColor === 'w' ? 1 : 2 }} onBack={onBack} />;
    }
    return <TwoPlayerApp remote={remote} onBack={onBack} />;
  }

  const pct = Math.max(0, Math.min(100, ((level + 100) / 70) * 100));

  return (
    <div className="link-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="home-title">{checkers ? 'Chinese Checkers' : 'Two Devices'}</h1>

      {stage === 'intro' && (
        <>
          <p className="link-note">
            Play one game across two phones. Moves travel as sound between the phones, so place them close together,
            keep the volume up and the screens on. Needs microphone access.
          </p>
          <button className="link-btn primary" onClick={enable}>Enable sound &amp; microphone</button>
          {error && <p className="link-error">{error}</p>}
        </>
      )}

      {stage === 'choose' && (
        <>
          <p className="link-note">One phone hosts, the other joins.</p>
          <div className="link-row">
            <button className="link-btn primary" onClick={() => { setNote(''); setStage('host'); }}>Host a game</button>
            <button className="link-btn primary" onClick={startJoin}>Join a game</button>
          </div>
        </>
      )}

      {stage === 'host' && (
        <>
          {!checkers && (
            <>
              <p className="link-sub">Time per player</p>
              <div className="link-row">
                {MINUTES.map((m) => (
                  <button key={m} className={`link-btn ${minutes === m ? 'primary' : ''}`} onClick={() => setMinutes(m)}>{m}m</button>
                ))}
              </div>
            </>
          )}
          <p className="link-sub">{checkers ? 'Move order' : 'Your colour'}</p>
          <div className="link-row">
            {(['w', 'b', 'random'] as ColorChoice[]).map((c) => (
              <button key={c} className={`link-btn ${colorChoice === c ? 'primary' : ''}`} onClick={() => setColorChoice(c)}>
                {checkers ? (c === 'w' ? 'Gold (first)' : c === 'b' ? 'Blue (second)' : 'Random') : c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}
              </button>
            ))}
          </div>
          <button className="link-btn primary" onClick={sendInvitation} disabled={busy}>Send invitation</button>
          <div className="link-meter"><div className="link-meter-fill" style={{ width: `${pct}%` }} /></div>
          {note && <p className="link-sub">{note}</p>}
        </>
      )}

      {stage === 'join' && (
        <>
          <p className="link-note">Waiting for the host’s invitation… The game starts automatically.</p>
          <div className="link-meter"><div className="link-meter-fill" style={{ width: `${pct}%` }} /></div>
        </>
      )}
    </div>
  );
}
