// =============================================================================
//  useLiveCoach — le cœur du copilote (état + orchestration)
//
//  Deux modes :
//   • 'mic'        → écoute live du micro (Web Speech), souffle la réponse dès
//                    que le prospect fait une pause. Mains-libres, éphémère.
//   • 'simulation' → rejoue un appel d'objections. Marche SANS clé : si l'API
//                    échoue, on affiche la carte pré-écrite du scénario.
//
//  Flux mic : Web Speech → transcript roulant [MOI]/[PROSPECT]
//             → pause du prospect (~420 ms) → POST /api/coach (stream)
//             → carte de conseil qui s'écrit en direct + latence mesurée.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { streamCoach } from './coachClient.js';
import { parsePartial } from './partialJson.js';
import { pushTurn, buildPayload } from './transcript.js';
import { createMic, micSupported } from './micSpeech.js';
import { SCENARIOS } from './simulation/scenarios.js';

const TRIGGER_PAUSE_MS = 420; // silence du prospect avant de souffler la réponse

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => { clearTimeout(id); reject(new DOMException('aborted', 'AbortError')); },
      { once: true },
    );
  });

export function useLiveCoach() {
  const [mode, setMode] = useState(micSupported ? 'mic' : 'simulation');
  const [businessType, setBusinessType] = useState('restaurant');
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);

  const [status, setStatus] = useState('idle'); // idle | listening | speaking | thinking
  const [running, setRunning] = useState(false);
  const [turns, setTurns] = useState([]);
  const [interim, setInterim] = useState(null); // { speaker, text }
  const [speaker, setSpeaker] = useState('PROSPECT'); // locuteur courant (push-to-talk)
  const [suggestion, setSuggestion] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState({ first: null, full: null });

  // Refs (valeurs « fraîches » dans les callbacks sans recréer les fonctions)
  const turnsRef = useRef(turns); turnsRef.current = turns;
  const speakerRef = useRef(speaker);
  const businessRef = useRef(businessType); businessRef.current = businessType;
  const runningRef = useRef(false);
  const micRef = useRef(null);
  const coachAbortRef = useRef(null);
  const simAbortRef = useRef(null);
  const pauseRef = useRef(null);

  const setSpeakerSync = (sp) => { speakerRef.current = sp; setSpeaker(sp); };
  const clearPause = () => { if (pauseRef.current) { clearTimeout(pauseRef.current); pauseRef.current = null; } };

  // ---------------------------------------------------------------------------
  //  Appel du coach (streaming + parsing partiel + mesure de latence)
  // ---------------------------------------------------------------------------
  const runCoach = useCallback(async (hint, { fallback } = {}) => {
    coachAbortRef.current?.abort();
    const ac = new AbortController();
    coachAbortRef.current = ac;

    const t0 = performance.now();
    let gotFirst = false;

    setError(null);
    setStreaming(true);
    setStatus('thinking');
    setSuggestion({ phrase_a_dire: '', _complete: false });
    setLatency({ first: null, full: null });

    const payload = buildPayload(turnsRef.current, businessRef.current, hint);

    try {
      let lastRaw = '';
      let streamErr = null;
      for await (const raw of streamCoach(payload, { signal: ac.signal })) {
        lastRaw = raw;
        const parsed = parsePartial(raw);
        if (parsed._error) { streamErr = parsed._error; break; }
        setSuggestion(parsed);
        if (!gotFirst && parsed.phrase_a_dire) {
          gotFirst = true;
          setLatency((l) => ({ ...l, first: performance.now() - t0 }));
        }
      }
      if (streamErr) throw new Error(streamErr);
      const final = parsePartial(lastRaw);
      setSuggestion(final);
      setLatency((l) => ({ first: l.first ?? performance.now() - t0, full: performance.now() - t0 }));
    } catch (e) {
      if (e.name === 'AbortError') return;
      // API indisponible (quota, clé sans crédit, réseau…) : en simulation on
      // bascule sur la carte pré-écrite pour que la démo reste jouable sans clé.
      if (fallback) { setSuggestion({ ...fallback, _complete: true, _offline: true }); setError(null); }
      else setError(e.message || String(e));
    } finally {
      setStreaming(false);
      setStatus((prev) => (prev === 'thinking' ? (runningRef.current ? 'listening' : 'idle') : prev));
    }
  }, []);

  const triggerSoon = useCallback(() => {
    clearPause();
    pauseRef.current = setTimeout(() => { pauseRef.current = null; runCoach(); }, TRIGGER_PAUSE_MS);
  }, [runCoach]);

  // ---------------------------------------------------------------------------
  //  Mode micro (Web Speech)
  // ---------------------------------------------------------------------------
  const startMic = useCallback(() => {
    setError(null);
    setSuggestion(null);
    setSpeakerSync('PROSPECT'); // mains-libres : on écoute le prospect par défaut

    if (!micSupported) {
      setError('Reconnaissance vocale non supportée par ce navigateur — utilise Chrome, ou passe en Simulation.');
      return;
    }

    let mic;
    try {
      mic = createMic({
        onInterim: (text) => setInterim({ speaker: speakerRef.current, text }),
        onFinal: (text) => {
          const sp = speakerRef.current;
          setInterim(null);
          setTurns((prev) => pushTurn(prev, sp, text));
          if (sp === 'PROSPECT') triggerSoon(); // pause du prospect → on souffle
        },
        onError: (msg) => setError(typeof msg === 'string' ? msg : 'erreur micro'),
      });
      mic.start();
    } catch (e) {
      setError(e.message || String(e));
      return;
    }
    micRef.current = mic;
    runningRef.current = true;
    setRunning(true);
    setStatus('listening');
  }, [triggerSoon]);

  const stopMic = useCallback(() => {
    clearPause();
    micRef.current?.stop();
    micRef.current = null;
    runningRef.current = false;
    setRunning(false);
    setStatus('idle');
    setInterim(null);
  }, []);

  // Push-to-talk : maintiens pour parler (= MOI), relâche → on réécoute le prospect.
  const talkStart = useCallback(() => { clearPause(); setSpeakerSync('MOI'); }, []);
  const talkEnd = useCallback(() => { setSpeakerSync('PROSPECT'); }, []);
  const toggleSpeaker = useCallback(() => {
    setSpeakerSync(speakerRef.current === 'MOI' ? 'PROSPECT' : 'MOI');
  }, []);

  // ---------------------------------------------------------------------------
  //  Mode simulation (rejoue un scénario, déclenche le coach après chaque PROSPECT)
  // ---------------------------------------------------------------------------
  const startSim = useCallback(async () => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
    setBusinessType(scenario.business_type);
    businessRef.current = scenario.business_type;
    setTurns([]); setSuggestion(null); setError(null); setInterim(null);

    const ac = new AbortController();
    simAbortRef.current = ac;
    runningRef.current = true;
    setRunning(true);
    setStatus('listening');

    try {
      for (const turn of scenario.turns) {
        if (ac.signal.aborted) break;
        setStatus(turn.speaker === 'PROSPECT' ? 'speaking' : 'listening');
        setInterim({ speaker: turn.speaker, text: turn.text });
        await sleep(Math.max(500, turn.delayMs || 1500), ac.signal);
        setInterim(null);
        setTurns((prev) => pushTurn(prev, turn.speaker, turn.text));
        if (turn.speaker === 'PROSPECT') {
          await runCoach(undefined, { fallback: turn.coach });
          await sleep(900, ac.signal); // laisse lire la carte
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || String(e));
    } finally {
      simAbortRef.current = null;
      runningRef.current = false;
      setRunning(false);
      setStatus('idle');
      setInterim(null);
    }
  }, [scenarioId, runCoach]);

  const stopSim = useCallback(() => {
    clearPause();
    simAbortRef.current?.abort();
    coachAbortRef.current?.abort();
    simAbortRef.current = null;
    runningRef.current = false;
    setRunning(false);
    setStatus('idle');
  }, []);

  // ---------------------------------------------------------------------------
  //  Contrôles publics
  // ---------------------------------------------------------------------------
  const toggle = useCallback(() => {
    if (mode === 'simulation') running ? stopSim() : startSim();
    else running ? stopMic() : startMic();
  }, [mode, running, startSim, stopSim, startMic, stopMic]);

  const alternative = useCallback(() => {
    if (turnsRef.current.length) runCoach('Donne une formulation nettement différente.');
  }, [runCoach]);

  const reset = useCallback(() => {
    stopMic(); stopSim();
    setTurns([]); setSuggestion(null); setError(null); setInterim(null);
    setLatency({ first: null, full: null });
  }, [stopMic, stopSim]);

  const changeMode = useCallback((m) => { if (!runningRef.current) setMode(m); }, []);

  useEffect(() => () => { micRef.current?.stop(); simAbortRef.current?.abort(); }, []);

  return {
    // état
    mode, businessType, scenarioId, status, running, turns, interim, speaker,
    suggestion, streaming, error, latency, micSupported,
    // réglages
    setMode: changeMode, setBusinessType, setScenarioId,
    // actions
    toggle, alternative, reset, talkStart, talkEnd, toggleSpeaker,
  };
}
