import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import RoomManager from './RoomManager';

// Genera un identificador únic per agrupar traços
let __groupSeq = 0;
const newGroupId = () => `g${Date.now()}_${(__groupSeq++)}`;

// Distància d'un punt a un segment (hit-testing independent del zoom)
const distToSegmentWorld = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

// Rota un punt world al voltant d'un centre, un angle donat (radians)
const rotatePointAround = (p, center, angle) => {
  const dx = p.x - center.x, dy = p.y - center.y;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
};

// Mida i posició (en px de pantalla) de les nanses de rotar/escalar
const HANDLE_SIZE = 15;
const HANDLE_HIT_TOLERANCE = 10;
const ROTATE_HANDLE_OFFSET = 34;
const WHEEL_SCALE_STEP = 0.06;
const WHEEL_ROTATE_STEP = Math.PI / 24;

// Noms dels pinzells
const BRUSH_LABELS = {
  pencil: 'Llapis', marker: 'Retolador', highlighter: 'Fluorescent', spray: 'Esprai',
  neon: 'Neó', calligraphy: 'Cal·ligrafia', chalk: 'Guix', dotted: 'Punts',
};

// Paleta de colors
const PALETTE_COLORS = ['#123B61', '#1B2733', '#EB5A2E', '#2E8B57', '#2B6CB0', '#8E44AD'];

