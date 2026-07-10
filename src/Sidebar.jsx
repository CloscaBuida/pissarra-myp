import { useState, useEffect, useRef } from 'react';

// Aquest component és només UNA fila del Lesson Plan. Com que l'hem aïllat, 
// en podem posar tants com vulguem i cadascun tindrà el seu propi rellotge.
function TimerRow({ number }) {
  const [status, setStatus] = useState('idle'); // idle, running, paused, finished
  const [rawMin, setRawMin] = useState('');
  const [activity, setActivity] = useState('');
  const [remainingSec, setRemainingSec] = useState(0);

  const audioCtxRef = useRef(null);

  // Funció per fer sonar el "beep" en acabar
  const beep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      [0, 0.22].forEach(delay => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.001, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.2);
      });
    } catch(e) {}
  };

  // El motor del temporitzador que descompta els segons automàticament
  useEffect(() => {
    let interval;
    if (status === 'running') {
      interval = setInterval(() => {
        setRemainingSec((prev) => {
          if (prev <= 1) {
            setStatus('finished');
            beep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const toggleTimer = () => {
    if (status === 'idle') {
      const mins = Math.max(0.1, parseFloat(rawMin) || 5);
      setRemainingSec(Math.round(mins * 60));
      setStatus('running');
    } else if (status === 'running') {
      setStatus('paused');
    } else if (status === 'paused') {
      setStatus('running');
    } else if (status === 'finished') {
      const mins = Math.max(0.1, parseFloat(rawMin) || 5);
      setRemainingSec(Math.round(mins * 60));
      setStatus('running');
    }
  };

  const resetTimer = () => {
    setStatus('idle');
    setRemainingSec(0);
    setRawMin('');
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="side-row lesson-row" data-state={status}>
      <span className="pentagon">{number}</span>
      <button className="timer-btn" onClick={toggleTimer}>
        {status === 'running' ? (
          <svg className="icon-pause" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{display: 'block', width: '12px', height: '12px'}}><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
        ) : status === 'finished' ? (
          <svg className="icon-replay" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{display: 'block', width: '12px', height: '12px'}}><path d="M4 4v6h6"/><path d="M4.5 13a8 8 0 1 0 2-8.6L4 10"/></svg>
        ) : (
          <svg className="icon-play" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{display: 'block', width: '12px', height: '12px'}}><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <button className="reset-btn" onClick={resetTimer} title="Reiniciar">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '12px', height: '12px', stroke: 'var(--muted)'}}><path d="M4 7h16"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>
      </button>
      <input 
        className="lp-min" 
        placeholder="min" 
        value={status === 'idle' ? rawMin : formatTime(remainingSec)}
        onChange={(e) => setRawMin(e.target.value)}
        readOnly={status !== 'idle'}
      />
      <input 
        className="lp-text" 
        placeholder="Activitat" 
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
      />
    </div>
  );
}

// Aquest és el bloc sencer de la barra lateral que agrupa tot
export default function Sidebar() {
  const [objA, setObjA] = useState('');
  const [objB, setObjB] = useState('');
  const [objC, setObjC] = useState('');

  return (
    <aside className="sidebar">
      <div className="side-section">
        <h3>Objectives
          <svg className="icon-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#EB5A2E" strokeWidth="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="#EB5A2E" strokeWidth="2"/><circle cx="12" cy="12" r="1.6" fill="#EB5A2E"/></svg>
        </h3>
        <div className="side-row"><span className="pentagon">A</span><input className="side-input" placeholder="Objectiu 1" value={objA} onChange={e => setObjA(e.target.value)}/></div>
        <div className="side-row"><span className="pentagon">B</span><input className="side-input" placeholder="Objectiu 2" value={objB} onChange={e => setObjB(e.target.value)}/></div>
        <div className="side-row"><span className="pentagon">C</span><input className="side-input" placeholder="Objectiu 3" value={objC} onChange={e => setObjC(e.target.value)}/></div>
      </div>

      <div className="side-section">
        <h3>Lesson Plan
          <svg className="icon-clip" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="#123B61" strokeWidth="1.6"/><circle cx="15" cy="15" r="4.2" fill="#fff" stroke="#EB5A2E" strokeWidth="1.6"/><path d="M15 13v2l1.3 1.3" stroke="#EB5A2E" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </h3>
        {/* Aquí cridem el nostre mini-component 3 vegades seguides */}
        <TimerRow number="1" />
        <TimerRow number="2" />
        <TimerRow number="3" />
      </div>
    </aside>
  );
}