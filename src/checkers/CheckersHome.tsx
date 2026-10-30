import { useState } from 'react';
import TwoDeviceApp from '../link/TwoDeviceApp';
import CheckersApp from './CheckersApp';
import type { CheckersLevel } from './ai';
import type { Player } from './logic';
import '../link/link.css';

interface Props {
  start: 'cpu' | 'local' | 'remote';
  onBack: () => void;
}

type Stage = 'cpu-setup' | 'cpu' | 'local' | 'remote';

export default function CheckersHome({ start, onBack }: Props) {
  const [stage, setStage] = useState<Stage>(start === 'cpu' ? 'cpu-setup' : start);
  const [level, setLevel] = useState<CheckersLevel>('medium');
  const [side, setSide] = useState<'1' | '2' | 'random'>('1');
  const [cpuPlayer, setCpuPlayer] = useState<Player>(2);

  if (stage === 'remote') return <TwoDeviceApp kind="checkers" onBack={onBack} />;
  if (stage === 'local') return <CheckersApp mode="local" onBack={onBack} />;
  if (stage === 'cpu') return <CheckersApp mode="cpu" cpuPlayer={cpuPlayer} level={level} onBack={onBack} />;

  return (
    <div className="link-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="home-title">Vs Computer</h1>

      {stage === 'cpu-setup' && (
        <>
          <p className="link-sub">Difficulty</p>
          <div className="link-row">
            {(['easy', 'medium', 'hard'] as CheckersLevel[]).map((l) => (
              <button key={l} className={`link-btn ${level === l ? 'primary' : ''}`} onClick={() => setLevel(l)}>
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
          <p className="link-sub">You play</p>
          <div className="link-row">
            {(['1', '2', 'random'] as const).map((s) => (
              <button key={s} className={`link-btn ${side === s ? 'primary' : ''}`} onClick={() => setSide(s)}>
                {s === '1' ? 'Gold (first)' : s === '2' ? 'Blue (second)' : 'Random'}
              </button>
            ))}
          </div>
          <button
            className="link-btn primary"
            onClick={() => {
              const mine: Player = side === 'random' ? (Math.random() < 0.5 ? 1 : 2) : side === '1' ? 1 : 2;
              setCpuPlayer(mine === 1 ? 2 : 1);
              setStage('cpu');
            }}
          >
            Start
          </button>
        </>
      )}
    </div>
  );
}
