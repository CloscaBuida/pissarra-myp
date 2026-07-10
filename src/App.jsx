import { useState, useRef } from 'react'
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

  // Referència per cridar mètodes del canvas
  const canvasRef = useRef(null)

  const handleDownload = () => {
    if (canvasRef.current) {
      canvasRef.current.download()
    }
  }

  // 2. FUNCIÓ "NOVA PISSARRA"
  const handleNewBoardClick = () => {
    if (window.confirm("Segur que vols començar una pissarra en blanc? Si no l'has descarregat, perdràs la feina actual.")) {
      setClearCanvasTrigger(prev => prev + 1)
    }
  }

  // 3. FUNCIÓ "PANTALLA COMPLETA" (Corregida per entrar/sortir a la PDI)
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

    const isFullscreen = document.fullscreenElement || 
                         document.webkitFullscreenElement || 
                         document.mozFullScreenElement || 
                         document.msFullscreenElement;

    if (!isFullscreen) {
      if (requestFS) {
        requestFS.call(docEl).catch(err => {
          console.error("Error al entrar en pantalla completa:", err);
        });
      }
    } else {
      if (exitFS) {
        exitFS.call(document).catch(err => {
          console.error("Error al sortir de pantalla completa:", err);
        });
      }
    }
  }

  return (
    <div className="app">
      {/* LA BARRA UTILITY-STRIP S'HA ELIMINAT PER GUANYAR ESPAI */}

      <header className="header" style={{ position: 'relative' }}>
        
        {/* NOVA FILA SUPERIOR INTERNA: Botons compactes dins del header blau */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: '12px', color: '#a0aec0', fontWeight: '500' }}>Pissarra Interactiva MYP <span style={{ color: '#48bb78' }}>✓ Desat</span></span>
          
          <div style={{ display: 'flex', gap: '8px' }}>
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
            <button className="util-btn" onClick={toggleFullscreen} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              Pantalla Completa
            </button>
          </div>
        </div>

        {/* CAMPS DE TEXT MODULARS */}
        <div className="header-fields">
          <div className="field-box" style={{ flex: '0 0 200px' }}>
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
          <div className="field-box" style={{ flex: '0 0 180px' }}>
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
    </div>
  )
}

export default App