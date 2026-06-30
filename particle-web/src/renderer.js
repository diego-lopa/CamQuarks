
// src/renderer.js

import { HydrogenGroup } from './physics/HydrogenGroup.js';
import { flashEffects } from './main.js'; 

const neutrinoImg = new Image();
neutrinoImg.src = 'assets/neutrino.png';
 
export function render(ctx, canvas, particles, groups, gestures) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. DIBUJAR NÚCLEOS (Protones, Neutrones y Piones se mantienen puros en su interior)
  for (const group of groups) {
  const { x, y } = group.center;

  let maxDist = 0;
  const isPion = group.members.length === 2;
  
  // ¡AJUSTE DE RADIO!: Incrementamos los márgenes para adaptarlos al nuevo tamaño de los quarks
  // Antes: isPion ? 18 : 32
  const BASE_PADDING = isPion ? 35 : 45; 
  
  for (const p of group.members) {
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist > maxDist) maxDist = dist;
  }
  const dynamicRadius = maxDist + BASE_PADDING;
  const strokeColor = isPion ? 'rgba(0, 238, 255, 0.4)' : 'rgba(255, 68, 68, 0.3)';

    // Colores y nombres originales fijos del núcleo (El protón ya no se oculta)
    let displayName = group.name;
    let textColor = '#00EEFF';

    if (group.name === 'Protón') {
      displayName = 'Protón';
      textColor = '#FF6644';
    } else if (group.name === 'Neutrón') {
      displayName = 'Neutrón';
      textColor = '#4499FF';
    }

    ctx.beginPath();
    ctx.arc(x, y, dynamicRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(displayName, x, y - dynamicRadius - 8);
  }

  // 2. DIBUJAR CORTEX/CIRCUNFERENCIA EXTERIOR DE HIDRÓGENOS (H / H₂)
  const drawnH2 = new Set();
  for (const hAtom of HydrogenGroup.instances) {
    if (!hAtom.bonded) continue;

    // Si es H2, evitamos duplicar la circunferencia exterior calculando una sola compartida
    if (hAtom.isH2Bonded) {
      if (drawnH2.has(hAtom)) continue;
      if (hAtom.pairGroup) {
        drawnH2.add(hAtom);
        drawnH2.add(hAtom.pairGroup);
      }
    }

    const { x, y } = hAtom.center;
    const radius = hAtom.radius; // 85 para H, 130 para H2 (definidos en HydrogenGroup.js)
    const displayName = hAtom.isH2Bonded ? 'H₂' : 'H';
    const textColor = hAtom.isH2Bonded ? '#00874a' : '#33ff3d';

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    // Estilo sutil y orbital para la capa atómica externa
    ctx.fillStyle = hAtom.isH2Bonded ? 'rgba(0, 255, 100, 0.02)' : 'rgba(0, 150, 255, 0.02)';
    ctx.strokeStyle = hAtom.isH2Bonded ? 'rgba(0, 255, 100, 0.35)' : 'rgba(79, 250, 87, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]); // Línea orbital punteada elegante
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Etiqueta del elemento químico en el extremo exterior superior
    ctx.fillStyle = textColor;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(displayName, x, y - radius - 12);
  }

  // 3. Dibujar enlace covalente molecular H₂ (Línea central que une ambos núcleos)
  const h2LinesDrawn = new Set();
  for (const hGroup of HydrogenGroup.instances) {
    if (!hGroup.bonded || !hGroup.isH2Bonded || !hGroup.pairGroup) continue;
    if (h2LinesDrawn.has(hGroup)) continue;
    h2LinesDrawn.add(hGroup);
    h2LinesDrawn.add(hGroup.pairGroup);

    const p1 = hGroup.proton.center;
    const p2 = hGroup.pairGroup.proton.center;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. Dibujar Partículas Individuales (Quarks, Leptones, Fotones)
  for (const p of particles) {
    ctx.save();
    
    if (p.grabbed) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#FFFFFF';
    } else if (p.type === 'photon') {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FFFFFF';
    } else if (p.type.startsWith('nu_') || p.type.startsWith('anti_nu_')) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
    } else {
      ctx.shadowBlur = 5;
      ctx.shadowColor = p.color;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    
    const esAntimateria = p.type.startsWith('anti_') || p.type === 'positron' || p.type === 'antimuon';
    if (esAntimateria) {
      ctx.setLineDash([3, 3]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = p.grabbed ? '#FFFFFF' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = p.grabbed ? 3 : 1.5;
    ctx.fill();
    ctx.stroke();

    const esNeutrino = ['nu_e', 'anti_nu_e', 'nu_mu', 'anti_nu_mu'].includes(p.type);
    if (esNeutrino) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();

      if (neutrinoImg.complete) {
        const size = p.radius * 2 * 0.85;
        ctx.drawImage(neutrinoImg, p.x - size / 2, p.y - size / 2, size, size);
      }
    }

    ctx.restore();

    if (!esNeutrino) {
      const usaTextoNegro = ['muon', 'antimuon', 'e', 'positron'].includes(p.type);
      ctx.fillStyle = usaTextoNegro ? '#000000' : '#FFFFFF';
      ctx.font = 'italic bold 15px serif'; 
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, p.x, p.y);
    }
  }

  // 5. Feedback Visual del Pinch Manual
  for (const g of gestures) {
    if (!g.isPinching) continue;
    ctx.beginPath();
    ctx.arc(g.pinchX, g.pinchY, 14 * g.pinchStrength, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(184, 184, 184, 0.4)';
    ctx.fill();
  }

  // 6. Renderizar los efectos de luz de las aniquilaciones cuánticas
  if (flashEffects && flashEffects.length > 0) {
    for (const f of flashEffects) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      
      let gradient = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${f.alpha})`);
      gradient.addColorStop(0.3, `rgba(255, 255, 150, ${f.alpha * 0.8})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();
    }
  }
}