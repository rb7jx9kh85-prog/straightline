import { useEffect, useRef, useState } from 'react';
import { QUOTES } from '../lib/motivation/quotes.js';
import { TRACKS } from '../lib/motivation/tracks.js';

const GALLERY = [
  { src: '/img/dicaprio-fist.jpg', cap: "L'énergie du closer" },
  { src: '/img/dicaprio-dollar.jpg', cap: 'Vends-moi ce billet' },
  { src: '/img/wolf-poster.jpg', cap: 'The Wolf of Wall Street' },
];

const HERO_IMG = '/img/dicaprio-arms.jpg';

function fmt(s) {
  if (!s || Number.isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function Motivation() {
  const audioRef = useRef(null);
  const [track] = useState(TRACKS[0] || null);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [qi, setQi] = useState(0);
  const [heroOk, setHeroOk] = useState(true);

  // Citation mise en avant qui tourne
  useEffect(() => {
    const id = setInterval(() => setQi((i) => (i + 1) % QUOTES.length), 7000);
    return () => clearInterval(id);
  }, []);

  // Vérifie discrètement si l'image héros existe (pour le repli stylisé)
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHeroOk(true);
    img.onerror = () => setHeroOk(false);
    img.src = HERO_IMG;
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !track) return;
    if (playing) {
      a.pause();
      return;
    }
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setMissing(true));
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * dur;
  };

  const pct = dur ? (cur / dur) * 100 : 0;

  return (
    <section className="sl-motivation">
      {/* Héros cinématique */}
      <div
        className={`sl-moti-hero ${heroOk ? 'has-img' : ''}`}
        style={heroOk ? { backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.25), rgba(10,10,11,0.92)), url(${HERO_IMG})` } : undefined}
      >
        <p className="sl-moti-kicker">Avant de décrocher</p>
        <h2 className="sl-moti-quote">« {QUOTES[qi].text} »</h2>
        <p className="sl-moti-author">— {QUOTES[qi].author}</p>
      </div>

      {/* Lecteur du discours */}
      {track && (
        <div className="sl-moti-audio">
          <h3 className="sl-moti-h3">Le discours qui met dans le bain</h3>
          <audio
            ref={audioRef}
            src={track.src}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setMissing(true)}
            onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          />
          <div className={`sl-player ${playing ? 'playing' : ''} ${missing ? 'missing' : ''}`}>
            <button className="sl-player-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="sl-player-body">
              <strong>{track.title}</strong>
              <small>{missing ? `fichier manquant — dépose ${track.src.replace('/audio/', '')} dans public/audio/` : track.subtitle}</small>
              <div className="sl-player-bar" onClick={seek}>
                <span className="sl-player-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="sl-player-time">
                <span>{fmt(cur)}</span>
                <span>{fmt(dur)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Galerie */}
      <div className="sl-gallery">
        {GALLERY.map((g, i) => (
          <figure key={i} className="sl-shot">
            <img src={g.src} alt={g.cap} loading="lazy" onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
            <figcaption>{g.cap}</figcaption>
          </figure>
        ))}
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

      <p className="sl-moti-note">
        Visuels &amp; audio : Le Loup de Wall Street (© Paramount). Usage personnel — pense aux droits
        d'auteur si tu rends l'app publique.
      </p>
    </section>
  );
}
