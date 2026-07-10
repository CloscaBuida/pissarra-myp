import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

export default function RoomManager({ getCanvasState, setCanvasState }) {
  const [peer, setPeer] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [status, setStatus] = useState('Desconnectat'); // Desconnectat, Host, Connectat
  const connRef = useRef(null);

  // Generem un codi curt tipus "MYP-4A2B"
  const generateCode = () => 'MYP-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  // --- MODE AULA (HOST) ---
  const startHosting = () => {
    const code = generateCode();
    setStatus('Iniciant...');
    
    // Connectem al servidor de PeerJS amb el nostre codi personalitzat
    const newPeer = new Peer(code);
    
    newPeer.on('open', (id) => {
      setRoomCode(id);
      setStatus('Host');
    });

    // Quan el professor (client) es connecta a l'aula
    newPeer.on('connection', (conn) => {
      connRef.current = conn;
      setStatus('Professor connectat!');
      
      conn.on('open', () => {
        // Just en connectar-se, li enviem l'estat actual de la pissarra
        const currentState = getCanvasState();
        conn.send({ type: 'sync', data: currentState });
      });

      // Si el professor dibuixa des del seu ordinador, ho rebem aquí
      conn.on('data', (message) => {
        if (message.type === 'sync') {
          setCanvasState(message.data);
        }
      });
    });

    setPeer(newPeer);
  };

  // --- MODE PROFESSOR (CLIENT) ---
  const joinRoom = () => {
    if (!joinCode) return;
    setStatus('Connectant...');
    
    const newPeer = new Peer(); // El client no necessita un ID específic
    
    newPeer.on('open', () => {
      const conn = newPeer.connect(joinCode.toUpperCase());
      connRef.current = conn;

      conn.on('open', () => {
        setStatus('Connectat a l\'aula!');
      });

      // Quan la pissarra de l'aula s'actualitza, rebem les dades
      conn.on('data', (message) => {
        if (message.type === 'sync') {
          setCanvasState(message.data);
        }
      });
    });

    setPeer(newPeer);
  };

  // Funció per forçar la sincronització (es cridarà des del Canvas quan dibuixis)
  useEffect(() => {
    // Això és un petit "hack" per exposar la funció d'enviament a la finestra global
    // perquè el teu InfiniteCanvas pugui avisar quan hi ha un traç nou.
    window.broadcastCanvasUpdate = () => {
      if (connRef.current && connRef.current.open) {
        connRef.current.send({ type: 'sync', data: getCanvasState() });
      }
    };
  }, [getCanvasState]);

  return (
    <div style={{ position: 'absolute', top: 20, right: 20, background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100 }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#123B61' }}>🌐 Portal MYP</h3>
      
      {status === 'Desconnectat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="tool-btn" style={{ width: '100%', background: '#2B6CB0', color: 'white' }} onClick={startHosting}>
            👨‍🏫 Iniciar Sessió (Aula)
          </button>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="text" 
              placeholder="Ex: MYP-ABCD" 
              value={joinCode} 
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ width: '100px', padding: '5px' }}
            />
            <button className="tool-btn" onClick={joinRoom}>Unir-se</button>
          </div>
        </div>
      )}

      {status === 'Host' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Codi de la sala:</p>
          <h2 style={{ margin: '5px 0', color: '#EB5A2E', letterSpacing: '2px' }}>{roomCode}</h2>
          <p style={{ margin: 0, fontSize: '11px', color: 'gray' }}>Esperant professor...</p>
        </div>
      )}

      {(status === 'Professor connectat!' || status === 'Connectat a l\'aula!') && (
        <div style={{ textAlign: 'center', color: '#2E8B57', fontWeight: 'bold' }}>
          ✓ {status}
        </div>
      )}
    </div>
  );
}