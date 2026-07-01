import { initCamera } from './camera.js';
import { detectGestures, applyGesturesToWorld } from './gesture.js';
import { Particle } from './physics/Particle.js';
import { NuclearGroup } from './physics/NuclearGroup.js';
import { HydrogenGroup } from './physics/HydrogenGroup.js';
import { BetaDecay } from './physics/BetaDecay.js';
import { PionDecay } from './physics/PionDecay.js';
import { AudioManager } from './audio.js';
import { render } from './renderer.js';

// --- ESTADO GLOBAL EXPORTADO ---
export let particles = [
  // Hadrón 1: Protón inicial (u, u, d)
  new Particle({ type: 'u', x: 250, y: 300 }),
  new Particle({ type: 'u', x: 300, y: 270 }),
  new Particle({ type: 'd', x: 270, y: 330 }),

  // Hadrón 2: Neutrón inicial (u, d, d)
  new Particle({ type: 'u', x: 550, y: 300 }),
  new Particle({ type: 'd', x: 600, y: 270 }),
  new Particle({ type: 'd', x: 570, y: 330 })
];

export let groups = [
  new NuclearGroup([particles[0], particles[1], particles[2]]), // Protón
  new NuclearGroup([particles[3], particles[4], particles[5]])  // Neutrón
];

export let flashEffects = [];

// --- ELEMENTOS DEL DOM ---
const video = document.getElementById('webcam');
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
const hudStatus = document.getElementById('hand-status');

const audioManager = new AudioManager();
let lastGestures = [];
const DT = 1 / 60;

function onHandResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    if (hudStatus) hudStatus.innerText = `Manos detectadas: ${results.multiHandLandmarks.length}`;
    lastGestures = detectGestures(
      results.multiHandLandmarks.map((lm, i) => ({
        landmarks: lm,
        handedness: results.multiHandedness[i]
      })),
      canvas.width,
      canvas.height,
      lastGestures
    );
  } else {
    if (hudStatus) hudStatus.innerText = "Esperando manos...";
    lastGestures = [];
  }
}

