import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { glazes, stages } from './reglas.js';

export const HAND = 10;
export const ROLL_TIME = 850;
const spacing = 1.365;
const gray = { color: '#65737c', light: '#a7adb1' };
const positions = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const xAxis = new THREE.Vector3(1, 0, 0);
const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const rollAxis = new THREE.Vector3(1, .57, .66).normalize();
const angle = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const orientations = [null, new THREE.Quaternion(), new THREE.Quaternion().setFromAxisAngle(xAxis, -Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(zAxis, Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(zAxis, -Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI)];

function faceTexture(glaze, value, stone) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const enamel = stone ? gray : glazes[glaze];
  const wash = ctx.createLinearGradient(13, 12, 114, 121);
  wash.addColorStop(0, enamel.light);
  wash.addColorStop(.62, enamel.color);
  wash.addColorStop(1, enamel.color);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = stone ? '#c2c3bfaa' : '#f6e7c7b9';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(11, 11, 106, 106, 11);
  ctx.stroke();
  for (const x of [23, 105]) for (const y of [23, 105]) {
    ctx.beginPath();
    ctx.arc(x, y, 6.2, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, 2 * Math.PI);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }
  for (const pip of positions[value]) {
    const x = 37 + pip % 3 * 27;
    const y = 37 + Math.floor(pip / 3) * 27;
    ctx.beginPath();
    ctx.arc(x, y + 1.3, 7.9, 0, 2 * Math.PI);
    ctx.fillStyle = '#18273290';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = stone ? '#24323b' : '#fff0d1';
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function mesh(geometry, material, x, y, z, shadow = true) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = shadow;
  result.receiveShadow = true;
  return result;
}

export class Table {
  constructor(canvas, labels) {
    this.canvas = canvas;
    this.labels = labels;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111a28);
    this.camera = new THREE.PerspectiveCamera(35, 1, .1, 50);
    this.ray = new THREE.Raycaster();
    this.rayPoint = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(yAxis, -1.16);
    this.board = new THREE.Group();
    this.effects = new THREE.Group();
    this.models = new Map();
    this.tray = [];
    this.cells = [];
    this.tags = [];
    this.rows = 2;
    this.boardSets = new Map();
    this.selected = -1;
    this.focused = -1;
    this.dirty = true;
    this.scene.add(this.board, this.effects);
    this.reset();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }

  async load() {
    const loader = new THREE.TextureLoader();
    const [mat, tile] = await Promise.all([loader.loadAsync('./mesa.jpg'), loader.loadAsync('./azulejo.jpg')]);
    for (const texture of [mat, tile]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    }

    const material = (color, roughness = .69, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    this.wood = material(0x462c22);
    this.cobalt = material(0x163653, .49);
    this.slates = material(0x243848);
    this.brass = material(0xa36d36, .39, .36);
    this.clay = material(0xa38264);
    this.gold = new THREE.MeshBasicMaterial({ color: 0xffcb69, toneMapped: false });
    this.aqua = new THREE.MeshBasicMaterial({ color: 0x6aebdc, toneMapped: false });
    this.porcelain = new THREE.MeshStandardMaterial({ map: tile, roughness: .59 });
    this.tileMaterials = [this.clay, this.clay, this.porcelain, this.clay, this.clay, this.clay];
    this.dieShape = new RoundedBoxGeometry(.86, .86, .86, 3, .105);
    this.dieMaterials = [...glazes, gray].map((_, glaze) => [3, 4, 1, 6, 2, 5].map(value =>
      new THREE.MeshPhysicalMaterial({ map: faceTexture(glaze, value, glaze === 4), roughness: glaze === 4 ? .65 : .32,
        clearcoat: glaze === 4 ? 0 : .26, clearcoatRoughness: .36 })));

    const hemisphere = new THREE.HemisphereLight(0xf6e6cf, 0x657f9f, 1.72);
    const lamp = new THREE.DirectionalLight(0xffead4, 2.35);
    lamp.position.set(-3, 8, 3.4);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    Object.assign(lamp.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .5, far: 20 });
    lamp.shadow.bias = -.00035;
    lamp.shadow.normalBias = .022;
    const fill = new THREE.DirectionalLight(0x9bbdeb, .66);
    fill.position.set(4, 4, -4);
    this.scene.add(hemisphere, lamp, fill);
    const floor = mesh(new THREE.PlaneGeometry(40, 40), material(0x142132), 0, -.93, 0, false);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.scene.add(mesh(new RoundedBoxGeometry(9.5, .43, 8.48, 2, .12), this.wood, 0, -.67, .46));
    const tablecloth = new THREE.MeshStandardMaterial({ map: mat, roughness: .81 });
    this.scene.add(mesh(new RoundedBoxGeometry(8.73, .08, 7.77, 1, .03),
      [this.cobalt, this.cobalt, tablecloth, this.cobalt, this.cobalt, this.cobalt], 0, -.41, .46, false));

    this.scene.add(mesh(new RoundedBoxGeometry(4.84, .24, 1.27, 2, .105), this.cobalt, 0, -.22, 2.83));
    this.scene.add(mesh(new RoundedBoxGeometry(4.68, .073, 1.13, 1, .035), this.brass, 0, -.083, 2.83));
    this.scene.add(mesh(new RoundedBoxGeometry(4.56, .086, 1.025, 1, .036), this.slates, 0, -.044, 2.83));
    const socketGeometry = new RoundedBoxGeometry(.99, .102, .91, 2, .045);
    for (let slot = 0; slot < 4; slot++) {
      const location = this.slot(slot);
      const socket = mesh(socketGeometry, this.slates, location.x, -.002, location.z, false);
      socket.userData.id = HAND + slot;
      this.tray.push(socket);
      this.scene.add(socket);
    }
    for (const side of [-1, 1]) {
      const ornament = mesh(new RoundedBoxGeometry(.61, .12, .61, 2, .05), this.tileMaterials, side * 3.16, -.307, -1.64);
      ornament.rotation.y = angle(side * 21);
      this.scene.add(ornament);
    }

    this.focusRing = new THREE.Group();
    for (const side of [-1, 1]) {
      this.focusRing.add(mesh(new THREE.BoxGeometry(1.17, .017, .036), this.gold, 0, 0, side * .575, false));
      this.focusRing.add(mesh(new THREE.BoxGeometry(.036, .017, 1.17), this.gold, side * .575, 0, 0, false));
    }
    this.focusRing.visible = false;
    this.scene.add(this.focusRing);
    this.configure(2);
  }

  cell(index) {
    return new THREE.Vector3((index % 3 - 1) * spacing, .349, -.31 + (Math.floor(index / 3) + 2 - this.rows) * spacing);
  }

  slot(index) { return new THREE.Vector3((index - 1.5) * 1.105, .052, 2.83); }

  destination(id) {
    const at = id >= HAND ? this.slot(id - HAND) : this.cell(id);
    at.y += .43;
    return at;
  }

  configure(rows) {
    this.rows = rows;
    this.board.clear();
    let set = this.boardSets.get(rows);
    if (!set) {
      const center = -.31 + (3 - rows) * spacing / 2;
      const reduction = (3 - rows) * spacing;
      const group = new THREE.Group();
      group.add(mesh(new RoundedBoxGeometry(4.64, .15, 4.64 - reduction, 2, .065), this.wood, 0, -.31, center));
      group.add(mesh(new RoundedBoxGeometry(4.70, .36, 4.70 - reduction, 2, .15), this.cobalt, 0, -.105, center));
      group.add(mesh(new RoundedBoxGeometry(4.58, .077, 4.58 - reduction, 1, .031), this.brass, 0, .058, center));
      group.add(mesh(new RoundedBoxGeometry(4.44, .12, 4.44 - reduction, 2, .05), this.slates, 0, .118, center));
      const geometry = new RoundedBoxGeometry(1.28, .175, 1.28, 2, .055);
      const cells = Array.from({ length: rows * 3 }, (_, index) => {
        const at = this.cell(index);
        const tile = mesh(geometry, this.tileMaterials, at.x, .261, at.z);
        tile.userData.id = index;
        group.add(tile);
        return tile;
      });
      set = { group, cells };
      this.boardSets.set(rows, set);
    }
    this.board.add(set.group);
    this.cells = set.cells;
    this.reset();
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return;
    if (width !== this.width || height !== this.height) this.renderer.setSize(width, height, false);
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.fov = Math.max(33, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(angle(22)) / this.camera.aspect)));
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  reset() {
    this.azimuth = this.canvas.clientWidth < 580 ? 9 : 16;
    this.elevation = this.canvas.clientWidth < 580 ? 65 : 59;
    this.zoom = 1;
    this.updateCamera();
  }

  top() { this.azimuth = 0; this.elevation = 87; this.zoom = 1; this.updateCamera(); }

  orbit(dx, dy) {
    this.azimuth = clamp(this.azimuth - dx * .29, -61, 61);
    this.elevation = clamp(this.elevation + dy * .23, 38, 87);
    this.updateCamera();
  }

  zoomBy(factor) { this.zoom = clamp(this.zoom * factor, .83, 1.42); this.updateCamera(); }

  updateCamera() {
    const pitch = angle(this.elevation);
    const yaw = angle(this.azimuth);
    const distance = (this.rows === 2 ? 10.35 : 11.45) * this.zoom;
    const target = new THREE.Vector3(0, -.03, this.rows === 2 ? 1.19 : .63);
    this.camera.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance,
      Math.cos(yaw) * Math.cos(pitch) * distance).add(target);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    this.dirty = true;
  }

  cast(clientX, clientY) {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return false;
    this.rayPoint.set((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2);
    this.ray.setFromCamera(this.rayPoint, this.camera);
    return Math.abs(this.rayPoint.x) <= 1 && Math.abs(this.rayPoint.y) <= 1;
  }

  pick(x, y, boardOnly = false) {
    if (!this.cast(x, y)) return -1;
    this.scene.updateMatrixWorld();
    const now = performance.now();
    const targets = [...this.models.values()].filter(piece => !piece.dragged && !piece.removing &&
      now >= piece.start + piece.duration && (!boardOnly || piece.id < HAND)).map(piece => piece.mesh);
    targets.push(...this.cells);
    if (!boardOnly) targets.push(...this.tray);
    const hit = this.ray.intersectObjects(targets, false)[0];
    return hit?.object.userData.id ?? -1;
  }

  drag(die, x, y) {
    const piece = this.models.get(die);
    if (!piece) return;
    this.cast(x, y);
    const at = this.ray.ray.intersectPlane(this.dragPlane, new THREE.Vector3());
    if (!at) return;
    piece.dragged = true;
    piece.mesh.position.copy(at);
    this.dirty = true;
  }

  focus(slot, cell, chisel = false) {
    if (this.selected === slot && this.focused === cell && this.chiseling === chisel) return;
    this.selected = slot;
    this.focused = cell;
    this.chiseling = chisel;
    this.focusRing.visible = cell >= 0 && cell < this.cells.length;
    if (this.focusRing.visible) {
      this.focusRing.position.copy(this.cell(cell));
      this.focusRing.position.y = .366;
    }
    this.dirty = true;
  }

  sync(state, now, { roll = false, dissolve = false } = {}) {
    const rows = stages[state.stage].rows;
    if (rows !== this.rows) this.configure(rows);
    const live = new Map();
    state.board.forEach((die, id) => { if (die) live.set(die, id); });
    state.hand.forEach((die, slot) => { if (die) live.set(die, HAND + slot); });
    for (const [die, piece] of this.models) {
      if (live.has(die) || piece.removing) continue;
      if (dissolve && piece.id < HAND) {
        piece.from.copy(piece.mesh.position);
        piece.start = now;
        piece.duration = 360;
        piece.removing = true;
        piece.dragged = false;
      } else this.remove(die, piece);
    }
    for (const [die, id] of live) {
      const existing = this.models.get(die);
      if (existing) {
        if (existing.stone !== die.stone) {
          existing.mesh.material = this.dieMaterials[die.stone ? 4 : die.glaze];
          existing.stone = die.stone;
        }
        if (existing.id !== id || existing.dragged) {
          existing.from.copy(existing.mesh.position);
          existing.to.copy(this.destination(id));
          existing.id = existing.mesh.userData.id = id;
          existing.start = now;
          existing.duration = 260;
          existing.rolling = existing.dragged = false;
        }
        continue;
      }
      const to = this.destination(id);
      const model = mesh(this.dieShape, this.dieMaterials[die.stone ? 4 : die.glaze], to.x, to.y, to.z);
      model.userData.id = id;
      const rotation = new THREE.Quaternion().setFromAxisAngle(yAxis, angle((die.slot - 1.5) * 5)).multiply(orientations[die.value]);
      model.quaternion.copy(rotation);
      const rolling = roll && id >= HAND;
      const piece = { mesh: model, id, stone: die.stone, to, from: to.clone(), rotation,
        rolling, start: now + die.slot * 54, duration: rolling ? 680 : 0 };
      this.models.set(die, piece);
      this.scene.add(model);
    }
    this.dirty = true;
  }

  remove(die, piece) { this.scene.remove(piece.mesh); this.models.delete(die); }

  clear() {
    for (const [die, piece] of this.models) this.remove(die, piece);
    this.marks([]);
    this.dirty = true;
  }

  marks(matches) {
    for (const object of this.effects.children) object.geometry.dispose();
    this.effects.clear();
    this.labels.replaceChildren();
    this.tags = [];
    for (const match of matches) {
      const first = this.cell(match.cells[0]);
      const last = this.cell(match.cells[match.cells.length - 1]);
      const length = first.distanceTo(last) + 1.29;
      const center = first.clone().lerp(last, .5);
      for (const side of [-1, 1]) {
        this.effects.add(mesh(new THREE.BoxGeometry(match.column ? .055 : length, .013, match.column ? length : .055),
          match.column ? this.aqua : this.gold, center.x + (match.column ? side * .629 : 0),
          match.column ? .365 : .374, center.z + (match.column ? 0 : side * .629), false));
      }
      const tag = document.createElement('span');
      tag.className = `match${match.column ? ' column' : ''}`;
      tag.textContent = `${match.name} +${match.points}`;
      this.labels.append(tag);
      first.y = .63;
      if (match.column) first.z -= .79;
      else first.x -= .77;
      this.tags.push({ tag, anchor: first, column: match.column });
    }
    this.dirty = true;
  }

  positionTags() {
    const reserved = [];
    for (const { tag, anchor, column } of this.tags) {
      const screen = anchor.clone().project(this.camera);
      const width = tag.offsetWidth;
      const height = tag.offsetHeight;
      const x = clamp((screen.x + 1) / 2 * this.width - width * (column ? .5 : 1), 4, this.width - width - 4);
      let y = clamp((1 - screen.y) / 2 * this.height - (column ? height + 3 : height / 2), 4, this.height - height - 4);
      while (reserved.some(other => x < other.x + other.width && x + width > other.x && y < other.y + other.height && y + height > other.y)
          && y + height * 2 + 8 < this.height) y += height + 4;
      reserved.push({ x, y, width, height });
      tag.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    }
  }

  frame(now) {
    if (!this.canvas.clientWidth || !this.canvas.clientHeight) return;
    let moving = false;
    for (const [die, piece] of this.models) {
      if (piece.dragged) continue;
      const t = piece.duration ? clamp((now - piece.start) / piece.duration, 0, 1) : 1;
      if (piece.removing && t >= 1) { this.remove(die, piece); this.dirty = true; continue; }
      const old = piece.mesh.position;
      const at = piece.to.clone();
      if (piece.removing) {
        at.copy(piece.from);
        at.y += t * .8;
        piece.mesh.scale.setScalar(1 - t);
        piece.mesh.quaternion.setFromAxisAngle(rollAxis, t * 2.4).multiply(piece.rotation);
      } else if (piece.rolling && t < 1) {
        at.x += (1 - t) * (die.slot - 1.5) * .19;
        at.y += Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * .82 + (1 - t) * .21;
        at.z += (1 - t) * .47;
        piece.mesh.quaternion.setFromAxisAngle(rollAxis, Math.pow(1 - t, 1.3) * (11.1 + die.slot)).multiply(piece.rotation);
      } else if (t < 1) {
        at.lerpVectors(piece.from, piece.to, 1 - Math.pow(1 - t, 3));
        at.y += Math.sin(t * Math.PI) * .28;
      } else {
        piece.mesh.quaternion.copy(piece.rotation);
        if (piece.id === HAND + this.selected) at.y += .16;
      }
      if (t < 1 || !at.equals(old)) moving = true;
      old.copy(at);
    }
    if (moving || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.positionTags();
      this.dirty = false;
    }
  }
}
