import { useCallback, useEffect, useRef, useState } from 'react';
import type { SoundLink } from '../link/audio';
import type { FrameType } from '../link/codec';
import { CELLS, initialMarbles, destinationsFor, hasWon, applyMove, marbleAt, project, inHome, inTarget } from './logic';
import type { Marble, Player } from './logic';
import './checkers.css';

export interface CheckersRemote {
  link: SoundLink;
  myPlayer: Player;
}

interface Props {
  remote: CheckersRemote;
  onBack: () => void;
}

const COLORS: Record<Player, { fill: string; light: string; name: string }> = {
  1: { fill: '#d9a521', light: '#ffe08a', name: 'Gold' },
  2: { fill: '#2f78d0', light: '#9cc7ff', name: 'Blue' },
};

// Move frame payload: [from & 63, to & 63, (from >> 6) | ((to >> 6) << 1), 0, 0]
const packCell = (from: number, to: number) => [from & 63, to & 63, (from >> 6) | ((to >> 6) << 1), 0, 0];
const unpackCell = (p: number[]) => ({ from: p[0] | ((p[2] & 1) << 6), to: p[1] | (((p[2] >> 1) & 1) << 6) });

export default function CheckersApp({ remote, onBack }: Props) {
  const me = remote.myPlayer;
  const opp: Player = me === 1 ? 2 : 1;
  const [marbles, setMarbles] = useState<Marble[]>(initialMarbles);
  const [turn, setTurn] = useState<Player>(1);
  const [selected, setSelected] = useState<number | null>(null); // marble id
  const [dests, setDests] = useState<number[]>([]);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [winner, setWinner] = useState<{ player: Player; reason: string } | null>(null);
  const [linkState, setLinkState] = useState<'ok' | 'sending' | 'failed'>('ok');

  const sendChain = useRef<Promise<void>>(Promise.resolve());
  const failedSend = useRef<{ type: FrameType; payload: number[] } | null>(null);

  const enqueueSend = useCallback((type: FrameType, payload: number[]) => {
    sendChain.current = sendChain.current.then(async () => {
      setLinkState('sending');
      const attempts = await remote.link.sendReliable(type, payload);
      failedSend.current = attempts > 0 ? null : { type, payload };
      setLinkState(attempts > 0 ? 'ok' : 'failed');
    });
  }, [remote]);

  const marblesRef = useRef(marbles);
  marblesRef.current = marbles;

  const commitMove = useCallback((marbleId: number, to: number) => {
    const prev = marblesRef.current;
    const m = prev.find((q) => q.id === marbleId)!;
    const next = applyMove(prev, marbleId, to);
    marblesRef.current = next;
    setMarbles(next);
    setLastMove({ from: m.idx, to });
    if (hasWon(next, m.owner)) setWinner({ player: m.owner, reason: 'all marbles home' });
    setTurn((t) => (t === 1 ? 2 : 1));
    setSelected(null);
    setDests([]);
  }, []);

  // Incoming frames.
  const [inbox, setInbox] = useState<Array<{ from: number; to: number }>>([]);
  useEffect(() => {
    const prev = remote.link.ev;
    remote.link.ev = {
      ...prev,
      onFrame: (f) => {
        if (f.type === 'move') setInbox((q) => [...q, unpackCell(f.payload)]);
        else if (f.type === 'resign') setWinner({ player: me, reason: 'resignation' });
      },
    };
    return () => {
      remote.link.ev = prev;
    };
  }, [remote, me]);

  useEffect(() => {
    if (inbox.length === 0) return;
    const m = inbox[0];
    setInbox((q) => q.slice(1));
    if (winner || turn !== opp) return;
    const marble = marbleAt(marbles, m.from);
    if (!marble || marble.owner !== opp) return;
    if (!destinationsFor(marbles, marble.id).includes(m.to)) return; // illegal / duplicate: ignore
    commitMove(marble.id, m.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox]);

  const tap = (idx: number) => {
    if (winner || turn !== me) return;
    const marble = marbleAt(marbles, idx);
    if (marble && marble.owner === me) {
      if (selected === marble.id) {
        setSelected(null);
        setDests([]);
      } else {
        setSelected(marble.id);
        setDests(destinationsFor(marbles, marble.id));
      }
      return;
    }
    if (selected !== null && dests.includes(idx)) {
      const from = marbles.find((m) => m.id === selected)!.idx;
      enqueueSend('move', packCell(from, idx));
      commitMove(selected, idx);
      return;
    }
    setSelected(null);
    setDests([]);
  };

  const resign = () => {
    enqueueSend('resign', []);
    setWinner({ player: opp, reason: 'resignation' });
  };

  const status = winner
    ? `${winner.player === me ? 'You win' : 'Opponent wins'} — ${winner.reason}`
    : linkState === 'failed'
    ? 'Opponent not responding'
    : turn === me
    ? 'Your move'
    : 'Opponent’s turn';

  const hole = (c: (typeof CELLS)[number]) => project(c, me);

  return (
    <div className="checkers-screen">
      <div className="checkers-bar">
        <button onClick={onBack}>← Menu</button>
        <span className={`checkers-status ${turn === me && !winner ? 'mine' : ''}`}>{status}</span>
        {linkState === 'failed' && (
          <button onClick={() => failedSend.current && enqueueSend(failedSend.current.type, failedSend.current.payload)}>
            Resend
          </button>
        )}
        {!winner && <button onClick={resign}>Resign</button>}
        {linkState === 'sending' && <span className="link-banner">📡 sending…</span>}
      </div>

      <svg className="checkers-board" viewBox="-6.9 -7.8 13.8 15.6">
        {CELLS.map((c) => {
          const { px, py } = hole(c);
          const isDest = dests.includes(c.idx);
          const homeOf: Player | null = inHome(1, c) ? 1 : inHome(2, c) ? 2 : null;
          const targetOfMe = inTarget(me, c);
          return (
            <g key={c.idx} onClick={() => tap(c.idx)}>
              <circle
                cx={px}
                cy={py}
                r={0.4}
                className={`ck-hole ${homeOf ? `ck-home-${homeOf}` : ''} ${targetOfMe ? 'ck-target' : ''} ${
                  lastMove && (lastMove.from === c.idx || lastMove.to === c.idx) ? 'ck-last' : ''
                }`}
              />
              {isDest && <circle cx={px} cy={py} r={0.18} className="ck-dest" />}
              <circle cx={px} cy={py} r={0.5} fill="transparent" />
            </g>
          );
        })}
        {marbles.map((m) => {
          const { px, py } = hole(CELLS[m.idx]);
          return (
            <g
              key={m.id}
              className="ck-marble"
              style={{ transform: `translate(${px}px, ${py}px)` }}
              onClick={() => tap(m.idx)}
            >
              <circle r={0.43} fill={COLORS[m.owner].fill} className={selected === m.id ? 'ck-selected' : ''} />
              <circle cx={-0.12} cy={-0.14} r={0.14} fill={COLORS[m.owner].light} opacity={0.75} pointerEvents="none" />
            </g>
          );
        })}
      </svg>

      <p className="checkers-foot">
        You are <b style={{ color: COLORS[me].fill }}>{COLORS[me].name}</b> — move all marbles into the opposite corner.
      </p>
    </div>
  );
}
