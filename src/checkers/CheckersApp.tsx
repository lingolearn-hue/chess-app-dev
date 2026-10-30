import { useCallback, useEffect, useRef, useState } from 'react';
import type { SoundLink } from '../link/audio';
import type { FrameType } from '../link/codec';
import { CELLS, initialMarbles, destinationsFor, hasWon, applyMove, marbleAt, project, inHome, inTarget } from './logic';
import type { Marble, Player } from './logic';
import { chooseMove } from './ai';
import type { CheckersLevel } from './ai';
import './checkers.css';

export interface CheckersRemote {
  link: SoundLink;
  myPlayer: Player;
}

export type CheckersMode = 'remote' | 'cpu' | 'local';

interface Props {
  mode: CheckersMode;
  remote?: CheckersRemote; // mode 'remote'
  cpuPlayer?: Player; // mode 'cpu': which side the computer plays
  level?: CheckersLevel;
  onBack: () => void;
}

const COLORS: Record<Player, { fill: string; light: string; name: string }> = {
  1: { fill: '#d9a521', light: '#ffe08a', name: 'Gold' },
  2: { fill: '#2f78d0', light: '#9cc7ff', name: 'Blue' },
};

// Move frame payload: [from & 63, to & 63, (from >> 6) | ((to >> 6) << 1), 0, 0]
const packCell = (from: number, to: number) => [from & 63, to & 63, (from >> 6) | ((to >> 6) << 1), 0, 0];
const unpackCell = (p: number[]) => ({ from: p[0] | ((p[2] & 1) << 6), to: p[1] | (((p[2] >> 1) & 1) << 6) });

const FULL = { x: -6.9, y: -7.8, w: 13.8, h: 15.6 };
// Two views: the full star, or a narrower portrait crop with two columns trimmed left and right.
const PORTRAIT = { x: -4.5, y: -7.8, w: 9, h: 15.6 };
const PORTRAIT_MAX_PX = 4; // holes further out than this are hidden in the portrait view
const other = (p: Player): Player => (p === 1 ? 2 : 1);