const InfiniteCanvas = forwardRef(({ subject, unit, session, clearTrigger }, ref) => {
  const [mode, setMode] = useState('draw');
  const [color, setColor] = useState('#123B61');
  const [brush, setBrush] = useState('pencil');
  const [thick, setThick] = useState(4);
  const [zoomLabel, setZoomLabel] = useState('100%');
  const [mathMenuOpen, setMathMenuOpen] = useState(false);
  const [show3DPanel, setShow3DPanel] = useState(false);
  const [selectionUI, setSelectionUI] = useState(null);
  const mathMenuRef = useRef(null);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const engineRef = useRef({
    ctx: null, strokes: [], currentStroke: null,
    panX: 0, panY: 0, scale: 1,
    lastPx: null, panStart: null, activeTextArea: null,
    selectedGroupId: null, dragStart: null,
    transformMode: null, transformCenter: null, transformLast: null,
    redraw: null
  });

  // --- triggerUpdate ara accepta un paràmetre per controlar si ha d'emetre ---
  const triggerUpdate = (emitir = true) => {
    const eng = engineRef.current;
    if (!eng.redraw) return;
    eng.redraw();
    if (canvasRef.current) {
      void canvasRef.current.offsetHeight;
    }
    requestAnimationFrame(() => {
      eng.redraw();
      requestAnimationFrame(() => {
        eng.redraw();
      });
    });
    // Només emetem si és una acció local (no una recepció remota)
    if (emitir && window.broadcastCanvasUpdate) {
      window.broadcastCanvasUpdate();
    }
  };

  // En sortir del mode "seleccionar", esborrem la selecció visible.
  useEffect(() => {
    if (mode !== 'select') {
      engineRef.current.selectedGroupId = null;
      engineRef.current.transformMode = null;
      if (engineRef.current.redraw) engineRef.current.redraw();
    }
  }, [mode]);

  const uiRef = useRef({ mode, color, brush, thick });
  useEffect(() => { uiRef.current = { mode, color, brush, thick }; }, [mode, color, brush, thick]);

  // --- clearTrigger: esborra tota la pissarra i emet (acció local) ---
  useEffect(() => {
    if (clearTrigger > 0) {
      engineRef.current.strokes = [];
      engineRef.current.panX = 0;
      engineRef.current.panY = 0;
      engineRef.current.scale = 1;
      setZoomLabel('100%');
      // Això ja emetrà perquè triggerUpdate per defecte ho fa
      triggerUpdate();
    }
  }, [clearTrigger]);

  // Tanca el menú de "Mates" en clicar fora.
  useEffect(() => {
    if (!mathMenuOpen) return;
    const handleClickOutside = (e) => {
      if (mathMenuRef.current && !mathMenuRef.current.contains(e.target)) {
        setMathMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [mathMenuOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const eng = engineRef.current;
    const dpr = window.devicePixelRatio || 1;
    let lastW = 0, lastH = 0;

    const setupCanvas = () => {
      const rect = wrap.getBoundingClientRect();
      if (Math.abs(rect.width - lastW) < 2 && Math.abs(rect.height - lastH) < 2) return;
      lastW = rect.width; lastH = rect.height;

      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      eng.ctx = canvas.getContext('2d');
      eng.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (eng.redraw) eng.redraw();
    };

    const worldToScreen = (p) => ({ x: p.x * eng.scale + eng.panX, y: p.y * eng.scale + eng.panY });
    const screenToWorld = (p) => ({ x: (p.x - eng.panX) / eng.scale, y: (p.y - eng.panY) / eng.scale });

    const drawGrid = (w, h) => {
      const spacing = 42 * eng.scale;
      if (spacing < 10) return;
      eng.ctx.save();
      eng.ctx.fillStyle = '#E4E9EF';
      const offX = ((eng.panX % spacing) + spacing) % spacing;
      const offY = ((eng.panY % spacing) + spacing) % spacing;
      for (let x = offX; x < w; x += spacing) {
        for (let y = offY; y < h; y += spacing) {
          eng.ctx.beginPath(); eng.ctx.arc(x, y, 1.3, 0, Math.PI * 2); eng.ctx.fill();
        }
      }
      eng.ctx.restore();
    };

    const renderSprayDot = (c, x, y, baseW, color) => {
      c.save(); c.fillStyle = color;
      const count = 3;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2, r = Math.random() * baseW * 1.3;
        c.globalAlpha = 0.35 + Math.random() * 0.35;
        c.beginPath();
        c.arc(x + Math.cos(angle) * r, y + Math.sin(angle) * r, Math.max(0.6, baseW * 0.09), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    };

    const renderSegment = (c, b, x1, y1, x2, y2, color, baseW) => {
      c.save();
      c.lineCap = 'round'; c.lineJoin = 'round';
      const dist = Math.hypot(x2 - x1, y2 - y1);
      switch (b) {
        case 'marker':
          c.globalAlpha = 0.92; c.strokeStyle = color; c.lineWidth = baseW * 1.7;
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          break;
        case 'highlighter':
          c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.5;
          c.strokeStyle = color; c.lineWidth = baseW * 3.2;
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          break;
        case 'neon':
          c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = baseW * 2;
          c.lineWidth = baseW * 0.9; c.globalAlpha = 0.95;
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          c.shadowBlur = 0; c.lineWidth = Math.max(1, baseW * 0.35); c.strokeStyle = '#ffffff'; c.globalAlpha = 0.9;
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          break;
        case 'dotted':
          c.strokeStyle = color; c.lineWidth = baseW;
          c.setLineDash([Math.max(2, baseW * 0.3), Math.max(4, baseW * 1.6)]);
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          break;
        case 'chalk':
          for (let i = 0; i < 3; i++) {
            const jx = (Math.random() - 0.5) * baseW * 0.5, jy = (Math.random() - 0.5) * baseW * 0.5;
            c.globalAlpha = 0.22 + Math.random() * 0.18;
            c.strokeStyle = color; c.lineWidth = baseW * (0.7 + Math.random() * 0.5);
            c.beginPath(); c.moveTo(x1 + jx, y1 + jy); c.lineTo(x2 + jx, y2 + jy); c.stroke();
          }
          break;
        case 'spray':
          const steps = Math.max(1, Math.round(dist / 3));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps; renderSprayDot(c, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, baseW, color);
          }
          break;
        case 'calligraphy':
          const dyn = Math.min(baseW * 2.2, Math.max(baseW * 0.4, baseW * (14 / Math.max(dist, 2))));
          c.strokeStyle = color; c.lineWidth = dyn;
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          break;
        default:
          c.strokeStyle = color; c.lineWidth = baseW;
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      c.restore();
    };

    const renderDot = (c, b, x, y, color, baseW) => {
      if (b === 'spray') { renderSprayDot(c, x, y, baseW, color); renderSprayDot(c, x, y, baseW, color); return; }
      c.save();
      if (b === 'highlighter') { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.5; }
      else if (b === 'chalk') { c.globalAlpha = 0.5; }
      else if (b === 'neon') { c.shadowColor = color; c.shadowBlur = baseW * 2; }
      c.fillStyle = color;
      const r = b === 'marker' ? baseW * 0.85 : b === 'highlighter' ? baseW * 1.6 : baseW / 2;
      c.beginPath(); c.arc(x, y, Math.max(1, r), 0, Math.PI * 2); c.fill();
      c.restore();
    };

    const measureText = (s) => {
      const fontWorld = s.fontWorld || 16;
      const lines = (s.text || '').split('\n');
      const w = Math.max(1, ...lines.map(l => l.length)) * fontWorld * 0.6;
      const h = lines.length * fontWorld * 1.25;
      return { w, h, lines, fontWorld };
    };

    const paintText = (s) => {
      const { w, h, lines, fontWorld } = measureText(s);
      const centerWorld = { x: s.x + w / 2, y: s.y + h / 2 };
      const centerScreen = worldToScreen(centerWorld);
      const fontPx = Math.max(8, fontWorld * eng.scale);
      const halfWpx = (w / 2) * eng.scale;
      const halfHpx = (h / 2) * eng.scale;
      eng.ctx.save();
      eng.ctx.translate(centerScreen.x, centerScreen.y);
      if (s.rot) eng.ctx.rotate(s.rot);
      eng.ctx.fillStyle = s.color;
      eng.ctx.font = `${fontPx}px 'Inter', sans-serif`;
      eng.ctx.textBaseline = 'top';
      lines.forEach((line, i) => eng.ctx.fillText(line, -halfWpx, -halfHpx + i * fontPx * 1.25));
      eng.ctx.restore();
    };

    const paintStroke = (s, w, h) => {
      if (s.type === 'text') { paintText(s); return; }
      if (s.type === 'image') {
        if (!s.img) return;
        const sw = s.widthWorld * eng.scale;
        const sh = s.heightWorld * eng.scale;
        const centerWorld = { x: s.x + s.widthWorld / 2, y: s.y + s.heightWorld / 2 };
        const centerScreen = worldToScreen(centerWorld);
        eng.ctx.save();
        eng.ctx.translate(centerScreen.x, centerScreen.y);
        if (s.rot) eng.ctx.rotate(s.rot);
        eng.ctx.drawImage(s.img, -sw / 2, -sh / 2, sw, sh);
        eng.ctx.restore();
        return;
      }
      if (!s.points || !s.points.length) return;
      const baseW = Math.max(1, s.widthWorld * eng.scale);

      if (s.erase) {
        eng.ctx.save(); eng.ctx.globalCompositeOperation = 'destination-out'; eng.ctx.strokeStyle = '#000'; eng.ctx.lineCap = 'round'; eng.ctx.lineJoin = 'round';
        eng.ctx.lineWidth = baseW;
        if (s.points.length === 1) {
          const p = worldToScreen(s.points[0]); eng.ctx.beginPath(); eng.ctx.arc(p.x, p.y, baseW / 2, 0, Math.PI * 2); eng.ctx.fillStyle = '#000'; eng.ctx.fill();
        } else {
          eng.ctx.beginPath(); s.points.forEach((pt, i) => { const p = worldToScreen(pt); if (i === 0) eng.ctx.moveTo(p.x, p.y); else eng.ctx.lineTo(p.x, p.y); }); eng.ctx.stroke();
        }
        eng.ctx.restore();
        return;
      }

      if (s.points.length === 1) {
        const p = worldToScreen(s.points[0]);
        renderDot(eng.ctx, s.brush || 'pencil', p.x, p.y, s.color, baseW);
        return;
      }
      for (let i = 1; i < s.points.length; i++) {
        const p1 = worldToScreen(s.points[i - 1]), p2 = worldToScreen(s.points[i]);
        renderSegment(eng.ctx, s.brush || 'pencil', p1.x, p1.y, p2.x, p2.y, s.color, baseW);
      }
    };

    // --- Selecció d'objectes ---
    const hitTestGroupId = (worldPos) => {
      const thresholdWorld = 10 / eng.scale;
      for (let i = eng.strokes.length - 1; i >= 0; i--) {
        const s = eng.strokes[i];
        if (s.erase) continue;
        if (s.type === 'text') {
          const { w, h } = measureText(s);
          const center = { x: s.x + w / 2, y: s.y + h / 2 };
          const local = s.rot ? rotatePointAround(worldPos, center, -s.rot) : worldPos;
          if (local.x >= s.x && local.x <= s.x + w && local.y >= s.y && local.y <= s.y + h) {
            return s.groupId;
          }
          continue;
        }
        if (s.type === 'image') {
          const center = { x: s.x + s.widthWorld / 2, y: s.y + s.heightWorld / 2 };
          const local = s.rot ? rotatePointAround(worldPos, center, -s.rot) : worldPos;
          if (local.x >= s.x && local.x <= s.x + s.widthWorld &&
              local.y >= s.y && local.y <= s.y + s.heightWorld) {
            return s.groupId;
          }
          continue;
        }
        if (!s.points || !s.points.length) continue;
        const half = (s.widthWorld || 0) / 2;
        if (s.points.length === 1) {
          const p = s.points[0];
          if (Math.hypot(worldPos.x - p.x, worldPos.y - p.y) <= thresholdWorld + half) return s.groupId;
          continue;
        }
        for (let j = 1; j < s.points.length; j++) {
          const d = distToSegmentWorld(worldPos, s.points[j - 1], s.points[j]);
          if (d <= thresholdWorld + half) return s.groupId;
        }
      }
      return null;
    };

    const getGroupBounds = (groupId) => {
      if (!groupId) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, found = false;
      eng.strokes.forEach(s => {
        if (s.groupId !== groupId) return;
        found = true;
        if (s.type === 'text') {
          const { w, h } = measureText(s);
          const center = { x: s.x + w / 2, y: s.y + h / 2 };
          const corners = [
            { x: s.x, y: s.y }, { x: s.x + w, y: s.y },
            { x: s.x + w, y: s.y + h }, { x: s.x, y: s.y + h },
          ].map(p => s.rot ? rotatePointAround(p, center, s.rot) : p);
          corners.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          });
        } else if (s.type === 'image') {
          const center = { x: s.x + s.widthWorld / 2, y: s.y + s.heightWorld / 2 };
          const corners = [
            { x: s.x, y: s.y }, { x: s.x + s.widthWorld, y: s.y },
            { x: s.x + s.widthWorld, y: s.y + s.heightWorld }, { x: s.x, y: s.y + s.heightWorld },
          ].map(p => s.rot ? rotatePointAround(p, center, s.rot) : p);
          corners.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          });
        } else if (s.points) {
          s.points.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          });
        }
      });
      return found ? { minX, minY, maxX, maxY } : null;
    };

    const getHandleScreenPositions = (groupId) => {
      const b = getGroupBounds(groupId);
      if (!b) return null;
      const pad = 10 / eng.scale;
      const topLeft = worldToScreen({ x: b.minX - pad, y: b.minY - pad });
      const bottomRight = worldToScreen({ x: b.maxX + pad, y: b.maxY + pad });
      const topCenterX = (topLeft.x + bottomRight.x) / 2;
      return {
        topLeft, bottomRight,
        rotate: { x: topCenterX, y: topLeft.y - ROTATE_HANDLE_OFFSET },
        scale: { x: bottomRight.x, y: bottomRight.y },
      };
    };

    const rotateGroup = (groupId, centerWorld, angle) => {
      eng.strokes.forEach((s) => {
        if (s.groupId !== groupId) return;
        if (s.type === 'text' || s.type === 'image') {
          const rotated = rotatePointAround({ x: s.x, y: s.y }, centerWorld, angle);
          s.x = rotated.x; s.y = rotated.y;
          s.rot = (s.rot || 0) + angle;
        } else if (s.points) {
          s.points = s.points.map((p) => rotatePointAround(p, centerWorld, angle));
        }
      });
    };

    const scaleGroup = (groupId, centerWorld, factor) => {
      if (!isFinite(factor) || factor <= 0) return;
      eng.strokes.forEach((s) => {
        if (s.groupId !== groupId) return;
        if (s.type === 'text') {
          s.x = centerWorld.x + (s.x - centerWorld.x) * factor;
          s.y = centerWorld.y + (s.y - centerWorld.y) * factor;
          s.fontWorld = Math.max(4, (s.fontWorld || 16) * factor);
        } else if (s.type === 'image') {
          s.x = centerWorld.x + (s.x - centerWorld.x) * factor;
          s.y = centerWorld.y + (s.y - centerWorld.y) * factor;
          s.widthWorld = Math.max(4, s.widthWorld * factor);
          s.heightWorld = Math.max(4, s.heightWorld * factor);
        } else if (s.points) {
          s.points = s.points.map((p) => ({
            x: centerWorld.x + (p.x - centerWorld.x) * factor,
            y: centerWorld.y + (p.y - centerWorld.y) * factor,
          }));
          s.widthWorld = Math.max(0.3, (s.widthWorld || 1) * factor);
        }
      });
    };

    const drawSelectionOutline = () => {
      if (!eng.selectedGroupId) return;
      const handles = getHandleScreenPositions(eng.selectedGroupId);
      if (!handles) return;
      const { topLeft, bottomRight, rotate, scale } = handles;
      eng.ctx.save();
      eng.ctx.strokeStyle = '#2B6CB0';
      eng.ctx.lineWidth = 1.5;
      eng.ctx.setLineDash([6, 4]);
      eng.ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

      eng.ctx.setLineDash([]);
      eng.ctx.beginPath();
      eng.ctx.moveTo(rotate.x, topLeft.y);
      eng.ctx.lineTo(rotate.x, rotate.y);
      eng.ctx.stroke();

      eng.ctx.fillStyle = '#fff';
      eng.ctx.beginPath();
      eng.ctx.arc(rotate.x, rotate.y, HANDLE_SIZE / 1.7, 0, Math.PI * 2);
      eng.ctx.fill(); eng.ctx.stroke();

      eng.ctx.fillRect(scale.x - HANDLE_SIZE / 2, scale.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      eng.ctx.strokeRect(scale.x - HANDLE_SIZE / 2, scale.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      eng.ctx.restore();
    };

    // ---------- Motor de renderitzat ----------
    eng.redraw = (withGrid = true, withSelection = true, clear = true) => {
      if (!eng.ctx || !canvasRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      if (clear) {
        eng.ctx.clearRect(0, 0, w, h);
      }
      if (withGrid) drawGrid(w, h);
      eng.strokes.forEach(s => paintStroke(s, w, h));
      if (withSelection) drawSelectionOutline();
    };

    const getScreenPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e) => {
      const pos = getScreenPos(e);
      const { mode, color, brush, thick } = uiRef.current;

      if (mode === 'text') return;

      if (mode === 'pan') {
        eng.panStart = { x: pos.x, y: pos.y, panX0: eng.panX, panY0: eng.panY };
        return;
      }

      if (mode === 'select') {
        if (eng.selectedGroupId) {
          const handles = getHandleScreenPositions(eng.selectedGroupId);
          if (handles) {
            const distRotate = Math.hypot(pos.x - handles.rotate.x, pos.y - handles.rotate.y);
            if (distRotate <= HANDLE_SIZE + 5) {
              const b = getGroupBounds(eng.selectedGroupId);
              const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
              const worldPos = screenToWorld(pos);
              eng.transformMode = 'rotate';
              eng.transformCenter = center;
              eng.transformLast = Math.atan2(worldPos.y - center.y, worldPos.x - center.x);
              return;
            }
            const distScale = Math.hypot(pos.x - handles.scale.x, pos.y - handles.scale.y);
            if (distScale <= HANDLE_SIZE + 5) {
              const b = getGroupBounds(eng.selectedGroupId);
              const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
              const worldPos = screenToWorld(pos);
              eng.transformMode = 'scale';
              eng.transformCenter = center;
              eng.transformLast = Math.hypot(worldPos.x - center.x, worldPos.y - center.y) || 0.0001;
              return;
            }
          }
        }

        const worldPos = screenToWorld(pos);
        const hitGroupId = hitTestGroupId(worldPos);
        eng.selectedGroupId = hitGroupId;
        eng.dragStart = hitGroupId ? { x: pos.x, y: pos.y } : null;
        eng.transformMode = null;
        if (eng.redraw) eng.redraw();
        return;
      }

      canvas.setPointerCapture(e.pointerId);
      const worldPos = screenToWorld(pos);
      const erase = mode === 'erase';
      eng.currentStroke = {
        type: 'path', color: erase ? '#000' : color,
        widthWorld: (erase ? thick * 2.4 : thick) / eng.scale,
        erase, brush, points: [worldPos],
        groupId: newGroupId()
      };
      eng.lastPx = pos;

      const baseW = Math.max(1, eng.currentStroke.widthWorld * eng.scale);
      if (erase) {
        eng.ctx.save(); eng.ctx.globalCompositeOperation = 'destination-out'; eng.ctx.fillStyle = '#000';
        eng.ctx.beginPath(); eng.ctx.arc(pos.x, pos.y, baseW / 2, 0, Math.PI * 2); eng.ctx.fill(); eng.ctx.restore();
      } else {
        renderDot(eng.ctx, brush, pos.x, pos.y, color, baseW);
      }
    };

    const handlePointerMove = (e) => {
      const pos = getScreenPos(e);
      if (uiRef.current.mode === 'pan' && eng.panStart) {
        eng.panX = eng.panStart.panX0 + (pos.x - eng.panStart.x);
        eng.panY = eng.panStart.panY0 + (pos.y - eng.panStart.y);
        if (eng.redraw) eng.redraw();
        return;
      }

      if (uiRef.current.mode === 'select') {
        if (eng.transformMode === 'rotate' && eng.selectedGroupId) {
          const worldPos = screenToWorld(pos);
          const center = eng.transformCenter;
          const angle = Math.atan2(worldPos.y - center.y, worldPos.x - center.x);
          const delta = angle - eng.transformLast;
          rotateGroup(eng.selectedGroupId, center, delta);
          eng.transformLast = angle;
          if (eng.redraw) eng.redraw();
          return;
        }
        if (eng.transformMode === 'scale' && eng.selectedGroupId) {
          const worldPos = screenToWorld(pos);
          const center = eng.transformCenter;
          const dist = Math.hypot(worldPos.x - center.x, worldPos.y - center.y) || 0.0001;
          const factor = dist / eng.transformLast;
          scaleGroup(eng.selectedGroupId, center, factor);
          eng.transformLast = dist;
          if (eng.redraw) eng.redraw();
          return;
        }
        if (eng.selectedGroupId && eng.dragStart) {
          const dxWorld = (pos.x - eng.dragStart.x) / eng.scale;
          const dyWorld = (pos.y - eng.dragStart.y) / eng.scale;
          eng.strokes.forEach(s => {
            if (s.groupId !== eng.selectedGroupId) return;
            if (s.type === 'text' || s.type === 'image') {
              s.x += dxWorld; s.y += dyWorld;
            } else if (s.points) {
              s.points.forEach(p => { p.x += dxWorld; p.y += dyWorld; });
            }
          });
          eng.dragStart = { x: pos.x, y: pos.y };
          if (eng.redraw) eng.redraw();
        }
        return;
      }

      if (!eng.currentStroke) return;
      const worldPos = screenToWorld(pos);
      eng.currentStroke.points.push(worldPos);

      const baseW = Math.max(1, eng.currentStroke.widthWorld * eng.scale);
      if (eng.currentStroke.erase) {
        eng.ctx.save(); eng.ctx.globalCompositeOperation = 'destination-out'; eng.ctx.strokeStyle = '#000'; eng.ctx.lineCap = 'round'; eng.ctx.lineJoin = 'round';
        eng.ctx.lineWidth = baseW;
        eng.ctx.beginPath(); eng.ctx.moveTo(eng.lastPx.x, eng.lastPx.y); eng.ctx.lineTo(pos.x, pos.y); eng.ctx.stroke();
        eng.ctx.restore();
      } else {
        renderSegment(eng.ctx, eng.currentStroke.brush, eng.lastPx.x, eng.lastPx.y, pos.x, pos.y, eng.currentStroke.color, baseW);
      }
      eng.lastPx = pos;
    };

    const handlePointerUp = () => {
      if (uiRef.current.mode === 'pan') { eng.panStart = null; return; }
      if (uiRef.current.mode === 'select') { eng.dragStart = null; eng.transformMode = null; return; }
      if (!eng.currentStroke) return;
      eng.strokes.push(eng.currentStroke);
      eng.currentStroke = null; eng.lastPx = null;

      // --- Acció local: emetem l'estat (triggerUpdate ja ho farà) ---
      triggerUpdate();
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const pos = getScreenPos(e);
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const worldBefore = screenToWorld(pos);
      eng.scale = Math.min(4, Math.max(0.2, eng.scale * factor));
      eng.panX = pos.x - worldBefore.x * eng.scale;
      eng.panY = pos.y - worldBefore.y * eng.scale;
      setZoomLabel(Math.round(eng.scale * 100) + '%');
      if (eng.redraw) eng.redraw();
    };

    window.addEventListener('resize', setupCanvas);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    setupCanvas();

    return () => {
      window.removeEventListener('resize', setupCanvas);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // --- EINES EXTERNES I BOTONS ---

  const applyMathTool = (val) => {
    setMathMenuOpen(false);
    if (!val) return;
    const eng = engineRef.current;
    const cx = (-eng.panX + wrapRef.current.clientWidth / 2) / eng.scale;
    const cy = (-eng.panY + wrapRef.current.clientHeight / 2) / eng.scale;
    const s = 100 / eng.scale;
    const groupId = newGroupId();

    const createLine = (x1, y1, x2, y2, c, w) => ({
      type: 'path', color: c, widthWorld: w, erase: false, brush: 'pencil', points: [{x:x1, y:y1}, {x:x2, y:y2}], groupId
    });

    if (val === 'cube') {
      const lines = [
        [0,0, s,0], [s,0, s,s], [s,s, 0,s], [0,s, 0,0],
        [s/2, -s/2, s*1.5, -s/2], [s*1.5, -s/2, s*1.5, s/2], [s*1.5, s/2, s/2, s/2], [s/2, s/2, s/2, -s/2],
        [0,0, s/2,-s/2], [s,0, s*1.5,-s/2], [s,s, s*1.5,s/2], [0,s, s/2,s/2]
      ];
      lines.forEach(l => eng.strokes.push(createLine(cx+l[0]-s*0.75, cy+l[1]-s/4, cx+l[2]-s*0.75, cy+l[3]-s/4, color, Math.max(1, 3/eng.scale))));
    } else if (val === 'axes') {
      eng.strokes.push(createLine(cx-s*2.5, cy, cx+s*2.5, cy, '#1B2733', Math.max(1, 2/eng.scale)));
      eng.strokes.push(createLine(cx, cy-s*2.5, cx, cy+s*2.5, '#1B2733', Math.max(1, 2/eng.scale)));
    } else if (val === 'graph') {
      const input = prompt("Introdueix la funció f(x).\nExemples: Math.sin(x/20)*50, x*x/30, Math.cos(x/15)*x", "Math.sin(x/20)*50");
      if(input) {
        try {
          const f = new Function('x', `with(Math){ return ${input}; }`);
          eng.strokes.push(createLine(cx-s*3.5, cy, cx+s*3.5, cy, '#1B2733', Math.max(1, 2/eng.scale)));
          eng.strokes.push(createLine(cx, cy-s*3.5, cx, cy+s*3.5, '#1B2733', Math.max(1, 2/eng.scale)));
          const curveStroke = { type: 'path', color: color, widthWorld: Math.max(1, 3/eng.scale), erase: false, brush: 'marker', points: [], groupId };
          for(let x = -s*3.5; x <= s*3.5; x += 1.5) {
            const y = f(x);
            if (isFinite(y) && Math.abs(y) < s*6) curveStroke.points.push({x: cx + x, y: cy - y});
          }
          if(curveStroke.points.length > 0) eng.strokes.push(curveStroke);
        } catch(err) {
          alert("Funció matemàtica no vàlida.");
        }
      }
    }

    triggerUpdate();
  };

  const undo = () => {
    const arr = engineRef.current.strokes;
    if (arr.length === 0) { triggerUpdate(); return; }
    const lastGroupId = arr[arr.length - 1].groupId;
    if (lastGroupId) {
      while (arr.length && arr[arr.length - 1].groupId === lastGroupId) {
        arr.pop();
      }
    } else {
      arr.pop();
    }
    if (engineRef.current.selectedGroupId === lastGroupId) {
      engineRef.current.selectedGroupId = null;
    }
    triggerUpdate();
  };

  const clearAll = () => {
    if(confirm('Esborrar tota la pissarra?')){
      engineRef.current.strokes = [];
      triggerUpdate();
    }
  };

  // ---------- INSERIR IMATGE DEL PANELL 3D ----------
  const handleInsertSnapshot = (dataUrl) => {
    const eng = engineRef.current;
    const wrap = wrapRef.current;
    if (!eng || !wrap) return;

    const viewCenterX = (wrap.clientWidth / 2 - eng.panX) / eng.scale;
    const viewCenterY = (wrap.clientHeight / 2 - eng.panY) / eng.scale;

    const img = new Image();
    img.src = dataUrl;

    const stroke = {
      type: 'image',
      groupId: newGroupId(),
      x: viewCenterX,
      y: viewCenterY,
      widthWorld: 200,
      heightWorld: 150,
      rot: 0,
      img: null,
      dataUrl,
    };

    eng.strokes.push(stroke);

    img.onload = () => {
      const aspect = img.naturalHeight / img.naturalWidth;
      stroke.widthWorld = 200;
      stroke.heightWorld = 200 * aspect;
      stroke.img = img;
      triggerUpdate();
    };

    triggerUpdate();
  };

  // ---------- FUNCIÓ DE DESCARREGA AMB FONS BLANC ----------
  const handleDownload = () => {
    const eng = engineRef.current;
    if (eng.strokes.length === 0) {
      alert("La pissarra està buida!");
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    eng.strokes.forEach(s => {
      if (s.type === 'text') {
        const fontWorld = s.fontWorld || 16;
        const lines = (s.text || '').split('\n');
        const w = Math.max(1, ...lines.map(l => l.length)) * fontWorld * 0.6;
        const h = lines.length * fontWorld * 1.25;
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + w);
        maxY = Math.max(maxY, s.y + h);
      } else if (s.type === 'image') {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.widthWorld);
        maxY = Math.max(maxY, s.y + s.heightWorld);
      } else if (s.points && s.points.length) {
        s.points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      }
    });

    if (!isFinite(minX)) return;

    const margin = 40;
    const labelHeight = 40;

    const offCanvas = document.createElement('canvas');
    const width = maxX - minX + 2 * margin;
    const height = maxY - minY + 2 * margin + labelHeight;
    offCanvas.width = Math.ceil(width);
    offCanvas.height = Math.ceil(height);
    const offCtx = offCanvas.getContext('2d');

    offCtx.fillStyle = '#FCFDFE';
    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

    offCtx.fillStyle = '#6B7C93';
    offCtx.font = '16px Inter, sans-serif';
    const label = `${subject || 'Subject'} | ${unit || 'Unit'} | ${session || 'Session'}`;
    offCtx.fillText(label, margin, margin + 6);

    const originalCtx = eng.ctx;
    const originalPanX = eng.panX;
    const originalPanY = eng.panY;
    const originalScale = eng.scale;

    eng.ctx = offCtx;
    eng.panX = -minX + margin;
    eng.panY = -minY + margin + labelHeight;
    eng.scale = 1;

    eng.redraw(false, false, false);

    eng.ctx = originalCtx;
    eng.panX = originalPanX;
    eng.panY = originalPanY;
    eng.scale = originalScale;

    const link = document.createElement('a');
    const subj = (subject || 'subject').trim().replace(/\s+/g, '_');
    const un = (unit || 'unit').trim().replace(/\s+/g, '_');
    const sess = (session || 'session').trim().replace(/\s+/g, '_');
    link.download = `${subj}_${un}_${sess}.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();
  };

  useImperativeHandle(ref, () => ({
    download: handleDownload
  }));

  const cursorStyle = mode === 'pan' ? 'grab' : mode === 'text' ? 'text' : mode === 'select' ? 'pointer' : 'crosshair';

  return (
    <div className="board-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} style={{ cursor: cursorStyle, touchAction: 'none' }}></canvas>

      <div className="toolbar">
        <div className="swatch-group">
          {PALETTE_COLORS.map(c => (
            <button key={c} className={`swatch ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => {setColor(c); setMode('draw');}} />
          ))}
        </div>
        <div className="divider"></div>
        <select
          className="brush-select"
          value={brush}
          title={BRUSH_LABELS[brush]}
          onChange={e => {setBrush(e.target.value); setMode('draw');}}
        >
          <option value="pencil" title="Llapis">✏️</option>
          <option value="marker" title="Retolador">🖊️</option>
          <option value="highlighter" title="Fluorescent">🖍️</option>
          <option value="spray" title="Esprai">💨</option>
          <option value="neon" title="Neó">✨</option>
          <option value="calligraphy" title="Cal·ligrafia">🖋️</option>
          <option value="chalk" title="Guix">🌫️</option>
          <option value="dotted" title="Punts">⚪</option>
        </select>
        <div className="divider"></div>
        <div className="math-dropdown" ref={mathMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            className="tool-btn"
            onClick={() => setMathMenuOpen(o => !o)}
            aria-expanded={mathMenuOpen}
            title="Mates"
          >
            📐
          </button>
          {mathMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: '#fff',
                border: '1px solid #D8DEE6',
                borderRadius: 8,
                boxShadow: '0 6px 16px rgba(20,30,45,0.18)',
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 170,
                overflow: 'hidden'
              }}
            >
              <button
                type="button"
                className="tool-btn"
                style={{ justifyContent: 'flex-start', width: '100%', borderRadius: 0 }}
                onClick={() => applyMathTool('cube')}
              >
                🧊 Cub (3D)
              </button>
              <button
                type="button"
                className="tool-btn"
                style={{ justifyContent: 'flex-start', width: '100%', borderRadius: 0 }}
                onClick={() => applyMathTool('axes')}
              >
                ➕ Eixos X/Y
              </button>
              <button
                type="button"
                className="tool-btn"
                style={{ justifyContent: 'flex-start', width: '100%', borderRadius: 0 }}
                onClick={() => applyMathTool('graph')}
              >
                📈 Gràfica f(x)
              </button>
            </div>
          )}
        </div>
        <div className="divider"></div>
        <input type="range" min="2" max="18" value={thick} onChange={e => setThick(Number(e.target.value))} />
        <div className="divider"></div>
        <button className={`tool-btn ${mode === 'select' ? 'active' : ''}`} onClick={() => setMode(mode === 'select' ? 'draw' : 'select')} title="Seleccionar, moure, rotar i escalar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3l6.5 17 2.5-7 7-2.5z"/></svg>
        </button>
        <button className={`tool-btn ${mode === 'pan' ? 'active' : ''}`} onClick={() => setMode(mode === 'pan' ? 'draw' : 'pan')}>✥</button>
        <button className={`tool-btn ${mode === 'erase' ? 'active' : ''}`} onClick={() => setMode(mode === 'erase' ? 'draw' : 'erase')}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H8l-5-5a2 2 0 0 1 0-2.8L13.4 2.8a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L14 18"/></svg>
        </button>
        <button className="tool-btn" onClick={undo}>↺</button>
        <button className="tool-btn" onClick={clearAll}>🗑️</button>
        <button className="tool-btn" onClick={handleDownload} title="Descarregar PNG">⬇️</button>

        <div className="divider"></div>
        <button
          className={`tool-btn ${show3DPanel ? 'active' : ''}`}
          onClick={() => setShow3DPanel(!show3DPanel)}
          title="Biblioteca de sòlids 3D"
        >
          🧊 3D
        </button>
      </div>

      <div className="canvas-utils">
        <span className="zoom-label">{zoomLabel}</span>
      </div>

      {show3DPanel && (
        <Solid3DPanel
          onClose={() => setShow3DPanel(false)}
          onInsertSnapshot={handleInsertSnapshot}
        />
      )}

      <RoomManager 
        getCanvasState={() => engineRef.current.strokes} 
        setCanvasState={(newStrokes) => {
          engineRef.current.strokes = newStrokes;
          // IMPORTANT: no re-emetre! passem false per evitar el bucle
          triggerUpdate(false);
        }} 
      />
    </div>
  );
});