// ─────────────────────────────────────────────────────────
// BUCLE PRINCIPAL DE ANIMACIÓN
// ─────────────────────────────────────────────────────────
function gameLoop() {
  // 1. Procesar entrada de gestos
  applyGesturesToWorld(lastGestures, particles);

  // ─── CÁLCULO DE INERCIA Y LANZAMIENTO DINÁMICO ───
  for (const p of particles) {
    const esNeutrino = ['nu_e', 'anti_nu_e', 'nu_mu', 'anti_nu_mu'].includes(p.type);

    if (p.grabbed && !esNeutrino) {
      // Si es el primer frame que la agarramos, inicializamos sus posiciones anteriores
      if (p._oldX === undefined) p._oldX = p.x;
      if (p._oldY === undefined) p._oldY = p.y;

      // Calculamos la velocidad instantánea del arrastre (Desplazamiento / Delta Time)
      p.vx = (p.x - p._oldX) / DT;
      p.vy = (p.y - p._oldY) / DT;

      // Limitador de seguridad (cap) por si la cámara da un salto brusco
      const MAX_SPEED = 1200;
      const currentSpeed = Math.hypot(p.vx, p.vy);
      if (currentSpeed > MAX_SPEED) {
        p.vx = (p.vx / currentSpeed) * MAX_SPEED;
        p.vy = (p.vy / currentSpeed) * MAX_SPEED;
      }

      // Almacenamos la posición actual para el cálculo del siguiente frame
      p._oldX = p.x;
      p._oldY = p.y;
    } else {
      // Si la partícula no está agarrada o es un neutrino, limpiamos los rastros temporales
      delete p._oldX;
      delete p._oldY;
    }
  }

  // 2. Gestión de interacciones elásticas y aniquilaciones
  handleHadronStretching();
  handleDynamicNuclearFusion();
  handleElectronPositronAnnihilation();

  // Resolver las colisiones mecánicas antes de actualizar cinemáticas
  Particle.resolveCollisions(particles);

  // ─── LIMITAR LEPTONES EN ESCENA (MUONES Y NEUTRINOS) ───
  enforceLeptonLimits();

  // ─────────────────────────────────────────────────────────
  // CONTROL ESTRICTO Y ELIMINACIÓN/DECAIMIENTO DE PARTÍCULAS TEMPORALES
  // ─────────────────────────────────────────────────────────
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    
    // Ejecutamos el movimiento cinemático normal de la partícula una sola vez por frame
    p.update(DT, canvas.width, canvas.height);

    // CONTROL DE TIEMPO DE VIDA DIRECTO DESDE MAIN.JS (A prueba de fallos)
    if (p.lifespan !== null && p.age >= p.lifespan) {
        console.log(`[Decaimiento] Desintegrando partícula temporal: ${p.type}`);
        particles.splice(i, 1);
        continue;
    }

    // Si es un fotón y cruzó cualquiera de los bordes del canvas, se elimina
    if (p.type === 'photon' && (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height)) {
        particles.splice(i, 1);
        continue;
    }
  }

  // 3. Reglas cuánticas y decaimientos temporales
  HydrogenGroup.tryCapture(particles, groups, audioManager);
  HydrogenGroup.tryFormH2(audioManager);
  BetaDecay.checkDecay(groups, particles, audioManager, DT);
  PionDecay.updateAll(DT, particles, groups, audioManager);

  // ─── LIMPIEZA DE GRUPOS DISUELTOS / VACÍOS ───
  // Filtramos el array global para deshacernos de los grupos vaciados por el blindaje
  groups = groups.filter(g => g.members.length > 0);

  // 4. Integradores cinemáticos y fuerzas
  for (const g of groups) g.applyForces();
  for (const h of HydrogenGroup.instances) h.updatePhysics();

  // Resolver colisiones de quarks antes de actualizar posiciones finales
  Particle.resolveCollisions(particles);

  // Actualizar la animación del efecto de luz de aniquilación
  for (let i = flashEffects.length - 1; i >= 0; i--) {
    let f = flashEffects[i];
    f.radius += 120 * DT; 
    f.alpha -= 2.0 * DT;  
    if (f.alpha <= 0) flashEffects.splice(i, 1);
  }

  // 5. Dibujar escena
  render(ctx, canvas, particles, groups, lastGestures);

  requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES DE DINÁMICA CUÁNTICA
// ─────────────────────────────────────────────────────────


