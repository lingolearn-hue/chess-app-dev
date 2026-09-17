import { useState } from 'react';
import TwoPlayerApp from './TwoPlayerApp';
import Home from './story/Home';
import StoryHome from './story/StoryHome';
import OpponentScreen from './story/OpponentScreen';
import LessonScreen from './story/LessonScreen';
import PuzzleScreen from './story/PuzzleScreen';
import StoryGame from './story/StoryGame';
import OpeningLibrary from './story/OpeningLibrary';
import EndgameLibrary from './story/EndgameLibrary';
import PracticeGame from './story/PracticeGame';
import { getOpponent } from './story/opponents';
import { LESSONS, PUZZLES } from './story/content';
import { loadPlayerRating, loadOpponentRecord } from './story/storyStorage';
import './story/story.css';

type View =
  | 'home'
  | 'two-player'
  | 'story-home'
  | 'story-opponent'
  | 'story-lesson'
  | 'story-puzzle'
  | 'story-game'
  | 'opening-library'
  | 'endgame-library'
  | 'practice-game';

interface PracticeParams {
  fen: string;
  title: string;
  objective: string;
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [practiceParams, setPracticeParams] = useState<PracticeParams | null>(null);
  // Where "Back" from the practice screen should return to.
  const [practiceOrigin, setPracticeOrigin] = useState<'opening-library' | 'endgame-library'>('opening-library');

  if (view === 'two-player') return <TwoPlayerApp />;

  if (view === 'opening-library') {
    return (
      <OpeningLibrary
        onPractice={(fen, title) => {
          setPracticeParams({ fen, title, objective: 'Continue the opening and find a strong plan.' });
          setPracticeOrigin('opening-library');
          setView('practice-game');
        }}
        onBack={() => setView('home')}
      />
    );
  }

  if (view === 'endgame-library') {
    return (
      <EndgameLibrary
        onPractice={(fen, title, objective) => {
          setPracticeParams({ fen, title, objective });
          setPracticeOrigin('endgame-library');
          setView('practice-game');
        }}
        onBack={() => setView('home')}
      />
    );
  }

  if (view === 'practice-game' && practiceParams) {
    return (
      <PracticeGame
        title={practiceParams.title}
        objective={practiceParams.objective}
        fen={practiceParams.fen}
        onBack={() => setView(practiceOrigin)}
      />
    );
  }

  if (view === 'story-home') {
    return (
      <StoryHome
        onSelectOpponent={(id) => {
          setSelectedOpponentId(id);
          setView('story-opponent');
        }}
        onBack={() => setView('home')}
      />
    );
  }

  const opponent = selectedOpponentId ? getOpponent(selectedOpponentId) : undefined;

  if (view === 'story-opponent' && opponent) {
    return (
      <OpponentScreen
        opponent={opponent}
        playerRating={loadPlayerRating()}
        record={loadOpponentRecord(opponent.id)}
        onLesson={() => setView('story-lesson')}
        onPuzzle={() => setView('story-puzzle')}
        onPlay={() => setView('story-game')}
        onBack={() => setView('story-home')}
      />
    );
  }

  if (view === 'story-lesson' && opponent && LESSONS[opponent.id]) {
    return (
      <LessonScreen
        lesson={LESSONS[opponent.id]}
        onDone={() => setView('story-opponent')}
        onBack={() => setView('story-opponent')}
      />
    );
  }

  if (view === 'story-puzzle' && opponent && PUZZLES[opponent.id]) {
    return (
      <PuzzleScreen
        puzzle={PUZZLES[opponent.id]}
        onDone={() => setView('story-opponent')}
        onBack={() => setView('story-opponent')}
      />
    );
  }

  if (view === 'story-game' && opponent) {
    return (
      <StoryGame
        opponent={opponent}
        onDone={() => setView('story-opponent')}
        onBack={() => setView('story-opponent')}
      />
    );
  }

  return (
    <Home
      onSelectTwoPlayer={() => setView('two-player')}
      onSelectStory={() => setView('story-home')}
      onSelectOpenings={() => setView('opening-library')}
      onSelectEndgames={() => setView('endgame-library')}
    />
  );
}
