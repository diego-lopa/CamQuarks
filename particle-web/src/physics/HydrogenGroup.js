export class HydrogenGroup {
  static instances = [];

  constructor(protonGroup, electronParticle) {
    this.proton = protonGroup;        // Instancia de NuclearGroup
    this.electron = electronParticle;  // Instancia de Particle (tipo 'e')
    this.isH2Bonded = false;           // Si forma parte de una molécula H2
    this.pairGroup = null;             // Otra instancia de HydrogenGroup con la que está enlazado
    this.bonded = true;                // Estado de activación del átomo

    // Bloquear el electrón para que ya no sea manipulable individualmente
    this.electron.group = this;
    HydrogenGroup.instances.push(this);
  }

  get name() {
    return this.isH2Bonded ? "H₂" : "H";
  }

  // Dentro de src/physics/HydrogenGroup.js

    get radius() {
    if (this.isH2Bonded && this.pairGroup) {
        // 1. Obtener los centros de los dos núcleos (protones) involucrados
        const p1 = this.proton.center;
        const p2 = this.pairGroup.proton.center;
        
        // 2. Calcular la distancia geométrica entre ambos protones
        const distanceBetweenProtons = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        
        // 3. El radio dinámico será la mitad de la distancia + un margen extra (padding) de 45px 
        // para garantizar que la esfera los envuelva holgadamente por fuera.
        // Usamos Math.max para asegurarnos de que el radio nunca colapse por debajo de 130.
        return Math.max(165, (distanceBetweenProtons / 2) + 65);
    }
    
    // Si es un átomo de Hidrógeno (H) normal y solitario, mantiene su radio fijo de 85
    return 125;
    }

  get center() {
    if (this.isH2Bonded && this.pairGroup) {
      // Centro de masa molecular compartido
      const p1 = this.proton.center;
      const p2 = this.pairGroup.proton.center;
      return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
    return this.proton.center;
  }

  updatePhysics() {
    if (!this.bonded) return;

    // 1. Órbita del electrón alrededor de su protón (Física semi-cuántica Bohr/Muelle)
    const pCenter = this.proton.center;
    const dx = pCenter.x - this.electron.x;
    const dy = pCenter.y - this.electron.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      const targetRadius = 60; // Radio orbital visual preferido
      const orbitalForce = 0.12 * (dist - targetRadius);
      this.electron.applyForce((dx / dist) * orbitalForce, (dy / dist) * orbitalForce);
    }

    // 2. Fuerzas de enlace covalente si es una molécula H2
    if (this.isH2Bonded && this.pairGroup) {
      const p1 = this.proton.center;
      const p2 = this.pairGroup.proton.center;
      const mdx = p2.x - p1.x;
      const mdy = p2.y - p1.y;
      const mdist = Math.hypot(mdx, mdy);

      if (mdist > 1) {
        const h2EquilibriumDist = 140; // Distancia de enlace molecular estable
        const bondStrength = 0.05 * (mdist - h2EquilibriumDist);
        
        // Aplicar fuerzas de atracción/repulsión elástica mutua a los componentes nucleares
        const fx = (mdx / mdist) * bondStrength;
        const fy = (mdy / mdist) * bondStrength;

        // Repartir la fuerza a los quarks del protón 1
        for (const q of this.proton.members) q.applyForce(fx, fy);
        // Repartir fuerza inversa a los quarks del protón 2
        for (const q of this.pairGroup.proton.members) q.applyForce(-fx, -fy);
      }
    }
  }

  // Escáner en tiempo real para capturar electrones libres

static tryCapture(particles, groups, audioManager) {
  const CAPTURE_DIST = 100; 

  const grabbedElectrons = particles.filter(p => p.type === 'e' && p.grabbed && !p.hydrogenGroup);

  for (const e of grabbedElectrons) {
    for (const g of groups) {
      if (g.name !== "Protón" || g.hasElectron) continue;

      const grabbedQuark = g.members.find(p => p.grabbed);

      if (grabbedQuark) {
        const dist = Math.hypot(e.x - grabbedQuark.x, e.y - grabbedQuark.y);

        if (dist < CAPTURE_DIST) {
          console.log("[Química] ¡Captura manual! Se ha formado un átomo de Hidrógeno (H).");
          
          e.grabbed = false;
          grabbedQuark.grabbed = false;

          // Se inicializa el átomo (El constructor añade automáticamente la instancia a static instances)
          const newH = new HydrogenGroup(g, e);
          
          // ¡LÍNEA DUPLICADA CORREGIDA/ELIMINADA AQUÍ!
          
          g.hasElectron = true;
          e.hydrogenGroup = newH;

          if (audioManager) audioManager.playBondSound();
          return; 
        }
      }
    }
  }
}

  // Escáner en tiempo real para fusionar dos átomos H en un enlace molecular H2
  static tryFormH2(audioManager) {
    const singleAtoms = HydrogenGroup.instances.filter(h => !h.isH2Bonded && h.bonded);

    for (let i = 0; i < singleAtoms.length; i++) {
      for (let j = i + 1; j < singleAtoms.length; j++) {
        const h1 = singleAtoms[i];
        const h2 = singleAtoms[j];

        const dist = Math.hypot(h1.center.x - h2.center.x, h1.center.y - h2.center.y);
        if (dist < 180) { // Umbral de acoplamiento molecular covalente
          h1.isH2Bonded = true;
          h2.isH2Bonded = true;
          h1.pairGroup = h2;
          h2.pairGroup = h1;

          if (audioManager) audioManager.playH2BondSound();
          console.log("[HydrogenGroup] Enlace Molecular Covalente H₂ establecido.");
        }
      }
    }
  }
}