function handleHadronStretching() {
  const BREAK_DIST = 200; 

  for (const g of groups) {
    if (g.members.length !== 3) continue; // Solo actuamos sobre bariones estables (uud o udd)

    const grabbedMembers = g.members.filter(p => p.grabbed);

    if (grabbedMembers.length >= 2) {
      const q1 = grabbedMembers[0];
      const q2 = grabbedMembers[1];

      const esCombinacionValida = (q1.type === 'u' && q2.type === 'd') || (q1.type === 'd' && q2.type === 'u');

      if (esCombinacionValida) {
        const distanceBetweenQuarks = Math.hypot(q1.x - q2.x, q1.y - q2.y);

        if (distanceBetweenQuarks > BREAK_DIST) {
          const grabbedU = q1.type === 'u' ? q1 : q2;
          const grabbedD = q1.type === 'd' ? q1 : q2;
          const remainingQuark = g.members.find(p => p !== q1 && p !== q2);

          let newPionGroupType = "";
          let vacancyQuarkType = "";
          let vacancyAntiQuarkType = "";
          let pionMovingQuark = null;

          // ─── REGLAS ESTRICTAS DEL MODELO ESTÁNDAR ───
          if (g.name === "Protón") {
            // Un Protón (uud) pierde un 'u' (pionMovingQuark) y se queda con (ud).
            // Para volver a ser un hadrón estable (Neutrón: udd), el vacío INYECTA un 'd'.
            // El 'anti_d' se va con el 'u' extraído formando un pion+ (u + anti_d).
            newPionGroupType = "π⁺";
            pionMovingQuark = grabbedU; 
            vacancyQuarkType = "d";       
            vacancyAntiQuarkType = "anti_d"; 
          } else if (g.name === "Neutrón") {
            // Un Neutrón (udd) pierde un 'd' (pionMovingQuark) y se queda con (ud).
            // Para volver a ser un hadrón estable (Protón: uud), el vacío INYECTA un 'u'.
            // El 'anti_u' se va con el 'd' extraído formando un pion- (d + anti_u).
            newPionGroupType = "π⁻";
            pionMovingQuark = grabbedD; 
            vacancyQuarkType = "u";       
            vacancyAntiQuarkType = "anti_u"; 
          }

          console.log(`[Hadronización Blindada] Ruptura de ${g.name}. Transmutando...`);

          // 1. Eliminar pión idéntico previo si existe en escena para evitar saturación
          const existingDuplicate = groups.find(group => group.name === newPionGroupType);
          if (existingDuplicate && existingDuplicate.pionController) {
            existingDuplicate.pionController.executeDecay(particles, groups, audioManager);
          }

          // 2. Crear las partículas virtuales del vacío exactamente en sus posiciones físicas
          const spawnX = pionMovingQuark.x;
          const spawnY = pionMovingQuark.y;
          
          const vQuark = new Particle({ type: vacancyQuarkType, x: remainingQuark.x, y: remainingQuark.y });
          const vAntiQuark = new Particle({ type: vacancyAntiQuarkType, x: spawnX + 5, y: spawnY + 5 });
          
          // Las añadimos al motor físico global
          particles.push(vQuark, vAntiQuark);

          // 3. ¡BLINDAJE DE ASIGNACIÓN DIRECTA EN EL HADRÓN ENTRADA!
          // Forzamos manualmente los 3 miembros correctos del nuevo hadrón transmutado.
          // Al asignarlos directamente aquí, evitamos por completo que la función de fusión por proximidad
          // cometa errores o meta un quark equivocado debido a una colisión.
          const remainingHandQuark = (pionMovingQuark === grabbedU) ? grabbedD : grabbedU;
          remainingHandQuark.grabbed = false; // Soltamos el quark que se queda en el núcleo
          
          // Reconfiguramos los miembros del grupo original de forma estricta e instantánea
          g.members = [remainingQuark, remainingHandQuark, vQuark];
          g.updateConstituents(); // Fuerza a redefinir el nombre de Protón <-> Neutrón inmediatamente

          // Estabilizamos el núcleo recolocando brevemente sus componentes para que no salgan disparados por físicas
          const center = g.center;
          for (const member of g.members) {
            member.x = center.x + (Math.random() - 0.5) * 5;
            member.y = center.y + (Math.random() - 0.5) * 5;
            member.vx = 0;
            member.vy = 0;
          }

          // 4. ¡BLINDAJE DE ASIGNACIÓN DIRECTA EN EL PIÓN SALIENTE!
          // Creamos el pión vinculando directamente el quark arrastrado por el usuario y su antiquark correspondiente
          const pionGroup = new NuclearGroup([pionMovingQuark, vAntiQuark]);
          pionGroup.pionController = new PionDecay(pionGroup);
          pionGroup.updateConstituents(); // Fuerza el nombre de π⁺ o π⁻
          
          groups.push(pionGroup);

          if (audioManager) audioManager.playBondSound();
          break; // Salimos del bucle para procesar un solo estiramiento por frame de forma segura
        }
      }
    }
  }
}

