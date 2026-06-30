// src/gesture.js

const PINCH_START = 0.04; 
const PINCH_END = 0.07;   
const GRAB_RADIUS = 50;   

function landmarkDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function detectGestures(handsData, canvasWidth, canvasHeight, previousGestures = []) {
  const gestures = [];

  for (const hand of handsData) {
    const lm = hand.landmarks;

    // --- SOLUCIÓN AL BUG DE HANDEDNESS ---
    // Extraemos la etiqueta ('Left' o 'Right') de forma segura sea cual sea el formato
    let label = 'Right'; 
    if (hand.handedness) {
      if (Array.isArray(hand.handedness)) {
        label = hand.handedness[0]?.label || 'Right';
      } else if (hand.handedness.label) {
        label = hand.handedness.label;
      }
    }
    // -------------------------------------

    const thumbTip = lm[4];
    const indexTip = lm[8];
    const pinchDist = landmarkDist(thumbTip, indexTip);

    // Control de histéresis usando el estado anterior
    const prev = previousGestures.find(g => g.handedness === label);
    let isPinching = prev ? prev.isPinching : false;

    if (isPinching) {
      if (pinchDist > PINCH_END) isPinching = false;
    } else {
      if (pinchDist < PINCH_START) isPinching = true;
    }

    const palm = lm[0];
    const x = (1 - palm.x) * canvasWidth;
    const y = palm.y * canvasHeight;

    const pinchX = (1 - ((thumbTip.x + indexTip.x) / 2)) * canvasWidth;
    const pinchY = ((thumbTip.y + indexTip.y) / 2) * canvasHeight;

    gestures.push({
      handedness: label,
      isPinching,
      pinchStrength: Math.max(0, 1 - pinchDist / 0.1),
      pinchX,
      pinchY,
      palmX: x,
      palmY: y,
      grabbedParticle: prev ? prev.grabbedParticle : null
    });
  }
  return gestures;
}

// (El resto de funciones como applyGesturesToWorld y findClosestParticle se quedan igual)

export function applyGesturesToWorld(gestures, particles) {
  // Limpiar estados de agarre viejos
  for (const p of particles) {
    p.grabbed = false;
    p.grabbedByHand = null;
  }

  for (const gesture of gestures) {
    if (!gesture.isPinching) {
      gesture.grabbedParticle = null;
      continue;
    }

    let target = gesture.grabbedParticle;

    // Si la mano no tiene objeto asignado, busca el más cercano
    if (!target) {
      target = findClosestParticle(particles, gesture.pinchX, gesture.pinchY, GRAB_RADIUS);
      if (target) gesture.grabbedParticle = target;
    }

    if (target) {
      target.grabbed = true;
      target.grabbedByHand = gesture.handedness;
      target.x = gesture.pinchX;
      target.y = gesture.pinchY;
      target.vx = 0;
      target.vy = 0;
    }
  }
}

function findClosestParticle(particles, x, y, radius) {
  let closest = null;
  let minDist = radius;
  for (const p of particles) {
    // Los neutrinos no se pueden manipular ni agarrar por las manos
    if (['nu_e', 'anti_nu_e', 'nu_mu', 'anti_nu_mu'].includes(p.type)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < minDist) {
      minDist = d;
      closest = p;
    }
  }
  return closest;
}