/* =========================================================================
   BIBLIOTECA DE SÒLIDS 3D (component Solid3DPanel)
   ========================================================================= */
const SQ2 = Math.sqrt(2);
const SQ3 = Math.sqrt(3);
const SQ5 = Math.sqrt(5);
const PHI_3D = (1 + SQ5) / 2;

// Dades base dels sòlids platònics
const TETRA_VERTS = [1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1];
const TETRA_IDX = [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1];

const OCTA_VERTS = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
const OCTA_IDX = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2];

const ICOSA_VERTS = [
  -1, PHI_3D, 0, 1, PHI_3D, 0, -1, -PHI_3D, 0, 1, -PHI_3D, 0,
  0, -1, PHI_3D, 0, 1, PHI_3D, 0, -1, -PHI_3D, 0, 1, -PHI_3D,
  PHI_3D, 0, -1, PHI_3D, 0, 1, -PHI_3D, 0, -1, -PHI_3D, 0, 1,
];
const ICOSA_IDX = [
  0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
  1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
  4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
];

const DODECA_R = 1 / PHI_3D;
const DODECA_VERTS = [
  -1, -1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
  1, -1, -1, 1, -1, 1, 1, 1, -1, 1, 1, 1,
  0, -DODECA_R, -PHI_3D, 0, -DODECA_R, PHI_3D, 0, DODECA_R, -PHI_3D, 0, DODECA_R, PHI_3D,
  -DODECA_R, -PHI_3D, 0, -DODECA_R, PHI_3D, 0, DODECA_R, -PHI_3D, 0, DODECA_R, PHI_3D, 0,
  -PHI_3D, 0, -DODECA_R, PHI_3D, 0, -DODECA_R, -PHI_3D, 0, DODECA_R, PHI_3D, 0, DODECA_R,
];
const DODECA_IDX = [
  3, 11, 7, 3, 7, 15, 3, 15, 13,
  7, 19, 17, 7, 17, 6, 7, 6, 15,
  17, 4, 8, 17, 8, 10, 17, 10, 6,
  8, 0, 16, 8, 16, 2, 8, 2, 10,
  0, 12, 1, 0, 1, 18, 0, 18, 16,
  6, 10, 2, 6, 2, 13, 6, 13, 15,
  2, 16, 18, 2, 18, 3, 2, 3, 13,
  18, 1, 9, 18, 9, 11, 18, 11, 3,
  4, 14, 12, 4, 12, 0, 4, 0, 8,
  11, 9, 5, 11, 5, 19, 11, 19, 7,
  19, 5, 14, 19, 14, 4, 19, 4, 17,
  1, 12, 14, 1, 14, 5, 1, 5, 9,
];