function handleDynamicNuclearFusion() {
  const FUSION_DIST = 50; 
  const freeQuarks = particles.filter(p => (p.type === 'u' || p.type === 'd' || p.type === 'anti_u' || p.type === 'anti_d') && !p.group);

  for (let i = 0; i < freeQuarks.length; i++) {
    for (let j = i + 1; j < freeQuarks.length; j++) {
      const q1 = freeQuarks[i];
      const q2 = freeQuarks[j];

      if (q1.group || q2.group) continue;

      const dist = Math.hypot(q1.x - q2.x, q1.y - q2.y);
      if (dist < FUSION_DIST) {
        const q3 = freeQuarks.find(q3 => q3 !== q1 && q3 !== q2 && !q3.group && Math.hypot(q3.x - q1.x, q3.y - q1.y) < FUSION_DIST * 1.5);

        if (q3) {
          // No podrá haber grupos formados sólo por el mismo tipo de partículas (ej. uuu, ddd)
          if (q1.type === q2.type && q2.type === q3.type) continue;
          
          const newGroup = new NuclearGroup([q1, q2, q3]);
          groups.push(newGroup);
          console.log(`[Fusión] Nuevo hadrón detectado: ${newGroup.name}`);
        } else {
          // No podrá haber grupos formados sólo por el mismo tipo de partículas (ej. uu, dd)
          if (q1.type === q2.type) continue;

          const newGroup = new NuclearGroup([q1, q2]);
          newGroup.pionController = new PionDecay(newGroup); 
          groups.push(newGroup);
          console.log(`[Fusión] Nuevo mesón detectado: ${newGroup.name}`);
        }
      }
    }
  }
}


function handleElectronPositronAnnihilation() {
  // Ajustamos el colapso al radio físico donde impactan (colisión real)
  const COLLAPSE_DIST = 2800;      
  // Velocidad constante solicitada para los fotones resultantes
  const PHOTON_SPEED = 550;      

  // Filtrar electrones libres y positrones
  const electrons = particles.filter(p => p.type === 'e' && !p.hydrogenGroup && !p.group);
  const positrons = particles.filter(p => p.type === 'positron');

  for (const e of electrons) {
    for (const pos of positrons) {
      const dx = pos.x - e.x;
      const dy = pos.y - e.y;
      const dist = Math.hypot(dx, dy);

      // 1. ÁREA DE ATRACCIÓN (Cualquier distancia mayor al punto de colisión)
      if (dist > COLLAPSE_DIST) {
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Fuerza con la inversa de la distancia partiendo de una base de 400
        // Usamos un multiplicador adecuado (ej: 3500) para que la fuerza 
        // empiece sintiéndose suave a lo lejos y se incremente bruscamente al acercarse.
        const baseForce = 700;
        const inverseBoost = 3500 / (dist || 1); 
        const force = (baseForce + inverseBoost) * DT;

        // Aplicamos la atracción modificando los vectores de velocidad de las partículas
        if (!e.grabbed) { 
          e.vx += nx * force; 
          e.vy += ny * force; 
        }
        if (!pos.grabbed) { 
          pos.vx -= nx * force; 
          pos.vy -= ny * force; 
        }
      }

      // 2. PUNTO DE ANIQUILACIÓN (Cuando colisionan físicamente en la pantalla)
      if (dist <= COLLAPSE_DIST) {
        console.log("[Física] Aniquilación e⁻ + e⁺ ──> 2γ (Colisión Real)");

        const spawnX = (e.x + pos.x) / 2;
        const spawnY = (e.y + pos.y) / 2;

        e.grabbed = false;
        pos.grabbed = false;

        // Eliminamos las dos partículas del motor de físicas global
        const indexE = particles.indexOf(e);
        if (indexE !== -1) particles.splice(indexE, 1);
        
        const indexPos = particles.indexOf(pos);
        if (indexPos !== -1) particles.splice(indexPos, 1);

        // Añadimos el flash visual del estallido
        flashEffects.push({ x: spawnX, y: spawnY, radius: 10, maxRadius: 60, alpha: 1.0 });

        // Calculamos un ángulo aleatorio para la trayectoria de expulsión
        const angle = Math.random() * Math.PI * 2;

        // Fotón 1 (Aceleración hacia un extremo)
        const gamma1 = new Particle({ type: 'photon', x: spawnX, y: spawnY });
        gamma1.vx = Math.cos(angle) * PHOTON_SPEED;
        gamma1.vy = Math.sin(angle) * PHOTON_SPEED;

        // Fotón 2 (En la dirección exactamente opuesta: angle + PI)
        const gamma2 = new Particle({ type: 'photon', x: spawnX, y: spawnY });
        gamma2.vx = Math.cos(angle + Math.PI) * PHOTON_SPEED;
        gamma2.vy = Math.sin(angle + Math.PI) * PHOTON_SPEED;

        particles.push(gamma1, gamma2);

        if (audioManager) audioManager.playBondSound();
        return; // Detenemos la ejecución del frame para evitar desajustes de índices tras el borrado
      }
    }
  }
}


