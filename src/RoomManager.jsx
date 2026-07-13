import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

const PEER_SERVER = {
  host: '0.peerjs.com',
  port: 443,
  secure: true,
};

export default function RoomManager({ getCanvasState, setCanvasState }) {
  const [peer, setPeer] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [status, setStatus] = useState('Desconnectat');
  const connRef = useRef(null);

  const getCanvasStateRef = useRef(getCanvasState);
  const setCanvasStateRef = useRef(setCanvasState);

  useEffect(() => {
    getCanvasStateRef.current = getCanvasState;
  }, [getCanvasState]);

  useEffect(() => {
    setCanvasStateRef.current = setCanvasState;
  }, [setCanvasState]);

  const generateCode = () => 'MYP-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  // BROADCAST: es defineix UNA VEGADA i es neteja només al desmuntar
  useEffect(() => {
    console.log('📢 Definint broadcastCanvasUpdate');
    window.broadcastCanvasUpdate = () => {
      console.log('📤 broadcastCanvasUpdate cridat');
      if (connRef.current && connRef.current.open) {
        const state = getCanvasStateRef.current();
        console.log('Enviant estat amb', state?.length, 'traços');
        connRef.current.send({ type: 'sync', data: state });
      } else {
        console.warn('⚠️ Connexió no oberta o no establerta');
      }
    };
    // Netejar NOMÉS al desmuntar complet
    return () => {
      console.log('🧹 Esborrant broadcastCanvasUpdate');
      delete window.broadcastCanvasUpdate;
    };
  }, []);

  // Netejar el peer quan canvïi, però NO tocar broadcast
  useEffect(() => {
    return () => {
      if (peer) {
        console.log('🧹 Destroying peer');
        peer.destroy();
      }
    };
  }, [peer]);

  const startHosting = () => {
    const code = generateCode();
    setStatus('Iniciant...');
    console.log('🏠 Iniciant host amb codi:', code);

    const newPeer = new Peer(code, { config: PEER_SERVER });

    newPeer.on('open', (id) => {
      console.log('✅ Host obert amb ID:', id);
      setRoomCode(id);
      setStatus('Host');
    });

    newPeer.on('connection', (conn) => {
      console.log('🔗 Nova connexió del client:', conn.peer);
      connRef.current = conn;
      setStatus('Professor connectat!');

      conn.on('open', () => {
        console.log('📡 Connexió oberta, enviant estat actual');
        const currentState = getCanvasStateRef.current();
        console.log('Enviant', currentState?.length, 'traços');
        if (currentState && currentState.length > 0) {
          conn.send({ type: 'sync', data: currentState });
        }
      });

      conn.on('data', (message) => {
        console.log('📩 Host ha rebut:', message);
        if (message.type === 'sync') {
          setCanvasStateRef.current(message.data);
        }
      });

      conn.on('close', () => {
        console.log('❌ Connexió tancada');
        setStatus('Host (desconnectat)');
      });
    });

    newPeer.on('error', (err) => {
      console.error('🚨 Error de peer:', err);
      setStatus('Error: ' + err.message);
    });

    setPeer(newPeer);
  };

  const joinRoom = () => {
    if (!joinCode) return;
    setStatus('Connectant...');
    console.log('🔑 Unint-se a la sala:', joinCode);

    const newPeer = new Peer({ config: PEER_SERVER });

    newPeer.on('open', (id) => {
      console.log('✅ Client obert amb ID:', id);
      const conn = newPeer.connect(joinCode.toUpperCase());
      connRef.current = conn;

      conn.on('open', () => {
        console.log('📡 Connectat al host');
        setStatus('Connectat a l\'aula!');
      });

      conn.on('data', (message) => {
        console.log('📩 Client ha rebut:', message);
        if (message.type === 'sync') {
          setCanvasStateRef.current(message.data);
        }
      });

      conn.on('close', () => {
        console.log('❌ Connexió tancada');
        setStatus('Desconnectat');
      });
    });

    newPeer.on('error', (err) => {
      console.error('🚨 Error de peer:', err);
      setStatus('Error: ' + err.message);
    });

    setPeer(newPeer);
  };

  return (
    <div style={{ 
      position: 'absolute', 
      bottom: 30, 
      right: 30, 
      background: 'white', 
      padding: '15px', 
      borderRadius: '8px', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
      zIndex: 100 
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#123B61' }}>🌐 Portal MYP (Debug)</h3>
      
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
      <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>Obre la consola (F12) per veure logs</div>
    </div>
  );
}