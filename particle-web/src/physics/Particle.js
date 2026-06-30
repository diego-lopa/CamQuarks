// src/physics/Particle.js

export class Particle {
  // src/physics/Particle.js

constructor({ type, x, y }) {
  this.type = type;
  this.x = x;
  this.y = y;
  this.vx = 0;
  this.vy = 0;
  this.grabbed = false;

  // 1. DECLARAMOS LOS QUARKS UNA SOLA VEZ AQUÍ ARRIBA
  const quarks = ['u', 'anti_u', 'd', 'anti_d'];

  // 2. Ajuste del tamaño dinámico (50% más grande para Quarks)
  if (quarks.includes(type)) {
    this.radius = 22.5; 
  } else {
    this.radius = type === 'photon' ? 8 : 15;
  }

  // Control estricto de tiempo de vida (en segundos)
  this.age = 0;
  this.lifespan = null;

  // Los quarks, antiquarks, electrones y positrones son inmortales por tiempo.
  const inmortales = ['u', 'anti_u', 'd', 'anti_d', 'e', 'positron'];
  
  if (!inmortales.includes(type)) {
    this.lifespan = (type === 'photon') ? 5.0 : 10.0; 
  }

  // 3. ¡REUTILIZAMOS LA VARIABLE! (Elimina el 'const' que estaba aquí abajo)
  // Partículas con momento lineal constante
  this.constantMomentum = !quarks.includes(type);

  this.updateLabelAndColor();
}

  updateLabelAndColor() {
    switch (this.type) {
      // --- QUARKS Y ANTIQUARKS ---
      case 'u':
        this.label = 'u';
        this.color = '#FF8800'; // Naranja
        break;
      case 'anti_u':
        this.label = 'ū';
        this.color = '#FF8800'; // Mismo color que u (naranja)
        break;
      case 'd':
        this.label = 'd';
        this.color = '#1155FF'; // Azul
        break;
      case 'anti_d':
        this.label = 'đ';
        this.color = '#1155FF'; // Mismo color que d (azul)
        break;
 
      // --- LEPTONES ELECTRÓNICOS ---
      case 'e':
        this.label = 'e⁻';
        this.color = '#FFFFFF'; // Blanco
        break;
      case 'positron':
        this.label = 'e⁺';
        this.color = '#FFFFFF'; // Blanco
        break;
 
      // --- UNIFICACIÓN DE NEUTRINOS ---
      case 'nu_e':
        this.label = 'νₑ';
        this.color = '#DDDDDD'; // Gris claro
        break;
      case 'anti_nu_e':
        this.label = 'ν̄ₑ';
        this.color = '#DDDDDD'; // Gris claro
        break;
      case 'nu_mu':
        this.label = 'ν_μ';
        this.color = '#DDDDDD'; // Gris claro
        break;
      case 'anti_nu_mu':
        this.label = 'ν̄_μ';
        this.color = '#DDDDDD'; // Gris claro
        break;
 
      // --- LEPTONES MUÓNICOS ---
      case 'muon':
        this.label = 'μ⁻';
        this.color = '#FFF59D'; // Amarillo claro
        break;
      case 'antimuon':
        this.label = 'μ⁺';
        this.color = '#FFF59D'; // Amarillo claro
        break;
 
      // --- BOSONES ---
      case 'photon':
        this.label = 'γ';
        this.color = '#FFFFFF';
        break;
    }
  }

  applyForce(fx, fy) {
    // Las fuerzas externas se añaden a la aceleración (que en nuestra integración de Euler simple suma directo a la velocidad)
    this.vx += fx;
    this.vy += fy;
  }

  update(dt, canvasWidth = 800, canvasHeight = 600) {
    // NUEVA REGLA DE INMUNIDAD: Los neutrinos NO se pueden manipular ni agarrar por las manos
    const esNeutrino = ['nu_e', 'anti_nu_e', 'nu_mu', 'anti_nu_mu'].includes(this.type);
    if (esNeutrino) {
      this.grabbed = false; 
    }

    if (this.grabbed) return;

    // Acumular edad si tiene un límite de vida asignado (Leptones inestables y fotones)
    if (this.lifespan !== null) {
      this.age += dt;
    }

    // Movimiento cinemático
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Fricción elástica (Solo aplica a Quarks, el resto mantiene momento constante)
    if (!this.constantMomentum) {
      this.vx *= 0.95;
      this.vy *= 0.95;
    }

    // Comportamiento en los límites de la pantalla
    const r = this.radius;
    if (this.type !== 'photon') {
      // Las partículas físicas (muones, electrones, neutrinos, etc.) rebotan elásticamente
      if (this.x < r) { this.x = r; this.vx *= -1; }
      if (this.x > canvasWidth - r) { this.x = canvasWidth - r; this.vx *= -1; }
      if (this.y < r) { this.y = r; this.vy *= -1; }
      if (this.y > canvasHeight - r) { this.y = canvasHeight - r; this.vy *= -1; }
    }
  }

  // ─────────────────────────────────────────────────────────
  // SISTEMA DE COLISIONES ESTÁTICO (Evita el solapamiento de partículas)
  // ─────────────────────────────────────────────────────────
  static resolveCollisions(particles) {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];

        // REGLA FANTASMA: Los fotones y TODOS los neutrinos pasan de largo sin colisión física
        const esFantasma = (type) => ['photon', 'nu_e', 'anti_nu_e', 'nu_mu', 'anti_nu_mu'].includes(type);
        if (esFantasma(p1.type) || esFantasma(p2.type)) continue;

        // REGLA e⁻/e⁺: No colisionan entre sí, se atraen electromagnéticamente hasta aniquilarse
        const esPar = (p1.type === 'e' && p2.type === 'positron') || (p1.type === 'positron' && p2.type === 'e');
        if (esPar) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        
        const minDist = p1.radius + p2.radius;

        if (dist < minDist) {
          const overlap = minDist - dist;
          
          const nx = dist === 0 ? 1 : dx / dist;
          const ny = dist === 0 ? 0 : dy / dist;

          let amt1 = 0.5;
          let amt2 = 0.5;

          if (p1.grabbed) { amt1 = 0; amt2 = 1; }
          if (p2.grabbed) { amt1 = 1; amt2 = 0; }
          if (p1.grabbed && p2.grabbed) { amt1 = 0; amt2 = 0; } 

          p1.x -= nx * overlap * amt1;
          p1.y -= ny * overlap * amt1;
          p2.x += nx * overlap * amt2;
          p2.y += ny * overlap * amt2;

          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const impulse = nx * kx + ny * ky;

          if (impulse > 0) {
            if (!p1.grabbed) { p1.vx -= impulse * nx * 0.5; p1.vy -= impulse * ny * 0.5; }
            if (!p2.grabbed) { p2.vx += impulse * nx * 0.5; p2.vy += impulse * ny * 0.5; }
          }
        }
      }
    }
  }
}