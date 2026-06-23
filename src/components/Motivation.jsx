import { useEffect, useRef, useState } from 'react';
import { QUOTES } from '../lib/motivation/quotes.js';
import { TRACKS } from '../lib/motivation/tracks.js';

// Portrait avec repli stylisé si l'image n'est pas (encore) déposée dans public/img/.
function Portrait({ src, name, role }) {
  const [ok, setOk] = useState(true);
  return (
    <figure className="sl-portrait">
      {ok ? (
        <img src={src} alt={name} loading="lazy" onError={() => setOk(false)} />
      ) : (
        <div className="sl-portrait-ph">
          <span className="sl-portrait-ph-name">{name}</span>
          <small>dépose <code>{src.replace('/', '')}</code></small>
        </div>
      )}
      <figcaption>
        <strong>{name}</strong>
        <span>{role}</span>
      </figcaption>
    </figure>
  );
}

export default function Motivation() {
  const audioRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState({});
  const [qi, setQi] = useState(0);

  // Citation mise en avant qui tourne
  useEffect(() => {
    const id = setInterval(() => setQi((i) => (i + 1) % QUOTES.length), 7000);
    return () => clearInterval(id);
  }, []);

  const play = (track) => {
    const a = audioRef.current;
    if (!a) return;
    if (current?.id === track.id && playing) {
      a.pause();
      return;
    }
    if (current?.id !== track.id) {
      a.src = track.src;
      setCurrent(track);
    }
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setMissing((m) => ({ ...m, [track.id]: true })));
  };

  return (
    <section className="sl-motivation">
      {/* Héros : citation + portraits */}
      <div className="sl-moti-hero">
        <div className="sl-moti-hero-text">
          <p className="sl-moti-kicker">Avant de décrocher</p>
          <h2 className="sl-moti-quote">« {QUOTES[qi].text} »</h2>
          <p className="sl-moti-author">— {QUOTES[qi].author}</p>
        </div>
        <div className="sl-portraits">
          <Portrait src="/img/belfort.jpg" name="Jordan Belfort" role="Le vrai loup" />
          <Portrait src="/img/dicaprio.jpg" name="Leonardo DiCaprio" role="Le loup à l'écran" />
        </div>
      </div>

      {/* Lecteur MP3 */}
      <div className="sl-moti-audio">
        <h3 className="sl-moti-h3">Passages cultes — Le Loup de Wall Street</h3>
        <audio
          ref={audioRef}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => current && setMissing((m) => ({ ...m, [current.id]: true }))}
        />
        <div className="sl-tracks">
          {TRACKS.map((t) => {
            const isCur = current?.id === t.id;
            const miss = missing[t.id];
            return (
              <button
                key={t.id}
                className={`sl-track ${isCur && playing ? 'playing' : ''} ${miss ? 'missing' : ''}`}
                onClick={() => play(t)}
              >
                <span className="sl-track-play" aria-hidden="true">{isCur && playing ? '❚❚' : '▶'}</span>
                <span className="sl-track-text">
                  <strong>{t.title}</strong>
                  <small>
                    {miss
                      ? `fichier manquant — dépose ${t.src.replace('/audio/', '')} dans public/audio/`
                      : t.subtitle}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="sl-moti-note">
          Dépose tes fichiers MP3 dans <code>public/audio/</code> (voir le README du dossier).
          Usage personnel — n'héberge pas d'extraits protégés sur une URL publique.
        </p>
      </div>

      {/* Mur de citations */}
      <div className="sl-moti-quotes">
        {QUOTES.map((q, i) => (
          <blockquote key={i} className="sl-moti-card">
            <p>« {q.text} »</p>
            <cite>— {q.author}</cite>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