const facesFromTriangleFan = (indices, trianglesPerFace) => {
  const faces = [];
  const step = 3 * trianglesPerFace;
  for (let i = 0; i < indices.length; i += step) {
    if (trianglesPerFace === 1) {
      faces.push([indices[i], indices[i + 1], indices[i + 2]]);
    } else {
      const loop = [indices[i], indices[i + 1], indices[i + 2]];
      for (let k = 1; k < trianglesPerFace; k++) loop.push(indices[i + k * 3 + 2]);
      faces.push(loop);
    }
  }
  return faces;
};

const polyhedronFacePoints = (rawVerts, indices, trianglesPerFace, edgeLength) => {
  const verts = [];
  for (let i = 0; i < rawVerts.length; i += 3) {
    verts.push(new THREE.Vector3(rawVerts[i], rawVerts[i + 1], rawVerts[i + 2]).normalize());
  }
  const faceIdx = facesFromTriangleFan(indices, trianglesPerFace);
  const scale = edgeLength / verts[faceIdx[0][0]].distanceTo(verts[faceIdx[0][1]]);
  return faceIdx.map((loop) => loop.map((idx) => {
    const v = verts[idx];
    return { x: v.x * scale, y: v.y * scale, z: v.z * scale };
  }));
};

function makeFaceGeometry(points) {
  const geom = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 1; i < points.length - 1; i++) {
    positions.push(points[0].x, points[0].y, points[0].z);
    positions.push(points[i].x, points[i].y, points[i].z);
    positions.push(points[i + 1].x, points[i + 1].y, points[i + 1].z);
  }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

