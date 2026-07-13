import { useState, useRef, useEffect } from 'react'
import './index.css'
import Sidebar from './Sidebar'
import InfiniteCanvas from './InfiniteCanvas'
import logoAgora from './assets/logo-agora.png'

function App() {
  const [subject, setSubject] = useState('')
  const [unit, setUnit] = useState('')
  const [session, setSession] = useState('')
  const [soi, setSoi] = useState('')
  const [conceptos, setConceptos] = useState('')

  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0)
  const [showRoom, setShowRoom] = useState(false)

  const [confirmNewBoard, setConfirmNewBoard] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(true)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const canvasRef = useRef(null)

  const handleDownload = () => {
    if (canvasRef.current) canvasRef.current.download()
  }

  const handleNewBoardClick = () => setConfirmNewBoard(true)
  const confirmNewBoardYes = () => {
    setClearCanvasTrigger(prev => prev + 1)
    setConfirmNewBoard(false)
  }

  const toggleFullscreen = () => {
    const docEl = document.documentElement
    const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen
    const exitFS = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen
    const currentlyFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement

    if (!requestFS && !exitFS) {
      setFullscreenSupported(false)
      return
    }
    if (!currentlyFullscreen) {
      if (requestFS) Promise.resolve(requestFS.call(docEl)).catch(err => console.error(err))
    } else {
      if (exitFS) Promise.resolve(exitFS.call(document)).catch(err => console.error(err))
    }
  }

  useEffect(() => {
    const sync = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement
      setIsFullscreen(!!el)
    }
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
    events.forEach(ev => document.addEventListener(ev, sync))
    return () => events.forEach(ev => document.removeEventListener(ev, sync))
  }, [])

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev)

  return (
    <div className="app" style={{ touchAction: 'manipulation' }}>
      <div className={`main ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="canvas-container">
          <InfiniteCanvas
            ref={canvasRef}
            subject={subject}
            unit={unit}
            session={session}
            clearTrigger={clearCanvasTrigger}
            showRoom={showRoom}
            onToggleRoom={() => setShowRoom(prev => !prev)}
            onNewBoard={handleNewBoardClick}
            onDownload={handleDownload}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
          />
        </div>

        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={isSidebarOpen ? 'Amagar panell lateral' : 'Mostrar panell lateral'}
          aria-label="Alternar panel lateral"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            {isSidebarOpen ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>

        <aside className={`sidebar-panel ${isSidebarOpen ? 'open' : 'closed'}`}>
          <Sidebar />
        </aside>
      </div>

      <header className="header">
        <div className="header-fields">
          <div className="field-box" style={{ flex: '1 1 160px', minWidth: '140px', maxWidth: '220px' }}>
            <label>Subject:</label>
            <input type="text" placeholder="p. ex. Design" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="field-box unit-box">
            <label>Unit:</label>
            <input type="text" placeholder="p. ex. Unit 3" value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
          <div className="field-box" style={{ flex: '1 1 140px', minWidth: '120px', maxWidth: '200px' }}>
            <label>Session:</label>
            <input type="text" placeholder="p. ex. Sessió 1" value={session} onChange={e => setSession(e.target.value)} />
          </div>
          <div className="field-box soi-box">
            <label>SOI:</label>
            <input type="text" placeholder="Statement of Inquiry…" value={soi} onChange={e => setSoi(e.target.value)} />
          </div>
          <div className="field-box concepts-row concepts-box">
            <label>Conceptos:</label>
            <input type="text" placeholder="Conceptes clau" value={conceptos} onChange={e => setConceptos(e.target.value)} />
          </div>
        </div>
        <img src={logoAgora} alt="Logo Agora" className="school-logo" />
      </header>

      {confirmNewBoard && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,35,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
          onPointerDown={e => { if (e.target === e.currentTarget) setConfirmNewBoard(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: 14, padding: '22px 24px', maxWidth: 360,
            boxShadow: '0 24px 60px rgba(20,30,45,0.35)', fontFamily: "'Inter', sans-serif",
          }}>
            <p style={{ margin: '0 0 18px', fontSize: 15, color: '#1B2733', lineHeight: 1.5 }}>
              Segur que vols començar una pissarra en blanc? Si no l'has descarregat, perdràs la feina actual.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="util-btn" style={{ background: '#E4E9EF', color: '#1B2733', minHeight: 44, padding: '0 16px' }} onClick={() => setConfirmNewBoard(false)}>Cancel·lar</button>
              <button className="util-btn" style={{ background: '#EB5A2E', color: '#fff', minHeight: 44, padding: '0 16px' }} onClick={confirmNewBoardYes}>Sí, nova pissarra</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App