// ─────────────────────────────────────────────────────────
// CONTROL DE LÍMITE DE LEPTONES (MÁXIMO 2 IGUALES)
// ─────────────────────────────────────────────────────────
function enforceLeptonLimits() {
  // Definimos los tipos que queremos vigilar de forma estricta
  const tiposRestringidos = ['muon', 'antimuon', 'nu_mu', 'anti_nu_mu', 'nu_e', 'anti_nu_e'];

  tiposRestringidos.forEach(tipo => {
    // Buscamos todas las partículas en escena de este tipo específico
    const encontradas = [];
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].type === tipo) {
        encontradas.push(i); // Guardamos su índice
      }
    }

    // AHORA ADMITIMOS HASTA 2: Si hay más de dos (3 o más),
    // conservamos las dos últimas creadas (las más nuevas al final del array)
    // y eliminamos las anteriores (las más viejas).
    if (encontradas.length > 2) {
      console.log(`[Límite Cuántico] Más de 2 partículas de tipo ${tipo} detectadas. Destruyendo la más antigua.`);
      
      // Eliminamos desde la antepenúltima encontrada hacia atrás (longitud - 3)
      // para asegurar que las dos últimas (longitud - 1 y longitud - 2) se quedan vivas.
      for (let k = encontradas.length - 3; k >= 0; k--) {
        const indexAEliminar = encontradas[k];
        particles.splice(indexAEliminar, 1);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────
// CONTROL DE REDIMENSIONAMIENTO Y ROTACIÓN DINÁMICA
// ─────────────────────────────────────────────────────────
function resizeCanvas() {
  const canvasElement = document.getElementById('particle-canvas');
  if (!canvasElement) return;

  // Ajustamos los píxeles internos del lienzo al tamaño real que ocupa en la pantalla
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;

  console.log(`[Pantalla] Sistema cuántico adaptado a: ${canvasElement.width}x${canvasElement.height}`);
}

// Escuchamos el cambio de tamaño del navegador y giros de pantalla
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
  // Aplicamos un pequeño retraso de 200ms para asegurar que el navegador móvil 
  // termine de reajustar las barras de navegación antes de medir el espacio real.
  setTimeout(resizeCanvas, 200);
});

// Forzamos una primera ejecución al cargar el script
resizeCanvas();

// ─────────────────────────────────────────────────────────
// ARRANQUE DE LA CÁMARA Y LA SIMULACIÓN
// ─────────────────────────────────────────────────────────
initCamera(video, onHandResults)
  .then(() => {
    console.log("Laboratorio cuántico e interacciones moleculares inicializadas.");
    requestAnimationFrame(gameLoop);
  })
  .catch(err => {
    if (hudStatus) hudStatus.innerText = "Error al conectar la cámara.";
    console.error(err);
  });