const FACE_COLOR = 0xB9C4CF;
const newFaceMaterial = () => new THREE.MeshStandardMaterial({
  color: FACE_COLOR, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.05,
});

const faceCentroidDirection = (pts) => {
  const c = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length, z: acc.z + p.z / pts.length }), { x: 0, y: 0, z: 0 });
  const len = Math.hypot(c.x, c.y, c.z) || 1;
  return { x: c.x / len, y: c.y / len, z: c.z / len };
};

function buildSolidObject(def, params) {
  const group = new THREE.Group();
  if (def.kind === 'flat') {
    group.userData.explodable = true;
    const faces = def.faces(params);
    faces.forEach((pts) => {
      const faceGeom = makeFaceGeometry(pts);
      const mesh = new THREE.Mesh(faceGeom, newFaceMaterial());
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(faceGeom, 1),
        new THREE.LineBasicMaterial({ color: 0x1B2733 })
      );
      mesh.add(outline);
      mesh.userData.explodeDir = faceCentroidDirection(pts);
      group.add(mesh);
    });
  } else {
    group.userData.explodable = false;
    const geometry = def.geometry(params);
    const groupCount = geometry.groups && geometry.groups.length ? geometry.groups.length : 1;
    const materials = Array.from({ length: groupCount }, newFaceMaterial);
    group.add(new THREE.Mesh(geometry, groupCount > 1 ? materials : materials[0]));
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 15), new THREE.LineBasicMaterial({ color: 0x1B2733 })));
  }
  return group;
}

