import { useState, useRef, useEffect } from 'react'
import './index.css'
import Sidebar from './Sidebar'
import InfiniteCanvas from './InfiniteCanvas'
import logoAgora from './assets/logo-agora.png';
 
function App() {
  const [subject, setSubject] = useState('')
  const [unit, setUnit] = useState('')
  const [session, setSession] = useState('')
  const [soi, setSoi] = useState('')
  const [conceptos, setConceptos] = useState('')
 
  // 1. ESTATS DELS TRIGGERS I VISIBILITAT
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)
  const [showRoom, setShowRoom] = useState(false) // Controla si es mostra o s'amaga el Portal MYP
 
  // Confirmació de "Nova pissarra": substitueix window.confirm(), que moltes
  // PDI amb navegador incrustat (SMART, Promethean, Newline, BenQ...) bloquegen
  // o no mostren correctament, deixant el botó com si "no fes res".
  const [confirmNewBoard, setConfirmNewBoard] = useState(false)
 
  // Estat real de pantalla completa i suport de la Fullscreen API.
  // Moltes PDI ja executen el navegador en mode kiosk propi i bloquegen l'API,
  // o l'usuari en surt amb el botó físic de la pissarra sense que la nostra UI
  // se n'assabenti; per això sincronitzem l'estat amb l'esdeveniment del navegador.
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(true)
 
  // Referència per cridar mètodes del canvas
  const canvasRef = useRef(null)
 
  const handleDownload = () => {
    if (canvasRef.current) {
      canvasRef.current.download()
    }
  }
 
  // 2. FUNCIÓ "NOVA PISSARRA" (ara obre un modal propi en lloc de window.confirm)
  const handleNewBoardClick = () => {
    setConfirmNewBoard(true)
  }
 
  const confirmNewBoardYes = () => {
    setClearCanvasTrigger(prev => prev + 1)
    setConfirmNewBoard(false)
  }
 
  // 3. FUNCIÓ "PANTALLA COMPLETA"
  const toggleFullscreen = () => {
    const docEl = document.documentElement;
 
    const requestFS = docEl.requestFullscreen ||
                      docEl.webkitRequestFullscreen ||
                      docEl.mozRequestFullScreen ||
                      docEl.msRequestFullscreen;
 
    // A les PDI el mètode de sortida sol requerir CancelFullScreen en lloc de Exit
    const exitFS = document.exitFullscreen ||
                   document.webkitExitFullscreen ||
                   document.webkitCancelFullScreen ||
                   document.mozCancelFullScreen ||
                   document.msExitFullscreen;
 
    const currentlyFullscreen = document.fullscreenElement ||
                         document.webkitFullscreenElement ||
                         document.mozFullScreenElement ||
                         document.msFullscreenElement;
 
    if (!requestFS && !exitFS) {
      // Aquesta PDI no admet la Fullscreen API: amaguem el botó en lloc
      // de deixar-lo com a "mort" o fer servir alert() (poc fiable en PDI).
      setFullscreenSupported(false);
      return;
    }
 
    if (!currentlyFullscreen) {
      if (requestFS) {
        Promise.resolve(requestFS.call(docEl)).catch(err => {
          console.error("Error al entrar en pantalla completa:", err);
        });
      }
    } else {
      if (exitFS) {
        Promise.resolve(exitFS.call(document)).catch(err => {
          console.error("Error al sortir de pantalla completa:", err);
        });
      }
    }
  }
 
  useEffect(() => {
    const syncFullscreenState = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement ||
                   document.mozFullScreenElement || document.msFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(evt => document.addEventListener(evt, syncFullscreenState));
    return () => events.forEach(evt => document.removeEventListener(evt, syncFullscreenState));
  }, []);
 
  return (
    <div className="app" style={{ touchAction: 'manipulation' }}>
      {/* LA BARRA UTILITY-STRIP S'HA ELIMINAT PER GUANYAR ESPAI */}
 
      <header className="header" style={{ position: 'relative' }}>
 
        {/* NOVA FILA SUPERIOR INTERNA: Botons compactes dins del header blau */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', rowGap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#a0aec0', fontWeight: '500' }}>Pissarra Interactiva MYP <span style={{ color: '#48bb78' }}>✓ Desat</span></span>
 
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="util-btn"
              onClick={() => setShowRoom(!showRoom)}
              style={{ background: showRoom ? '#eb5a2e' : 'rgba(255,255,255,0.15)', borderColor: showRoom ? '#eb5a2e' : 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}
            >
              🌐 {showRoom ? 'Amagar Portal' : 'Connectar Aula'}
            </button>
            <button className="util-btn" onClick={handleNewBoardClick}>
              Nova pissarra
            </button>
            <button className="util-btn" onClick={handleDownload}>
              Descarregar
            </button>
            {fullscreenSupported && (
              <button className="util-btn" onClick={toggleFullscreen} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
                {isFullscreen ? 'Sortir de pantalla completa' : 'Pantalla Completa'}
              </button>
            )}
          </div>
        </div>
 
        {/* CAMPS DE TEXT MODULARS */}
        <div className="header-fields" style={{ flexWrap: 'wrap', rowGap: '8px' }}>
          <div className="field-box" style={{ flex: '1 1 160px', minWidth: '140px', maxWidth: '220px' }}>
            <label>Subject:</label>
            <input
              type="text"
              placeholder="p. ex. Design"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="field-box unit-box">
            <label>Unit:</label>
            <input
              type="text"
              placeholder="p. ex. Unit 3"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          <div className="field-box" style={{ flex: '1 1 140px', minWidth: '120px', maxWidth: '200px' }}>
            <label>Session:</label>
            <input
              type="text"
              placeholder="p. ex. Sessió 1"
              value={session}
              onChange={(e) => setSession(e.target.value)}
            />
          </div>
          <div className="field-box soi-box">
            <label>SOI:</label>
            <input
              type="text"
              placeholder="Statement of Inquiry…"
              value={soi}
              onChange={(e) => setSoi(e.target.value)}
            />
          </div>
          <div className="field-box concepts-row concepts-box">
            <label>Conceptos:</label>
            <input
              type="text"
              placeholder="Conceptes clau"
              value={conceptos}
              onChange={(e) => setConceptos(e.target.value)}
            />
          </div>
        </div>
 
        {/* LOGO DE L'ESCOLA */}
        <img
          src={logoAgora}
          alt="Logo Agora"
          className="school-logo"
        />
 
        <svg className="wave" viewBox="0 0 1600 100" preserveAspectRatio="none">
          <path d="M0,45 C300,110 650,0 1000,35 C1250,60 1450,20 1600,40 L1600,100 L0,100 Z" fill="var(--bg)"/>
        </svg>
      </header>
 
      <div className="main">
        <InfiniteCanvas
          ref={canvasRef}
          subject={subject}
          unit={unit}
          session={session}
          clearTrigger={clearCanvasTrigger}
          showRoom={showRoom} /* 4. PASSEM EL PROP DE VISIBILITAT AL CANVAS */
        />
        <Sidebar />
      </div>
 
      {/* Modal de confirmació "Nova pissarra" (substitueix window.confirm) */}
      {confirmNewBoard && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,35,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) setConfirmNewBoard(false); }}
        >
          <div style={{
            background: '#fff', borderRadius: 14, padding: '22px 24px', maxWidth: 360,
            boxShadow: '0 24px 60px rgba(20,30,45,0.35)', fontFamily: "'Inter', sans-serif",
          }}>
            <p style={{ margin: '0 0 18px', fontSize: 15, color: '#1B2733', lineHeight: 1.5 }}>
              Segur que vols començar una pissarra en blanc? Si no l'has descarregat, perdràs la feina actual.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="util-btn"
                style={{ background: '#E4E9EF', color: '#1B2733', minHeight: 44, padding: '0 16px' }}
                onClick={() => setConfirmNewBoard(false)}
              >
                Cancel·lar
              </button>
              <button
                className="util-btn"
                style={{ background: '#EB5A2E', color: '#fff', minHeight: 44, padding: '0 16px' }}
                onClick={confirmNewBoardYes}
              >
                Sí, nova pissarra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
 
export default App