export default function CheckersApp({ mode, remote, cpuPlayer = 2, level = 'medium', onBack }: Props) {
  const me: Player = remote ? remote.myPlayer : mode === 'cpu' ? other(cpuPlayer) : 1;
  const opp = other(me);
  const [marbles, setMarbles] = useState<Marble[]>(initialMarbles);
  const [turn, setTurn] = useState<Player>(1);
  const [selected, setSelected] = useState<number | null>(null); // marble id
  const [dests, setDests] = useState<number[]>([]);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [winner, setWinner] = useState<{ player: Player; reason: string } | null>(null);
  const [linkState, setLinkState] = useState<'ok' | 'sending' | 'failed'>('ok');
  const [thinking, setThinking] = useState(false);

  const marblesRef = useRef(marbles);
  marblesRef.current = marbles;

  // ---- sound link sending (remote mode only) ----
  const sendChain = useRef<Promise<void>>(Promise.resolve());
  const failedSend = useRef<{ type: FrameType; payload: number[] } | null>(null);
  const enqueueSend = useCallback((type: FrameType, payload: number[]) => {
    if (!remote) return;
    sendChain.current = sendChain.current.then(async () => {
      setLinkState('sending');
      const attempts = await remote.link.sendReliable(type, payload);
      failedSend.current = attempts > 0 ? null : { type, payload };
      setLinkState(attempts > 0 ? 'ok' : 'failed');
    });
  }, [remote]);

  const commitMove = useCallback((marbleId: number, to: number) => {
    const prev = marblesRef.current;
    const m = prev.find((q) => q.id === marbleId)!;
    const next = applyMove(prev, marbleId, to);
    marblesRef.current = next;
    setMarbles(next);
    setLastMove({ from: m.idx, to });
    if (hasWon(next, m.owner)) setWinner({ player: m.owner, reason: 'all marbles home' });
    setTurn(other(m.owner));
    setSelected(null);
    setDests([]);
  }, []);

  // ---- incoming frames (remote mode) ----
  const [inbox, setInbox] = useState<Array<{ from: number; to: number }>>([]);
  useEffect(() => {
    if (!remote) return;
    const prev = remote.link.ev;
    remote.link.ev = {
      ...prev,
      onFrame: (f) => {
        if (f.type === 'move') setInbox((q) => [...q, unpackCell(f.payload)]);
        else if (f.type === 'resign') setWinner({ player: remote.myPlayer, reason: 'resignation' });
      },
    };
    return () => {
      remote.link.ev = prev;
    };
  }, [remote]);

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

  // ---- computer's turn ----
  useEffect(() => {
    if (mode !== 'cpu' || winner || turn !== cpuPlayer) return;
    setThinking(true);
    const t = setTimeout(() => {
      const mv = chooseMove(marblesRef.current, cpuPlayer, level);
      setThinking(false);
      if (mv) commitMove(mv.marbleId, mv.to);
      else setTurn(other(cpuPlayer)); // blocked: pass
    }, 500);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
  }, [mode, turn, winner, cpuPlayer, level, commitMove]);

  // The player allowed to act right now (null while waiting for the other side).
  const actor: Player | null = winner ? null : mode === 'local' ? turn : turn === me ? me : null;

  const tap = (idx: number) => {
    if (actor === null) return;
    const marble = marbleAt(marbles, idx);
    if (marble && marble.owner === actor) {
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
      if (remote) enqueueSend('move', packCell(from, idx));
      commitMove(selected, idx);
      return;
    }
    setSelected(null);
    setDests([]);
  };

  const resign = () => {
    if (remote) enqueueSend('resign', []);
    setWinner({ player: other(actor ?? me), reason: 'resignation' });
  };

  // ---- view: full (default) or portrait crop ----
  const [portrait, setPortrait] = useState(false);
  const view = portrait ? PORTRAIT : FULL;

  const status = winner
    ? mode === 'local'
      ? `${COLORS[winner.player].name} wins — ${winner.reason}`
      : `${winner.player === me ? 'You win' : mode === 'cpu' ? 'Computer wins' : 'Opponent wins'} — ${winner.reason}`
    : linkState === 'failed'
    ? 'Opponent not responding'
    : mode === 'local'
    ? `${COLORS[turn].name} to move`
    : thinking
    ? 'Computer is thinking…'
    : turn === me
    ? 'Your move'
    : 'Opponent’s turn';

  const foot =
    mode === 'local' ? (
      <>
        <b style={{ color: COLORS[1].fill }}>Gold</b> sits at the bottom, <b style={{ color: COLORS[2].fill }}>Blue</b> at the top.
      </>
    ) : (
      <>
        You are <b style={{ color: COLORS[me].fill }}>{COLORS[me].name}</b> — move all marbles into the opposite corner.
      </>
    );

  const vb = `${view.x} ${view.y} ${view.w} ${view.h}`;
  const aspect = view.w / view.h;

  return (
    <div className="checkers-screen">
      <div className="checkers-bar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className={`checkers-status ${actor !== null && mode !== 'local' ? 'mine' : ''}`}>{status}</span>
        <button onClick={() => setPortrait((v) => !v)} title="Switch between the full board and a narrower, taller view">
          🔍 {portrait ? 'Narrow' : 'Full'}
        </button>
        {linkState === 'failed' && (
          <button onClick={() => failedSend.current && enqueueSend(failedSend.current.type, failedSend.current.payload)}>Resend</button>
        )}
        {!winner && <button onClick={resign}>Resign</button>}
        {linkState === 'sending' && <span className="link-banner">📡 sending…</span>}
      </div>

      <svg
        className="checkers-board"
        viewBox={vb}
        style={{ aspectRatio: `${view.w} / ${view.h}`, width: `min(96vw, calc((100vh - 6rem) * ${aspect}))` }}
      >
        {CELLS.map((c) => {
          const { px, py } = project(c, me);
          if (portrait && Math.abs(px) > PORTRAIT_MAX_PX) return null;
          const isDest = dests.includes(c.idx);
          const homeOf: Player | null = inHome(1, c) ? 1 : inHome(2, c) ? 2 : null;
          const targetOfMe = inTarget(me, c);
          return (
            <g key={c.idx} onClick={() => tap(c.idx)}>
              <circle
                cx={px}
                cy={py}
                r={0.4}
                className={`ck-hole ${homeOf ? `ck-home-${homeOf}` : ''} ${targetOfMe && mode !== 'local' ? 'ck-target' : ''} ${
                  lastMove && (lastMove.from === c.idx || lastMove.to === c.idx) ? 'ck-last' : ''
                }`}
              />
              {isDest && <circle cx={px} cy={py} r={0.18} className="ck-dest" />}
              <circle cx={px} cy={py} r={0.5} fill="transparent" />
            </g>
          );
        })}
        {marbles.map((m) => {
          const { px, py } = project(CELLS[m.idx], me);
          return (
            <g key={m.id} className="ck-marble" style={{ transform: `translate(${px}px, ${py}px)` }} onClick={() => tap(m.idx)}>
              <circle r={0.43} fill={COLORS[m.owner].fill} className={selected === m.id ? 'ck-selected' : ''} />
              <circle cx={-0.12} cy={-0.14} r={0.14} fill={COLORS[m.owner].light} opacity={0.75} pointerEvents="none" />
            </g>
          );
        })}
      </svg>

      <p className="checkers-foot">{foot}</p>
    </div>
  );
}