function setExplodeAmount(group, amount) {
  if (!group || !group.userData.explodable) return;
  group.children.forEach((child) => {
    if (child.isMesh && child.userData.explodeDir) {
      const d = child.userData.explodeDir;
      child.position.set(d.x * amount, d.y * amount, d.z * amount);
    }
  });
}

function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

function defaultParams(def) {
  const obj = {};
  def.params.forEach((p) => { obj[p.key] = p.default; });
  return obj;
}

const PALETTE_3D = ['#EB5A2E', '#2B6CB0', '#2E8B57', '#8E44AD', '#F2C14E', '#123B61', '#1B2733', '#FFFFFF'];
const EXPLODE_MAX = 1.6;

const SOLIDS_3D = {
  cub: {
    label: 'Cub', emoji: '🧊', kind: 'flat',
    params: [{ key: 'a', label: 'Aresta', min: 0.6, max: 2.4, step: 0.05, default: 1.4 }],
    faces: (p) => {
      const h = p.a / 2;
      const v = {
        ftl: { x: -h, y: h, z: h }, ftr: { x: h, y: h, z: h }, fbr: { x: h, y: -h, z: h }, fbl: { x: -h, y: -h, z: h },
        btl: { x: -h, y: h, z: -h }, btr: { x: h, y: h, z: -h }, bbr: { x: h, y: -h, z: -h }, bbl: { x: -h, y: -h, z: -h },
      };
      return [
        [v.ftl, v.ftr, v.fbr, v.fbl],
        [v.btr, v.btl, v.bbl, v.bbr],
        [v.ftr, v.btr, v.bbr, v.fbr],
        [v.btl, v.ftl, v.fbl, v.bbl],
        [v.btl, v.btr, v.ftr, v.ftl],
        [v.fbl, v.fbr, v.bbr, v.bbl],
      ];
    },
    metrics: (p) => ({
      'Aresta': `${p.a.toFixed(2)} u`,
      'Àrea total': `${(6 * p.a * p.a).toFixed(2)} u²`,
      'Volum': `${(p.a ** 3).toFixed(2)} u³`,
    }),
  },
  piramide4: {
    label: 'Piràmide quadrangular', emoji: '🔺', kind: 'flat',
    params: [
      { key: 'a', label: 'Costat base', min: 0.6, max: 2.2, step: 0.05, default: 1.4 },
      { key: 'h', label: 'Alçada', min: 0.6, max: 2.6, step: 0.05, default: 1.6 },
    ],
    faces: (p) => {
      const hb = p.a / 2, hy = p.h / 2;
      const b = [
        { x: -hb, y: -hy, z: -hb }, { x: hb, y: -hy, z: -hb },
        { x: hb, y: -hy, z: hb }, { x: -hb, y: -hy, z: hb },
      ];
      const apex = { x: 0, y: hy, z: 0 };
      return [
        [b[0], b[1], b[2], b[3]],
        [b[0], b[1], apex], [b[1], b[2], apex], [b[2], b[3], apex], [b[3], b[0], apex],
      ];
    },
    metrics: (p) => {
      const slant = Math.sqrt(p.h * p.h + (p.a / 2) * (p.a / 2));
      const total = p.a * p.a + 2 * p.a * slant;
      const vol = (p.a * p.a * p.h) / 3;
      return {
        'Costat base': `${p.a.toFixed(2)} u`, 'Alçada': `${p.h.toFixed(2)} u`,
        'Àrea total': `${total.toFixed(2)} u²`, 'Volum': `${vol.toFixed(2)} u³`,
      };
    },
  },
  tetraedre: {
    label: 'Piràmide triangular', emoji: '🔻', kind: 'flat',
    params: [{ key: 'a', label: 'Aresta', min: 0.6, max: 2.6, step: 0.05, default: 1.8 }],
    faces: (p) => polyhedronFacePoints(TETRA_VERTS, TETRA_IDX, 1, p.a),
    metrics: (p) => ({
      'Aresta': `${p.a.toFixed(2)} u`,
      'Àrea total': `${(SQ3 * p.a * p.a).toFixed(2)} u²`,
      'Volum': `${((p.a ** 3) / (6 * SQ2)).toFixed(2)} u³`,
    }),
  },
  prismaTriangular: {
    label: 'Prisma triangular', emoji: '🔷', kind: 'flat',
    params: [
      { key: 'a', label: 'Costat base', min: 0.6, max: 2.2, step: 0.05, default: 1.3 },
      { key: 'h', label: 'Alçada', min: 0.6, max: 2.6, step: 0.05, default: 1.8 },
    ],
    faces: (p) => {
      const R = p.a / SQ3;
      const angs = [90, 210, 330].map((d) => (d * Math.PI) / 180);
      const top = angs.map((a) => ({ x: R * Math.cos(a), y: p.h / 2, z: R * Math.sin(a) }));
      const bot = angs.map((a) => ({ x: R * Math.cos(a), y: -p.h / 2, z: R * Math.sin(a) }));
      const sides = [0, 1, 2].map((i) => [bot[i], bot[(i + 1) % 3], top[(i + 1) % 3], top[i]]);
      return [top, [bot[2], bot[1], bot[0]], ...sides];
    },
    metrics: (p) => {
      const baseArea = (SQ3 / 4) * p.a * p.a;
      const total = 2 * baseArea + 3 * p.a * p.h;
      const vol = baseArea * p.h;
      return {
        'Costat base': `${p.a.toFixed(2)} u`, 'Alçada': `${p.h.toFixed(2)} u`,
        'Àrea total': `${total.toFixed(2)} u²`, 'Volum': `${vol.toFixed(2)} u³`,
      };
    },
  },
  prismaHexagonal: {
    label: 'Prisma hexagonal', emoji: '⬡', kind: 'flat',
    params: [
      { key: 'a', label: 'Costat base', min: 0.4, max: 1.6, step: 0.05, default: 0.9 },
      { key: 'h', label: 'Alçada', min: 0.6, max: 2.6, step: 0.05, default: 1.8 },
    ],
    faces: (p) => {
      const R = p.a;
      const angs = [0, 60, 120, 180, 240, 300].map((d) => (d * Math.PI) / 180);
      const top = angs.map((a) => ({ x: R * Math.cos(a), y: p.h / 2, z: R * Math.sin(a) }));
      const bot = angs.map((a) => ({ x: R * Math.cos(a), y: -p.h / 2, z: R * Math.sin(a) }));
      const sides = [0, 1, 2, 3, 4, 5].map((i) => [bot[i], bot[(i + 1) % 6], top[(i + 1) % 6], top[i]]);
      return [top, [...bot].reverse(), ...sides];
    },
    metrics: (p) => {
      const baseArea = ((3 * SQ3) / 2) * p.a * p.a;
      const total = 2 * baseArea + 6 * p.a * p.h;
      const vol = baseArea * p.h;
      return {
        'Costat base': `${p.a.toFixed(2)} u`, 'Alçada': `${p.h.toFixed(2)} u`,
        'Àrea total': `${total.toFixed(2)} u²`, 'Volum': `${vol.toFixed(2)} u³`,
      };
    },
  },
  cilindre: {
    label: 'Cilindre', emoji: '🥫', kind: 'native',
    params: [
      { key: 'r', label: 'Radi', min: 0.4, max: 1.6, step: 0.05, default: 1 },
      { key: 'h', label: 'Alçada', min: 0.6, max: 2.8, step: 0.05, default: 1.8 },
    ],
    geometry: (p) => new THREE.CylinderGeometry(p.r, p.r, p.h, 40),
    metrics: (p) => {
      const lateral = 2 * Math.PI * p.r * p.h;
      const total = 2 * Math.PI * p.r * (p.r + p.h);
      const vol = Math.PI * p.r * p.r * p.h;
      return {
        'Radi': `${p.r.toFixed(2)} u`, 'Alçada': `${p.h.toFixed(2)} u`,
        'Àrea lateral': `${lateral.toFixed(2)} u²`, 'Àrea total': `${total.toFixed(2)} u²`,
        'Volum': `${vol.toFixed(2)} u³`,
      };
    },
  },
  con: {
    label: 'Con', emoji: '🍦', kind: 'native',
    params: [
      { key: 'r', label: 'Radi', min: 0.4, max: 1.6, step: 0.05, default: 1 },
      { key: 'h', label: 'Alçada', min: 0.6, max: 2.8, step: 0.05, default: 1.9 },
    ],
    geometry: (p) => new THREE.ConeGeometry(p.r, p.h, 40),
    metrics: (p) => {
      const g = Math.sqrt(p.r * p.r + p.h * p.h);
      const total = Math.PI * p.r * (p.r + g);
      const vol = (Math.PI * p.r * p.r * p.h) / 3;
      return {
        'Radi': `${p.r.toFixed(2)} u`, 'Alçada': `${p.h.toFixed(2)} u`, 'Generatriu': `${g.toFixed(2)} u`,
        'Àrea total': `${total.toFixed(2)} u²`, 'Volum': `${vol.toFixed(2)} u³`,
      };
    },
  },
  esfera: {
    label: 'Esfera', emoji: '🔮', kind: 'native',
    params: [{ key: 'r', label: 'Radi', min: 0.5, max: 1.8, step: 0.05, default: 1.2 }],
    geometry: (p) => new THREE.SphereGeometry(p.r, 40, 28),
    metrics: (p) => ({
      'Radi': `${p.r.toFixed(2)} u`,
      'Àrea': `${(4 * Math.PI * p.r * p.r).toFixed(2)} u²`,
      'Volum': `${(((4 / 3) * Math.PI) * p.r ** 3).toFixed(2)} u³`,
    }),
  },
  octaedre: {
    label: 'Octaedre', emoji: '💎', kind: 'flat',
    params: [{ key: 'a', label: 'Aresta', min: 0.6, max: 2.2, step: 0.05, default: 1.3 }],
    faces: (p) => polyhedronFacePoints(OCTA_VERTS, OCTA_IDX, 1, p.a),
    metrics: (p) => ({
      'Aresta': `${p.a.toFixed(2)} u`,
      'Àrea total': `${(2 * SQ3 * p.a * p.a).toFixed(2)} u²`,
      'Volum': `${((SQ2 / 3) * p.a ** 3).toFixed(2)} u³`,
    }),
  },
  dodecaedre: {
    label: 'Dodecaedre', emoji: '⚽', kind: 'flat',
    params: [{ key: 'a', label: 'Aresta', min: 0.4, max: 1.4, step: 0.05, default: 0.8 }],
    faces: (p) => polyhedronFacePoints(DODECA_VERTS, DODECA_IDX, 3, p.a),
    metrics: (p) => ({
      'Aresta': `${p.a.toFixed(2)} u`,
      'Àrea total': `${(3 * Math.sqrt(25 + 10 * SQ5) * p.a * p.a).toFixed(2)} u²`,
      'Volum': `${(((15 + 7 * SQ5) / 4) * p.a ** 3).toFixed(2)} u³`,
    }),
  },
  icosaedre: {
    label: 'Icosaedre', emoji: '🎲', kind: 'flat',
    params: [{ key: 'a', label: 'Aresta', min: 0.5, max: 1.8, step: 0.05, default: 1.1 }],
    faces: (p) => polyhedronFacePoints(ICOSA_VERTS, ICOSA_IDX, 1, p.a),
    metrics: (p) => ({
      'Aresta': `${p.a.toFixed(2)} u`,
      'Àrea total': `${(5 * SQ3 * p.a * p.a).toFixed(2)} u²`,
      'Volum': `${(((5 * (3 + SQ5)) / 12) * p.a ** 3).toFixed(2)} u³`,
    }),
  },
};

