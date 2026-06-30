import { PionDecay } from './PionDecay.js';

export class NuclearGroup {
  constructor(members) {
    this.members = members;
    this.springStrength = 9.5;
    this.damping = 0.35;
    this.name = "";
    this.idleTime = 0; // Tiempo acumulado sin interacción para gatillar desintegraciones
    
    this.updateConstituents();
  }

  // Evalúa los quarks y transmutaciones (Equivalente al DetermineGroupName de Unity)
  updateConstituents() {
    for (const p of this.members) {
      p.group = this;
    }

    const ups = this.members.filter(p => p.type === 'u').length;
    const downs = this.members.filter(p => p.type === 'd').length;
    const antiUps = this.members.filter(p => p.type === 'anti_u').length;
    const antiDowns = this.members.filter(p => p.type === 'anti_d').length;

    // Lógica de Piones (Mesones de 2 quarks)
    if (this.members.length === 2) {
      if (ups === 1 && antiDowns === 1) this.name = "π⁺";
      else if (downs === 1 && antiUps === 1) this.name = "π⁻";
      else this.name = "Mesón Exótico";

      // Si es un pión recién armado y no tiene el controlador de decaimiento activo, lo inicializamos
      if (!this.pionController) {
        this.pionController = new PionDecay(this);
      }
      return;
    }

    // Lógica de Bariones (3 quarks)
    if (this.members.length === 3 && antiUps === 0 && antiDowns === 0) {
      if (ups === 2 && downs === 1) this.name = "Protón";
      else if (ups === 1 && downs === 2) this.name = "Neutrón";
      else this.name = "Hadrón Exótico";
      this.pionController = null;
      return;
    }

    this.name = "Fuga de Quarks";
    this.pionController = null;
  }

  get center() {
    if (this.members.length === 0) return { x: 0, y: 0 };
    const x = this.members.reduce((s, p) => s + p.x, 0) / this.members.length;
    const y = this.members.reduce((s, p) => s + p.y, 0) / this.members.length;
    return { x, y };
  }

  // Corrección física: Se modifican las componentes de velocidad de la partícula nativamente
  applyForces() {
    const grabbed = this.members.find(p => p.grabbed);
    const leader = grabbed ?? this.center;

    for (const p of this.members) {
      if (p.grabbed) continue;
      
      const dx = leader.x - p.x;
      const dy = leader.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) continue;

      // Dirección normalizada del muelle
      const nx = dx / dist;
      const ny = dy / dist;

      // Fuerza elástica proporcional a la distancia del confinamiento de color
      const forceMag = this.springStrength * dist;

      // Modificamos directamente las velocidades de la partícula sumando la tracción
      // y aplicando el amortiguamiento de frenado (damping) para estabilizar la órbita interna
      p.vx += nx * forceMag - p.vx * this.damping;
      p.vy += ny * forceMag - p.vy * this.damping;
    }
  }

  // Verifica si el usuario está interactuando con el hadrón
  checkIdleState(dt) {
    const anyGrabbed = this.members.some(p => p.grabbed);
    if (anyGrabbed) {
      this.idleTime = 0; // Se resetea el reloj al manipularlo
    } else {
      this.idleTime += dt;
    }
  }
}