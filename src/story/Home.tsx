interface Props {
  onSelectTwoPlayer: () => void;
  onSelectStory: () => void;
  onSelectOpenings: () => void;
  onSelectEndgames: () => void;
  onSelectSoundLink: () => void;
}

export default function Home({ onSelectTwoPlayer, onSelectStory, onSelectOpenings, onSelectEndgames, onSelectSoundLink }: Props) {
  return (
    <div className="home-screen">
      <h1 className="home-title">Chess</h1>
      <button className="home-tile" onClick={onSelectTwoPlayer}>
        <span className="home-tile-title">Two Players</span>
        <span className="home-tile-sub">Play locally, one device, two players</span>
      </button>
      <button className="home-tile" onClick={onSelectStory}>
        <span className="home-tile-title">Story Mode</span>
        <span className="home-tile-sub">Meet opponents, learn openings, solve puzzles</span>
      </button>
      <button className="home-tile" onClick={onSelectOpenings}>
        <span className="home-tile-title">Opening Library</span>
        <span className="home-tile-sub">Browse and practice openings</span>
      </button>
      <button className="home-tile" onClick={onSelectEndgames}>
        <span className="home-tile-title">Endgame Library</span>
        <span className="home-tile-sub">Browse and practice endgame technique</span>
      </button>
      <button className="home-tile" onClick={onSelectSoundLink}>
        <span className="home-tile-title">Sound Link (test)</span>
        <span className="home-tile-sub">Two devices: test audio communication</span>
      </button>
    </div>
  );
}
