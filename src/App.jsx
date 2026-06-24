import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import CoachCard from './components/CoachCard.jsx';
import TranscriptFeed from './components/TranscriptFeed.jsx';
import StatusBar from './components/StatusBar.jsx';
import Settings from './components/Settings.jsx';
import Motivation from './components/Motivation.jsx';
import NotesPanel from './components/NotesPanel.jsx';
import NotesAndResponses from './components/NotesAndResponses.jsx';
import { useLiveCoach } from './lib/useLiveCoach.js';

export default function App() {
  const c = useLiveCoach();
  const [tab, setTab] = useState('copilote');
  const isSim = c.mode === 'simulation';
  const { toggle, alternative, toggleSpeaker } = c;

  // Raccourcis clavier : Espace = démarrer/arrêter · → = alternative · M = locuteur
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); alternative(); }
      else if (e.key.toLowerCase() === 'm' && !isSim) toggleSpeaker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, alternative, toggleSpeaker, isSim]);

  return (
    <div className="sl-app">
      <Header />

      <nav className="sl-tabs">
        <button className={`sl-tab ${tab === 'copilote' ? 'active' : ''}`} onClick={() => setTab('copilote')}>
          🎯 Copilote
        </button>
        <button className={`sl-tab ${tab === 'nar' ? 'active' : ''}`} onClick={() => setTab('nar')}>
          📝 Notes & Réponses
        </button>
        <button className={`sl-tab ${tab === 'motivation' ? 'active' : ''}`} onClick={() => setTab('motivation')}>
          🔥 Motivation
        </button>
      </nav>

      {tab === 'copilote' && (
        <>
          <StatusBar status={c.status} latency={c.latency} />

          <main className="sl-main">
            <div className="sl-left">
              <CoachCard suggestion={c.suggestion} streaming={c.streaming} status={c.status} error={c.error} />

              {/* GROS bouton PARLER (push-to-talk) — visible pendant l'écoute micro */}
              {!isSim && c.running && (
                <button
                  className={`sl-ptt ${c.speaker === 'MOI' ? 'on' : ''}`}
                  onPointerDown={c.talkStart}
                  onPointerUp={c.talkEnd}
                  onPointerLeave={c.talkEnd}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className="sl-ptt-icon" aria-hidden="true">{c.speaker === 'MOI' ? '🔴' : '🎙️'}</span>
                  <span className="sl-ptt-main">{c.speaker === 'MOI' ? 'TU PARLES…' : 'MAINTENIR POUR PARLER'}</span>
                  <span className="sl-ptt-sub">
                    {c.speaker === 'MOI' ? 'relâche dès que tu as fini' : "garde le doigt appuyé quand c'est à toi de parler"}
                  </span>
                </button>
              )}

              <div className="sl-controls">
                <button className={`sl-btn sl-btn-primary ${c.running ? 'running' : ''}`} onClick={c.toggle}>
                  {isSim
                    ? c.running ? '■ Arrêter la simulation' : '▶ Lancer la simulation'
                    : c.running ? '■ Arrêter l\'écoute' : '● Démarrer l\'écoute'}
                </button>
                <button
                  className="sl-btn sl-btn-ghost"
                  onClick={c.alternative}
                  disabled={!c.turns.length || c.streaming}
                  title="Donne-moi une autre formulation (touche →)"
                >
                  ↻ Alternative
                </button>
                <button className="sl-btn sl-btn-ghost" onClick={c.reset} title="Repartir de zéro">
                  Réinitialiser
                </button>
              </div>

              {!isSim && (
                <p className="sl-hint-live">
                  🎧 Mains-libres : mets l'appel sur <strong>haut-parleur</strong>, je transcris le prospect et
                  te souffle la réponse <strong>dès qu'il fait une pause</strong>. Quand c'est ton tour,
                  <strong> maintiens « PARLER »</strong> (ta voix n'est pas prise pour une objection).
                  Rien n'est enregistré — transcription éphémère.
                </p>
              )}

              <p className="sl-shortcuts">
                <kbd>Espace</kbd> démarrer/arrêter&nbsp;·&nbsp;<kbd>→</kbd> alternative
                {!isSim && <>&nbsp;·&nbsp;<kbd>M</kbd> locuteur</>}
              </p>
            </div>

            <div className="sl-right">
              <Settings
                mode={c.mode}
                onMode={c.setMode}
                micSupported={c.micSupported}
                recorderSupported={c.recorderSupported}
                isIOS={c.isIOS}
                engine={c.engine}
                onEngine={c.setEngine}
                businessType={c.businessType}
                onBusiness={c.setBusinessType}
                scenarioId={c.scenarioId}
                onScenario={c.setScenarioId}
                running={c.running}
              />
              <NotesPanel onCoach={c.coachFromNotes} streaming={c.streaming} micBusy={!isSim && c.running} />
              <TranscriptFeed turns={c.turns} interim={c.interim} />
            </div>
          </main>
        </>
      )}

      {tab === 'nar' && <NotesAndResponses />}

      {tab === 'motivation' && <Motivation />}

      <footer className="sl-footer">
        Clé API côté serveur uniquement&nbsp;·&nbsp;transcription éphémère, aucun audio stocké&nbsp;·&nbsp;
        méthode&nbsp;: J.&nbsp;Belfort, «&nbsp;Way of the Wolf&nbsp;»
      </footer>
    </div>
  );
}
