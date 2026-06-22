import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import CoachCard from './components/CoachCard.jsx';
import TranscriptFeed from './components/TranscriptFeed.jsx';
import StatusBar from './components/StatusBar.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { streamCoach } from './lib/coachClient.js';
import { parsePartial } from './lib/partialJson.js';
import { pushTurn, buildPayload } from './lib/transcript.js';
import { WebSpeechProvider } from './lib/speech/webSpeechProvider.js';
import { DeepgramProvider } from './lib/speech/deepgramProvider.js';
import { SCENARIOS } from './lib/simulation/scenarios.js';

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(id);
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });
    }
  });

export default function App() {
  const [settings, setSettings] = useState({ provider: 'simulation', businessType: 'restaurant' });
  const [status, setStatus] = useState('idle'); // idle | listening | speaking | thinking
  const [turns, setTurns] = useState([]);
  const [interim, setInterim] = useState(null); // { speaker, text }
  const [speaker, setSpeaker] = useState('MOI'); // locuteur courant (Web Speech)
  const [suggestion, setSuggestion] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState({ first: null, full: null });
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [running, setRunning] = useState(false); // écoute live OU simulation en cours

  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const providerRef = useRef(null);
  const coachAbortRef = useRef(null);
  const simAbortRef = useRef(null);
  const t0Ref = useRef(0);
  const speakerRef = useRef('MOI');
  speakerRef.current = speaker;

  const webSpeechSupported = WebSpeechProvider.isSupported;

  // ----------------------------------------------------------------------------
  //  Appel du coach (streaming + parsing partiel + mesure de latence)
  // ----------------------------------------------------------------------------
  const runCoach = useCallback(async (hint) => {
    coachAbortRef.current?.abort();
    const ac = new AbortController();
    coachAbortRef.current = ac;

    const t0 = performance.now();
    t0Ref.current = t0;
    let gotFirst = false;

    setError(null);
    setStreaming(true);
    setStatus('thinking');
    setSuggestion({ phrase_a_dire: '', _complete: false });
    setLatency({ first: null, full: null });

    const payload = buildPayload(turnsRef.current, settings.businessType, hint);

    try {
      let lastRaw = '';
      for await (const raw of streamCoach(payload, { signal: ac.signal })) {
        lastRaw = raw;
        const parsed = parsePartial(raw);
        setSuggestion(parsed);
        if (!gotFirst && parsed.phrase_a_dire) {
          gotFirst = true;
          setLatency((l) => ({ ...l, first: performance.now() - t0 }));
        }
        if (parsed._error) setError(parsed._error);
      }
      const finalParsed = parsePartial(lastRaw);
      setSuggestion(finalParsed);
      setLatency((l) => ({
        first: l.first ?? performance.now() - t0,
        full: performance.now() - t0,
      }));
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || String(e));
    } finally {
      setStreaming(false);
      setStatus((prev) => (prev === 'thinking' ? (running ? 'listening' : 'idle') : prev));
    }
  }, [settings.businessType, running]);

  // ----------------------------------------------------------------------------
  //  Réception d'une réplique finale (depuis un provider STT)
  // ----------------------------------------------------------------------------
  const onFinalTurn = useCallback((text, who, speechFinal = true) => {
    const sp = who || speakerRef.current;
    setInterim(null);
    setTurns((prev) => pushTurn(prev, sp, text));
    if (sp === 'PROSPECT' && speechFinal) {
      // le prospect a fini de parler → on souffle la prochaine réplique
      setTimeout(() => runCoach(), 0);
    }
  }, [runCoach]);

  // ----------------------------------------------------------------------------
  //  Démarrer / arrêter l'écoute live (Web Speech ou Deepgram)
  // ----------------------------------------------------------------------------
  const startLive = useCallback(async () => {
    setError(null);
    const provider = settings.provider === 'deepgram' ? new DeepgramProvider() : new WebSpeechProvider();
    providerRef.current = provider;
    try {
      await provider.start({
        onInterim: (text, who) => setInterim({ speaker: who || speakerRef.current, text }),
        onFinal: (text, who, speechFinal) => onFinalTurn(text, who, speechFinal),
        onUtteranceEnd: () => {},
        onError: (msg) => setError(typeof msg === 'string' ? msg : 'erreur micro'),
      });
      setRunning(true);
      setStatus('listening');
    } catch (e) {
      setError(e.message || String(e));
      providerRef.current = null;
    }
  }, [settings.provider, onFinalTurn]);

  const stopLive = useCallback(() => {
    providerRef.current?.stop();
    providerRef.current = null;
    setRunning(false);
    setStatus('idle');
    setInterim(null);
  }, []);

  // ----------------------------------------------------------------------------
  //  Simulation : rejoue un scénario, déclenche le coach après chaque PROSPECT
  // ----------------------------------------------------------------------------
  const runSimulation = useCallback(async () => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
    setSettings((s) => ({ ...s, businessType: scenario.business_type }));
    setTurns([]);
    setSuggestion(null);
    setError(null);
    setInterim(null);

    const ac = new AbortController();
    simAbortRef.current = ac;
    setRunning(true);
    setStatus('listening');

    try {
      for (const turn of scenario.turns) {
        if (ac.signal.aborted) break;
        // petit "interim" pour montrer qui parle
        setStatus(turn.speaker === 'PROSPECT' ? 'speaking' : 'listening');
        setInterim({ speaker: turn.speaker, text: turn.text });
        await sleep(Math.max(500, turn.delayMs || 1500), ac.signal);
        setInterim(null);
        setTurns((prev) => pushTurn(prev, turn.speaker, turn.text));
        if (turn.speaker === 'PROSPECT') {
          await runCoach();
          await sleep(900, ac.signal); // laisse lire la carte
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || String(e));
    } finally {
      simAbortRef.current = null;
      setRunning(false);
      setStatus('idle');
      setInterim(null);
    }
  }, [scenarioId, runCoach]);

  const stopSimulation = useCallback(() => {
    simAbortRef.current?.abort();
    coachAbortRef.current?.abort();
    simAbortRef.current = null;
    setRunning(false);
    setStatus('idle');
  }, []);

  // ----------------------------------------------------------------------------
  //  Bouton principal
  // ----------------------------------------------------------------------------
  const onPrimary = () => {
    if (settings.provider === 'simulation') {
      running ? stopSimulation() : runSimulation();
    } else {
      running ? stopLive() : startLive();
    }
  };

  const resetAll = () => {
    stopLive();
    stopSimulation();
    setTurns([]);
    setSuggestion(null);
    setError(null);
    setInterim(null);
    setLatency({ first: null, full: null });
  };

  // ----------------------------------------------------------------------------
  //  Raccourcis clavier : espace = pause/relance · → = alternative
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        onPrimary();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (turnsRef.current.length) runCoach('Donne une formulation nettement différente.');
      } else if (e.key.toLowerCase() === 'm' && settings.provider !== 'simulation') {
        setSpeaker((s) => (s === 'MOI' ? 'PROSPECT' : 'MOI'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => () => { providerRef.current?.stop(); simAbortRef.current?.abort(); }, []);

  const isSim = settings.provider === 'simulation';

  return (
    <div className="sl-app">
      <Header />

      <StatusBar status={status} latency={latency} />

      <main className="sl-main">
        <div className="sl-left">
          <CoachCard suggestion={suggestion} streaming={streaming} status={status} error={error} />

          <div className="sl-controls">
            <button className={`sl-btn sl-btn-primary ${running ? 'running' : ''}`} onClick={onPrimary}>
              {isSim
                ? running ? '■ Arrêter la simulation' : '▶ Lancer la simulation'
                : running ? '■ Arrêter l\'écoute' : '● Démarrer l\'écoute'}
            </button>

            {!isSim && running && (
              <button
                className={`sl-btn sl-btn-speaker speaker-${speaker.toLowerCase()}`}
                onClick={() => setSpeaker((s) => (s === 'MOI' ? 'PROSPECT' : 'MOI'))}
                title="Qui parle ? (touche M)"
              >
                {speaker === 'MOI' ? '🎤 Moi' : '👤 Le prospect'}
              </button>
            )}

            <button
              className="sl-btn sl-btn-ghost"
              onClick={() => turns.length && runCoach('Donne une formulation nettement différente.')}
              disabled={!turns.length || streaming}
              title="Donne-moi une alternative (touche →)"
            >
              ↻ Alternative
            </button>

            <button className="sl-btn sl-btn-ghost" onClick={resetAll} title="Repartir de zéro">
              Réinitialiser
            </button>
          </div>

          <p className="sl-shortcuts">
            <kbd>Espace</kbd> démarrer/arrêter&nbsp;·&nbsp;<kbd>→</kbd> alternative
            {!isSim && <>&nbsp;·&nbsp;<kbd>M</kbd> changer de locuteur</>}
          </p>
        </div>

        <div className="sl-right">
          <SettingsPanel
            settings={settings}
            onChange={(s) => { if (!running) setSettings(s); }}
            scenarioId={scenarioId}
            onScenario={setScenarioId}
            webSpeechSupported={webSpeechSupported}
          />
          <TranscriptFeed turns={turns} interim={interim} />
        </div>
      </main>

      <footer className="sl-footer">
        Clés API côté serveur uniquement&nbsp;·&nbsp;transcription éphémère&nbsp;·&nbsp;
        méthode&nbsp;: J.&nbsp;Belfort, «&nbsp;Way of the Wolf&nbsp;»
      </footer>
    </div>
  );
}
