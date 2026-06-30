// src/physics/PionDecay.js
import { Particle } from './Particle.js';

export class PionDecay {
  constructor(nuclearGroup) {
    this.group = nuclearGroup;
    this.lifetime = 4.0 + Math.random() * 4.0; // segundos de vida media
    this.elapsed = 0;
    this.isDead = false;
  }

  update(dt, particles, groups, audioManager) {
    if (this.isDead) return;
    this.elapsed += dt;

    if (this.elapsed >= this.lifetime) {
      this.isDead = true;
      this.executeDecay(particles, groups, audioManager);
    }
  }

  executeDecay(particles, groups, audioManager) {
    const center = this.group.center;
    const type = this.group.name; // "π⁺" o "π⁻"
    const speed = 280; // Momento de velocidad constante
    const angle = Math.random() * Math.PI * 2;

    // 1. Borrar los quarks del pión de la simulación
    for (const m of this.group.members) {
      const idx = particles.indexOf(m);
      if (idx !== -1) particles.splice(idx, 1);
    }
    const gIdx = groups.indexOf(this.group);
    if (gIdx !== -1) groups.splice(gIdx, 1);

    // 2. Generar subproductos Muónicos reales
    let muonType = 'muon';
    let neutrinoType = 'anti_nu_mu';
    if (type === "π⁺") {
      muonType = 'antimuon';
      neutrinoType = 'nu_mu';
    }

    const muon = new Particle({ type: muonType, x: center.x, y: center.y });
    muon.vx = Math.cos(angle) * speed;
    muon.vy = Math.sin(angle) * speed;

    const nu = new Particle({ type: neutrinoType, x: center.x, y: center.y });
    nu.vx = -Math.cos(angle) * speed;
    nu.vy = -Math.sin(angle) * speed;

    particles.push(muon, nu);
    if (audioManager) audioManager.playH2BondSound();
  }

  static updateAll(dt, particles, groups, audioManager) {
    for (const g of [...groups]) {
      if (g.pionController) {
        g.pionController.update(dt, particles, groups, audioManager);
      }
    }
  }
}