function Solid3DPanel({ onClose, onInsertSnapshot }) {
  const mountRef = useRef(null);
  const threeRef = useRef({
    renderer: null, scene: null, camera: null, solid: null, raf: null,
    dragging: false, lastX: 0, lastY: 0, moved: 0,
    rotX: -0.5, rotY: 0.6, zoom: 6, autoRotate: false,
  });

  const [solidKey, setSolidKey] = useState('cub');
  const [params, setParams] = useState(() => defaultParams(SOLIDS_3D.cub));
  const [paintColor, setPaintColor] = useState('#EB5A2E');
  const [paintMode, setPaintMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [explode, setExplode] = useState(0);
  const [pos, setPos] = useState({ x: 70, y: 70 });

  const paintColorRef = useRef(paintColor);
  useEffect(() => { paintColorRef.current = paintColor; }, [paintColor]);
  const paintModeRef = useRef(paintMode);
  useEffect(() => { paintModeRef.current = paintMode; }, [paintMode]);
  useEffect(() => { threeRef.current.autoRotate = autoRotate; }, [autoRotate]);

  const solidDef = SOLIDS_3D[solidKey];

  useEffect(() => {
    const mount = mountRef.current;
    const t = threeRef.current;
    const width = Math.max(1, mount.clientWidth), height = Math.max(1, mount.clientHeight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key1 = new THREE.DirectionalLight(0xffffff, 0.7); key1.position.set(3, 4, 5); scene.add(key1);
    const key2 = new THREE.DirectionalLight(0xffffff, 0.3); key2.position.set(-4, -2, -3); scene.add(key2);

    t.renderer = renderer; t.scene = scene; t.camera = camera;

    const animate = () => {
      const tt = threeRef.current;
      if (tt.solid) {
        if (tt.autoRotate && !tt.dragging) tt.rotY += 0.006;
        tt.solid.rotation.set(tt.rotX, tt.rotY, 0);
      }
      tt.camera.position.set(0, 0, tt.zoom);
      tt.camera.lookAt(0, 0, 0);
      tt.renderer.render(tt.scene, tt.camera);
      tt.raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(threeRef.current.raf);
      ro.disconnect();
      if (threeRef.current.solid) disposeObject(threeRef.current.solid);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  const rebuildSolid = () => {
    const t = threeRef.current;
    if (!t.scene) return;
    if (t.solid) { t.scene.remove(t.solid); disposeObject(t.solid); }
    t.solid = buildSolidObject(solidDef, params);
    t.scene.add(t.solid);
  };

  useEffect(() => { rebuildSolid(); }, [solidKey, params]);

  useEffect(() => {
    const t = threeRef.current;
    if (t.solid) setExplodeAmount(t.solid, explode * EXPLODE_MAX);
  }, [explode, solidKey, params]);

  const selectSolid = (key) => {
    setSolidKey(key);
    setParams(defaultParams(SOLIDS_3D[key]));
    setPaintMode(false);
    setExplode(0);
  };

  const handleFaceClick = (clientX, clientY) => {
    const t = threeRef.current;
    if (!t.solid || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, t.camera);
    const targets = [];
    t.solid.traverse((o) => { if (o.isMesh) targets.push(o); });
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length) return;
    const hit = hits[0];
    const color = paintColorRef.current;
    if (Array.isArray(hit.object.material)) {
      hit.object.material[hit.face.materialIndex].color.set(color);
    } else {
      hit.object.material.color.set(color);
    }
  };

  const onViewportDown = (e) => {
    const t = threeRef.current;
    t.dragging = true; t.moved = 0; t.lastX = e.clientX; t.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onViewportMove = (e) => {
    const t = threeRef.current;
    if (!t.dragging) return;
    const dx = e.clientX - t.lastX, dy = e.clientY - t.lastY;
    t.moved += Math.abs(dx) + Math.abs(dy);
    t.rotY += dx * 0.008;
    t.rotX = Math.max(-1.4, Math.min(1.4, t.rotX + dy * 0.008));
    t.lastX = e.clientX; t.lastY = e.clientY;
  };
  const onViewportUp = (e) => {
    const t = threeRef.current;
    t.dragging = false;
    if (t.moved < 6 && paintModeRef.current) handleFaceClick(e.clientX, e.clientY);
  };
  const onViewportWheel = (e) => {
    e.preventDefault();
    const t = threeRef.current;
    t.zoom = Math.max(2.5, Math.min(14, t.zoom + (e.deltaY > 0 ? 0.4 : -0.4)));
  };

  const headerDragRef = useRef(null);
  const onHeaderDown = (e) => {
    headerDragRef.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHeaderMove = (e) => {
    if (!headerDragRef.current) return;
    const d = headerDragRef.current;
    setPos({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const onHeaderUp = () => { headerDragRef.current = null; };

  const handleSnapshot = () => {
    const t = threeRef.current;
    if (!t.renderer) return;
    t.renderer.render(t.scene, t.camera);
    const dataUrl = t.renderer.domElement.toDataURL('image/png');
    onInsertSnapshot(dataUrl);
  };

  const metrics = solidDef.metrics(params);

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: 660, height: 480,
      background: '#fff', border: '1px solid #D8DEE6', borderRadius: 14,
      boxShadow: '0 24px 60px rgba(20,30,45,0.35)', zIndex: 60,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div
        onPointerDown={onHeaderDown} onPointerMove={onHeaderMove} onPointerUp={onHeaderUp}
        style={{
          background: '#123B61', color: '#fff', padding: '10px 14px', cursor: 'grab',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, fontSize: 14,
        }}
      >
        <span>🧊 Biblioteca de Sòlids 3D</span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 168, overflowY: 'auto', borderRight: '1px solid #E4E9EF', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(SOLIDS_3D).map(([key, def]) => (
            <button key={key} onClick={() => selectSolid(key)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, border: 'none',
              background: key === solidKey ? '#E4ECF5' : 'transparent', cursor: 'pointer', textAlign: 'left',
              fontSize: 13, color: '#1B2733', fontWeight: key === solidKey ? 600 : 400,
            }}>
              <span style={{ fontSize: 17 }}>{def.emoji}</span>{def.label}
            </button>
          ))}
        </div>

        <div
          ref={mountRef}
          onPointerDown={onViewportDown} onPointerMove={onViewportMove} onPointerUp={onViewportUp} onWheel={onViewportWheel}
          style={{ flex: 1, position: 'relative', background: 'linear-gradient(180deg, #F5F8FB, #E7ECF2)', cursor: paintMode ? 'crosshair' : 'grab', touchAction: 'none' }}
        >
          <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, color: '#5B6B7C', background: 'rgba(255,255,255,0.75)', padding: '3px 7px', borderRadius: 6 }}>
            🖱️ Arrossega per girar · roda per fer zoom{paintMode ? ' · clic per pintar una cara' : ''}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E4E9EF', padding: '10px 14px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
          {solidDef.params.map((p) => (
            <label key={p.key} style={{ fontSize: 12, color: '#1B2733' }}>
              {p.label}: {params[p.key].toFixed(2)} u
              <input
                type="range" min={p.min} max={p.max} step={p.step} value={params[p.key]}
                onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: Number(e.target.value) }))}
                style={{ display: 'block', width: '100%' }}
              />
            </label>
          ))}

          <label style={{ fontSize: 12, color: solidDef.kind === 'flat' ? '#1B2733' : '#A6B1BE' }}>
            🧩 Desplegar (veure com es forma)
            <input
              type="range" min={0} max={1} step={0.01} value={explode}
              disabled={solidDef.kind !== 'flat'}
              onChange={(e) => setExplode(Number(e.target.value))}
              style={{ display: 'block', width: '100%' }}
            />
            {solidDef.kind !== 'flat' && (
              <span style={{ fontSize: 10.5, color: '#A6B1BE' }}>No disponible en superfícies corbes</span>
            )}
          </label>
        </div>

        <div style={{ fontSize: 12, color: '#1B2733', minWidth: 160, lineHeight: 1.6 }}>
          {Object.entries(metrics).map(([k, v]) => (
            <div key={k}><b>{k}:</b> {v}</div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={paintMode} onChange={(e) => setPaintMode(e.target.checked)} />
            Pinta les cares
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {PALETTE_3D.map((c) => (
              <button key={c} onClick={() => setPaintColor(c)} style={{
                width: 18, height: 18, borderRadius: 5, background: c, cursor: 'pointer',
                border: paintColor === c ? '2px solid #1B2733' : '1px solid #D8DEE6', padding: 0,
              }} />
            ))}
          </div>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            Rotació automàtica
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 'auto' }}>
          <button onClick={rebuildSolid} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #D8DEE6', background: '#fff', cursor: 'pointer' }}>↺ Reinicia colors</button>
          <button onClick={handleSnapshot} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: 'none', background: '#EB5A2E', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>📌 Insereix a la pissarra</button>
        </div>
      </div>
    </div>
  );
}

export default InfiniteCanvas;