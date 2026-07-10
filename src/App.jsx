import { useState, useRef } from 'react'
import './index.css'
import Sidebar from './Sidebar'
import InfiniteCanvas from './InfiniteCanvas'

function App() {
  const [subject, setSubject] = useState('')
  const [unit, setUnit] = useState('')
  const [session, setSession] = useState('')
  const [soi, setSoi] = useState('')
  const [conceptos, setConceptos] = useState('')

  // 1. ESTAT DEL PONT (Trigger per avisar al canvas que s'ha de netejar)
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)

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
      // Això suma 1, enviant un senyal a l'InfiniteCanvas perquè s'esborri
      setClearCanvasTrigger(prev => prev + 1)
    }
  }

  // 3. FUNCIÓ "PANTALLA COMPLETA"
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("El teu navegador no permet la pantalla completa: ", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  return (
    <div className="app">
      <div className="utility-strip">
        <span className="save-indicator">Desat ✓</span>
        
        {/* Botó connectat a la funció de neteja */}
        <button className="util-btn" title="Començar una pissarra nova" onClick={handleNewBoardClick}>
          Nova pissarra
        </button>
        
        <button className="util-btn" title="Descarregar imatge" onClick={handleDownload}>
          Descarregar
        </button>

        {/* Nou botó per a la Pantalla Completa */}
        <button className="util-btn" title="Pantalla completa" onClick={toggleFullscreen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ verticalAlign: 'middle', marginRight: '6px', marginBottom: '2px' }}>
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          Pantalla Completa
        </button>
      </div>

      {/* Afegit position: relative per poder col·locar el logo absolutament respecte a la capçalera */}
      <header className="header" style={{ position: 'relative' }}>
        <div className="header-fields">
          <div className="field-box" style={{ flex: '0 0 220px' }}>
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
          <div className="field-box" style={{ flex: '0 0 220px' }}>
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
          src="/logo-agora.png" 
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
          clearTrigger={clearCanvasTrigger} /* 4. PASSEM EL PONT AL CANVAS */
        />
        <Sidebar />
      </div>
    </div>
  )
}

export default App