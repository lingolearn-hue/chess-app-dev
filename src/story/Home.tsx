import { useState } from 'react';
import PieceIcon from '../PieceIcon';

export type HomeTarget =
  | 'two-player'
  | 'two-device'
  | 'story-home'
  | 'opening-library'
  | 'endgame-library'
  | 'checkers-cpu'
  | 'checkers-local'
  | 'checkers-remote'
  | 'sound-link';

interface Props {
  onSelect: (target: HomeTarget) => void;
}

type Tab = 'chess' | 'checkers' | 'tools';
const TAB_KEY = 'home-tab';

interface Tile {
  target: HomeTarget;
  title: string;
  sub: string;
}

// Every game offers its play types in the same order: vs computer, one device,
// two devices, then extras.
const TILES: Record<Tab, { title: string; tiles: Tile[] }> = {
  chess: {
    title: 'Chess',
    tiles: [
      { target: 'two-player', title: 'One Device', sub: 'Friend or computer on one phone' },
      { target: 'two-device', title: 'Two Devices', sub: 'Two phones, moves sent by sound' },
      { target: 'story-home', title: 'Story Mode', sub: 'Meet opponents, learn openings, solve puzzles' },
      { target: 'opening-library', title: 'Opening Library', sub: 'Browse and practice openings' },
      { target: 'endgame-library', title: 'Endgame Library', sub: 'Browse and practice endgame technique' },
    ],
  },
  checkers: {
    title: 'Chinese Checkers',
    tiles: [
      { target: 'checkers-cpu', title: 'Vs Computer', sub: 'Easy, medium or hard' },
      { target: 'checkers-local', title: 'One Device', sub: 'Two players on one phone' },
      { target: 'checkers-remote', title: 'Two Devices', sub: 'Two phones, moves sent by sound' },
    ],
  },
  tools: {
    title: 'Tools',
    tiles: [{ target: 'sound-link', title: 'Sound Link Test', sub: 'Check audio communication between two devices' }],
  },
};

function loadTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === 'chess' || v === 'checkers' || v === 'tools') return v;
  } catch {
    // storage unavailable, fall through
  }
  return 'chess';
}

const CheckersIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5.5" r="3.6" />
    <circle cx="6" cy="16.5" r="3.6" />
    <circle cx="18" cy="16.5" r="3.6" />
  </svg>
);

export default function Home({ onSelect }: Props) {
  const [tab, setTab] = useState<Tab>(loadTab);
  const pick = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // ignore
    }
  };
  const page = TILES[tab];

  return (
    <>
      <div className="home-screen">
        <h1 className="home-title">{page.title}</h1>
        {page.tiles.map((t) => (
          <button key={t.target} className="home-tile" onClick={() => onSelect(t.target)}>
            <span className="home-tile-title">{t.title}</span>
            <span className="home-tile-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      <nav className="bottom-nav" aria-label="Games">
        <button className={tab === 'chess' ? 'active' : ''} onClick={() => pick('chess')}>
          <span className="nav-icon"><PieceIcon type="p" color="w" /></span>
          Chess
        </button>
        <button className={tab === 'checkers' ? 'active' : ''} onClick={() => pick('checkers')}>
          <span className="nav-icon"><CheckersIcon /></span>
          Checkers
        </button>
        <button className={tab === 'tools' ? 'active' : ''} onClick={() => pick('tools')}>
          <span className="nav-icon">⚙</span>
          Tools
        </button>
      </nav>
    </>
  );
}
