import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import CoachCard from './components/CoachCard.jsx';
import TranscriptFeed from './components/TranscriptFeed.jsx';
import StatusBar from './components/StatusBar.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Motivation from './components/Motivation.jsx';
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
  const [settings, setSettings] = useState(() => ({
    // Par défaut : écoute micro → transcription navigateur (gratuite) → texte envoyé à l'API.
    // Repli sur la simulation si le navigateur ne supporte pas Web Speech (ex. hors Chrome).
    provider: WebSpeechProvider.isSupported ? 'webspeech' : 'simulation',
    businessType: 'restaurant',
    captureSource: 'mic', // 'mic' (haut-parleur) | 'tab' (audio de l'onglet, Deepgram)
  }));
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
  const [tab, setTab] = useState('copilote'); // 'copilote' | 'motivation'

  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const providerRef = useRef(null);
  const coachAbortRef = useRef(null);
  const simAbortRef = useRef(null);
  const t0Ref = useRef(0);
  const speakerRef = useRef('MOI');
  speakerRef.current = speaker;
  const pendingRef = useRef(null); // timer de coalescing (fin de parole prospect)
  const fellBackRef = useRef(false); // évite une boucle de repli Deepgram → micro

  const clearPending = () => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
  };

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
  // Déclenche le coach après une courte pause (≈450 ms) = fin de parole du prospect.
  // Coalesce plusieurs fragments "final" d'une même phrase → un seul appel, ultra-rapide.
  const triggerSoon = useCallback(() => {
    clearPending();
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      runCoach();
    }, 450);
  }, [runCoach]);

  const onFinalTurn = useCallback((text, who, speechFinal = true) => {
    const sp = who || speakerRef.current;
    setInterim(null);
    setTurns((prev) => pushTurn(prev, sp, text));
    // Mains-libres : dès que le PROSPECT fait une pause, on souffle la réponse.
    if (sp === 'PROSPECT' && speechFinal) triggerSoon();
  }, [triggerSoon]);

  // Push-to-talk : maintiens pour parler (= MOI), relâche → on réécoute le prospect.
  const talkStart = useCallback(() => {
    clearPending(); // ma voix ne doit pas déclencher de suggestion
    setSpeaker('MOI');
  }, []);
  const talkEnd = useCallback(() => setSpeaker('PROSPECT'), []);

  // ----------------------------------------------------------------------------
  //  Démarrer / arrêter l'écoute live (Web Speech ou Deepgram)
  // ----------------------------------------------------------------------------
  const startLive = useCallback(async (providerId) => {
    const prov = providerId || settings.provider;
    if (!providerId) fellBackRef.current = false; // démarrage manuel → on réarme le repli
    setError(null);
    setSpeaker('PROSPECT'); // mains-libres : on écoute le prospect par défaut

    // Deepgram en échec → bascule automatique sur le micro du navigateur (gratuit, sans clé)
    const onLiveError = (msg) => {
      if (prov === 'deepgram' && WebSpeechProvider.isSupported && !fellBackRef.current) {
        fellBackRef.current = true;
        try { providerRef.current?.stop(); } catch { /* */ }
        providerRef.current = null;
        setSettings((s) => ({ ...s, provider: 'webspeech' }));
        setError('Deepgram indisponible — bascule automatique sur le micro du navigateur (gratuit).');
        startLive('webspeech');
        return;
      }
      setError(typeof msg === 'string' ? msg : 'erreur de transcription');
    };

    const provider = prov === 'deepgram' ? new DeepgramProvider() : new WebSpeechProvider();
    providerRef.current = provider;
    try {
      await provider.start(
        {
          onInterim: (text, who) => setInterim({ speaker: who || speakerRef.current, text }),
          onFinal: (text, who, speechFinal) => onFinalTurn(text, who, speechFinal),
          onUtteranceEnd: () => {},
          onError: onLiveError,
        },
        { source: settings.captureSource || 'mic' },
      );
      setRunning(true);
      setStatus('listening');
    } catch (e) {
      providerRef.current = null;
      onLiveError(e.message || String(e));
    }
  }, [settings.provider, settings.captureSource, onFinalTurn]);

  const stopLive = useCallback(() => {
    clearPending();
    fellBackRef.current = false;
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
    clearPending();
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

      <nav className="sl-tabs">
        <button className={`sl-tab ${tab === 'copilote' ? 'active' : ''}`} onClick={() => setTab('copilote')}>
          🎯 Copilote
        </button>
        <button className={`sl-tab ${tab === 'motivation' ? 'active' : ''}`} onClick={() => setTab('motivation')}>
          🔥 Motivation
        </button>
      </nav>

      {tab === 'copilote' ? (
        <>
          <StatusBar status={status} latency={latency} />

          <main className="sl-main">
            <div className="sl-left">
              <CoachCard suggestion={suggestion} streaming={streaming} status={status} error={error} />

              {/* GROS bouton PARLER, explicite, pendant un appel live */}
              {!isSim && running && (
                <button
                  className={`sl-ptt ${speaker === 'MOI' ? 'on' : ''}`}
                  onPointerDown={talkStart}
                  onPointerUp={talkEnd}
                  onPointerLeave={talkEnd}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className="sl-ptt-icon" aria-hidden="true">{speaker === 'MOI' ? '🔴' : '🎙️'}</span>
                  <span className="sl-ptt-main">{speaker === 'MOI' ? 'TU PARLES…' : 'MAINTENIR POUR PARLER'}</span>
                  <span className="sl-ptt-sub">
                    {speaker === 'MOI' ? 'relâche dès que tu as fini' : "garde le doigt appuyé quand c'est à toi de parler"}
                  </span>
                </button>
              )}

              <div className="sl-controls">
                <button className={`sl-btn sl-btn-primary ${running ? 'running' : ''}`} onClick={onPrimary}>
                  {isSim
                    ? running ? '■ Arrêter la simulation' : '▶ Lancer la simulation'
                    : running ? '■ Arrêter l\'écoute' : '● Démarrer l\'écoute'}
                </button>
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

              {!isSim && (
                <p className="sl-hint-live">
                  🎧 Mains-libres : je transcris le prospect et te souffle la réponse <strong>dès qu'il fait une pause</strong>.
                  Quand c'est ton tour, <strong>maintiens le bouton « PARLER »</strong> (ta voix n'est pas prise pour une objection).
                </p>
              )}

              <p className="sl-shortcuts">
                <kbd>Espace</kbd> démarrer/arrêter&nbsp;·&nbsp;<kbd>→</kbd> alternative
                {!isSim && <>&nbsp;·&nbsp;<kbd>M</kbd> locuteur</>}
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
        </>
      ) : (
        <Motivation />
      )}

      <footer className="sl-footer">
        Clés API côté serveur uniquement&nbsp;·&nbsp;transcription éphémère&nbsp;·&nbsp;
        méthode&nbsp;: J.&nbsp;Belfort, «&nbsp;Way of the Wolf&nbsp;»
      </footer>
    </div>
  );
}
