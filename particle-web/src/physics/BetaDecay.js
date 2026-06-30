// src/physics/BetaDecay.js
import { Particle } from './Particle.js';

export class BetaDecay {
  static minTime = 30.0;
  static maxTime = 60.0;
  static separationSpeed = 250; // Píxeles por segundo constantes

  static checkDecay(groups, particles, audioManager, dt) {
    for (const g of groups) {
      // Ignorar piones de 2 quarks, solo bariones (3 quarks)
      if (g.members.length !== 3) continue;

      // ¡AJUSTE CRÍTICO!: Si el protón ya formó hidrógeno/H2, pausamos por completo su decaimiento
      if (g.hasElectron) {
        g.idleTime = 0; // Congelamos el temporizador interno
        continue;       // Saltamos al siguiente hadrón sin procesar el decaimiento
      }

      // Si el usuario está manipulando el hadrón, congelamos el temporizador
      if (g.members.some(p => p.grabbed)) {
        g.idleTime = 0;
        continue;
      }

      if (!g.targetIdleTime) {
        g.targetIdleTime = this.minTime + Math.random() * (this.maxTime - this.minTime);
        g.idleTime = 0;
      }

      g.idleTime += dt;

      if (g.idleTime >= g.targetIdleTime) {
        g.idleTime = 0;
        g.targetIdleTime = null; // Resetear para el próximo ciclo

        const center = g.center;
        const angle = Math.random() * Math.PI * 2;

        if (g.name === "Neutrón") {
          // Neutrón (udd) -> Protón (uud) + e⁻ + ν̄e
          const dQuark = g.members.find(p => p.type === 'd');
          if (!dQuark) continue;

          dQuark.type = 'u'; // Transmutación instantánea de sabor
          g.updateConstituents();

          // Crear Electrón (e⁻) constante
          const e = new Particle({ type: 'e', x: center.x, y: center.y });
          e.vx = Math.cos(angle) * this.separationSpeed;
          e.vy = Math.sin(angle) * this.separationSpeed;
          particles.push(e);

          // Crear Antineutrino electrónico (ν̄e)
          const nu = new Particle({ type: 'anti_nu_e', x: center.x, y: center.y });
          nu.vx = -Math.cos(angle) * this.separationSpeed;
          nu.vy = -Math.sin(angle) * this.separationSpeed;
          particles.push(nu);
        } else if (g.name === "Protón") {
          // Protón (uud) -> Neutrón (udd) + e⁺ + νe
          const uQuark = g.members.find(p => p.type === 'u');
          if (!uQuark) continue;

          uQuark.type = 'd'; // Transmutación de sabor
          g.updateConstituents();

          // Crear Positrón (e⁺)
          const pos = new Particle({ type: 'positron', x: center.x, y: center.y });
          pos.vx = Math.cos(angle) * this.separationSpeed;
          pos.vy = Math.sin(angle) * this.separationSpeed;
          particles.push(pos);

          // Crear Neutrino electrónico (νe)
          const nu = new Particle({ type: 'nu_e', x: center.x, y: center.y });
          nu.vx = -Math.cos(angle) * this.separationSpeed;
          nu.vy = -Math.sin(angle) * this.separationSpeed;
          particles.push(nu);
        }

        if (audioManager) audioManager.playBondSound();
      }
    }
  }
}