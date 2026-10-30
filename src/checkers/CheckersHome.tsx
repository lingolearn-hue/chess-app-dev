import { useState } from 'react';
import TwoDeviceApp from '../link/TwoDeviceApp';
import CheckersApp from './CheckersApp';
import type { CheckersLevel } from './ai';
import type { Player } from './logic';
import '../link/link.css';

interface Props {
  onBack: () => void;
}

type Stage = 'menu' | 'cpu-setup' | 'cpu' | 'local' | 'remote';

export default function CheckersHome({ onBack }: Props) {
  const [stage, setStage] = useState<Stage>('menu');
  const [level, setLevel] = useState<CheckersLevel>('medium');
  const [side, setSide] = useState<'1' | '2' | 'random'>('1');
  const [cpuPlayer, setCpuPlayer] = useState<Player>(2);

  if (stage === 'remote') return <TwoDeviceApp kind="checkers" onBack={() => setStage('menu')} />;
  if (stage === 'local') return <CheckersApp mode="local" onBack={() => setStage('menu')} />;
  if (stage === 'cpu') return <CheckersApp mode="cpu" cpuPlayer={cpuPlayer} level={level} onBack={() => setStage('menu')} />;

  return (
    <div className="link-screen">
      <button className="back-btn" onClick={stage === 'menu' ? onBack : () => setStage('menu')}>← Back</button>
      <h1 className="home-title">Chinese Checkers</h1>

      {stage === 'menu' && (
        <>
          <div className="link-row" style={{ flexDirection: 'column', alignItems: 'stretch', width: 'min(80vw, 320px)' }}>
            <button className="link-btn primary" onClick={() => setStage('cpu-setup')}>Vs Computer</button>
            <button className="link-btn primary" onClick={() => setStage('local')}>Two players, one device</button>
            <button className="link-btn primary" onClick={() => setStage('remote')}>Two devices (sound)</button>
          </div>
        </>
      )}

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
