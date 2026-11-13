import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { DiceArt, tileArt } from './arte.js?v=arcade-1';
import { projectBoard } from './unicos.js?v=arcade-1';

export const HAND = 32;
export const POWER = 48;
export const ROLL_TIME = 850;
const spacing = 1.365;
const xAxis = new THREE.Vector3(1, 0, 0);
const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const rollAxis = new THREE.Vector3(1, .57, .66).normalize();
const angle = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const twinSize = .55;
const twinGap = .52;
const orientations = [null, new THREE.Quaternion(), new THREE.Quaternion().setFromAxisAngle(xAxis, -Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(zAxis, Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(zAxis, -Math.PI / 2),
  new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI)];

function mesh(geometry, material, x, y, z, shadow = true) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = shadow;
  result.receiveShadow = true;
  return result;
}

function appearance(spec, die) {
  if (!die.numberChanged && die.tint == null && !die.echo && !die.sealed) return spec;
  const faces = [...spec.faces];
  faces[die.face] = die.value;
  return { ...spec, faces, numberChanged: die.numberChanged, tint: die.tint, echo: die.echo, sealed: die.sealed };
}

const appearanceKey = die => [die.value, die.stone, die.numberChanged, die.tint, die.echo, die.sealed].join('/');
const rotationFor = die => new THREE.Quaternion().setFromAxisAngle(yAxis, angle((die.slot - 1.5) * 5)).multiply(orientations[die.face + 1]);

export class Table {
  constructor(canvas, labels, art = new DiceArt()) {
    this.canvas = canvas;
    this.labels = labels;
    this.art = art;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1533);
    this.camera = new THREE.PerspectiveCamera(35, 1, .1, 50);
    this.ray = new THREE.Raycaster();
    this.rayPoint = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(yAxis, -1.16);
    this.board = new THREE.Group();
    this.effects = new THREE.Group();
    this.powerShelf = new THREE.Group();
    this.powerMeshes = [];
    this.highlight = new THREE.Group();
    this.lit = new Set();
    this.models = new Map();
    this.extras = new Map();
    this.tray = [];
    this.cells = [];
    this.tags = [];
    this.rows = 2;
    this.cols = 3;
    this.boardSets = new Map();
    this.selected = -1;
    this.focused = -1;
    this.dirty = true;
    this.scene.add(this.board, this.effects, this.powerShelf, this.highlight);
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

    const hemisphere = new THREE.HemisphereLight(0xf6e6cf, 0x657f9f, 1.72);
    const lamp = new THREE.DirectionalLight(0xffead4, 2.35);
    lamp.position.set(-3, 8, 3.4);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    Object.assign(lamp.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 22 });
    lamp.shadow.bias = -.00035;
    lamp.shadow.normalBias = .022;
    const fill = new THREE.DirectionalLight(0x9bbdeb, .66);
    fill.position.set(4, 4, -4);
    this.scene.add(hemisphere, lamp, fill);
    const floor = mesh(new THREE.PlaneGeometry(40, 40), material(0x142132), 0, -.93, 0, false);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.scene.add(mesh(new RoundedBoxGeometry(10.6, .43, 9.75, 2, .12), this.wood, 0, -.67, -.09));
    const tablecloth = new THREE.MeshStandardMaterial({ map: mat, roughness: .81 });
    this.scene.add(mesh(new RoundedBoxGeometry(9.81, .08, 9.04, 1, .03),
      [this.cobalt, this.cobalt, tablecloth, this.cobalt, this.cobalt, this.cobalt], 0, -.41, -.09, false));

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
      const ornament = mesh(new RoundedBoxGeometry(.61, .12, .61, 2, .05), this.tileMaterials, side * 3.79, -.307, -1.64);
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
    this.configure(2, 3);
  }

  cell(index) {
    return new THREE.Vector3((index % this.cols - (this.cols - 1) / 2) * spacing, .349,
      1.055 + (Math.floor(index / this.cols) + 1 - this.rows) * spacing);
  }

  slot(index) { return new THREE.Vector3((index - 1.5) * 1.105, .052, 2.83); }

  destination(id) {
    const at = id >= HAND ? this.slot(id - HAND) : this.cell(id);
    at.y += .43;
    return at;
  }

  configure(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.board.clear();
    const size = `${rows}x${cols}`;
    let set = this.boardSets.get(size);
    if (!set) {
      const center = 1.055 - (rows - 1) * spacing / 2;
      const width = (cols - 3) * spacing;
      const depth = (rows - 3) * spacing;
      const group = new THREE.Group();
      group.add(mesh(new RoundedBoxGeometry(4.64 + width, .15, 4.64 + depth, 2, .065), this.wood, 0, -.31, center));
      group.add(mesh(new RoundedBoxGeometry(4.70 + width, .36, 4.70 + depth, 2, .15), this.cobalt, 0, -.105, center));
      group.add(mesh(new RoundedBoxGeometry(4.58 + width, .077, 4.58 + depth, 1, .031), this.brass, 0, .058, center));
      group.add(mesh(new RoundedBoxGeometry(4.44 + width, .12, 4.44 + depth, 2, .05), this.slates, 0, .118, center));
      const geometry = new RoundedBoxGeometry(1.28, .175, 1.28, 2, .055);
      const cells = Array.from({ length: rows * cols }, (_, index) => {
        const at = this.cell(index);
        const tile = mesh(geometry, this.tileMaterials, at.x, .261, at.z);
        tile.userData.id = index;
        group.add(tile);
        return tile;
      });
      set = { group, cells };
      this.boardSets.set(size, set);
    }
    this.board.add(set.group);
    this.cells = set.cells;
    this.reset();
  }

  mount(powers) {
    const key = `${this.rows}/${powers.join('/')}`;
    if (key === this.mountKey) return;
    this.mountKey = key;
    for (const piece of this.powerShelf.children) {
      piece.geometry.dispose();
      if (Array.isArray(piece.material)) piece.material[2].dispose();
    }
    this.powerShelf.clear();
    this.powerMeshes = [];
    if (!powers.length) { this.dirty = true; return; }
    const z = this.cell(0).z - 1.32;
    const gap = 1.02;
    this.powerShelf.add(mesh(new RoundedBoxGeometry(powers.length * gap + .15, .55, 1.11, 2, .075), this.cobalt, 0, -.052, z));
    powers.forEach((id, index) => {
      const surface = new THREE.MeshStandardMaterial({ map: tileArt(id).map, roughness: .38 });
      const piece = mesh(new RoundedBoxGeometry(.93, .16, .93, 2, .055),
        [this.brass, this.brass, surface, this.brass, this.brass, this.brass], (index - (powers.length - 1) / 2) * gap, .303, z);
      piece.userData.id = POWER + index;
      this.powerMeshes.push(piece);
      this.powerShelf.add(piece);
    });
    this.dirty = true;
  }

  powerAnchor(index) {
    const piece = this.powerMeshes[index];
    return piece ? this.anchor(piece.position) : null;
  }

  dieAnchor(id) { return this.anchor(this.destination(id)); }

  anchor(position) {
    if (!this.width) return null;
    const screen = position.clone().project(this.camera);
    return { x: (screen.x + 1) / 2 * this.width, y: (1 - screen.y) / 2 * this.height };
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
    const distance = (10.35 + (this.rows - 2) * 1.47 + (this.cols - 3) * .71) * this.zoom;
    const target = new THREE.Vector3(0, -.03, 1.19 - (this.rows - 2) * .60);
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
    for (const [id, extra] of this.extras) {
      if (boardOnly && id >= HAND) continue;
      if (!extra.source || targets.includes(extra.source.mesh)) targets.push(extra.mesh);
    }
    targets.push(...this.cells);
    if (!boardOnly) targets.push(...this.tray, ...this.powerMeshes);
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

  focus(id, cell) {
    if (this.selected === id && this.focused === cell) return;
    this.selected = id;
    this.focused = cell;
    this.focusRing.visible = cell >= 0 && cell < this.cells.length;
    if (this.focusRing.visible) {
      this.focusRing.position.copy(this.cell(cell));
      this.focusRing.position.y = .366;
    }
    this.dirty = true;
  }

  lightCells(cells) {
    this.lit = new Set(cells);
    this.highlight.clear();
    for (const cell of cells) {
      const ring = this.focusRing.clone();
      ring.visible = true;
      ring.position.copy(this.cell(cell));
      ring.position.y = .385;
      this.highlight.add(ring);
    }
    this.dirty = true;
  }

  sync(state, now, { roll = false, dissolve = false } = {}) {
    const { rows, cols } = state;
    if (rows !== this.rows || cols !== this.cols) this.configure(rows, cols);
    this.mount(state.powers);
    const { board } = projectBoard(state);
    const live = new Map();
    const extraDice = new Map();
    state.board.forEach((die, id) => { if (die) live.set(die, id); });
    state.hand.forEach((die, slot) => { if (die) live.set(die, HAND + slot); });
    board.forEach((die, id) => { if (die?.echo) extraDice.set(id, { die, spec: state.bag[die.id] }); });
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
      const seen = id < HAND ? board[id] : die;
      const spec = state.bag[die.id];
      const extraValue = id >= HAND && spec.unique === 'twin' ? die.value + 1 : seen.extra;
      const paired = extraValue != null;
      const size = paired ? twinSize : 1;
      const variant = appearanceKey(seen);
      const to = this.destination(id);
      if (paired) { to.x -= twinGap / 2; to.y -= .43 * (1 - size); }
      const existing = this.models.get(die);
      if (existing) {
        if (existing.variant !== variant || existing.spec !== spec) {
          const next = this.art.create(appearance(spec, seen), seen.stone);
          this.art.release(existing.mesh);
          existing.mesh.material = next.material;
          existing.mesh.geometry = next.geometry;
          existing.mesh.userData.art = next.userData.art;
          existing.spec = spec;
          existing.variant = variant;
        }
        if (existing.id !== id || existing.dragged || existing.size !== size) {
          existing.from.copy(existing.mesh.position);
          existing.to.copy(to);
          existing.size = size;
          existing.mesh.scale.setScalar(size);
          existing.id = existing.mesh.userData.id = id;
          existing.start = now;
          existing.duration = 260;
          existing.rolling = existing.dragged = false;
        }
      } else {
        const model = this.art.create(appearance(spec, seen), seen.stone);
        model.position.copy(to);
        model.scale.setScalar(size);
        model.userData.id = id;
        const rotation = rotationFor(die);
        model.quaternion.copy(rotation);
        const rolling = id >= HAND && (roll === true || roll instanceof Set && roll.has(die.id));
        const piece = { mesh: model, id, spec, variant, size, to, from: to.clone(), rotation,
          rolling, start: now + die.slot * 54, duration: rolling ? 680 : 0 };
        this.models.set(die, piece);
        this.scene.add(model);
      }
      if (paired) extraDice.set(id, { die: { ...seen, value: extraValue, numberChanged: true }, spec, source: this.models.get(die) });
    }
    for (const [id, extra] of this.extras) if (!extraDice.has(id)) this.removeExtra(id, extra);
    for (const [id, { die, spec, source }] of extraDice) {
      const existing = this.extras.get(id);
      const variant = appearanceKey(die);
      if (existing && existing.variant === variant && existing.spec === spec && existing.source === source) continue;
      if (existing) this.removeExtra(id, existing);
      const model = this.art.create(appearance(spec, die), die.stone);
      model.userData.id = id;
      model.position.copy(this.destination(id));
      model.scale.setScalar(source ? twinSize : .77);
      model.quaternion.copy(rotationFor(die));
      this.extras.set(id, { mesh: model, variant, spec, source });
      this.scene.add(model);
    }
    this.dirty = true;
  }

  remove(die, piece) { this.scene.remove(piece.mesh); this.art.release(piece.mesh); this.models.delete(die); }

  removeExtra(id, piece) { this.scene.remove(piece.mesh); this.art.release(piece.mesh); this.extras.delete(id); }

  clear() {
    for (const [die, piece] of this.models) this.remove(die, piece);
    for (const [id, piece] of this.extras) this.removeExtra(id, piece);
    this.marks([]);
    this.lightCells([]);
    this.dirty = true;
  }

  marks(matches, powers = []) {
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
      const points = match.points ? `+${match.points}` : '';
      const bonus = match.add ? `+${(match.add / 100).toLocaleString('es-ES')}×` : '';
      tag.textContent = `${match.name} ${[points, bonus].filter(Boolean).join(' · ')}`;
      this.labels.append(tag);
      first.y = .63;
      if (match.column) first.z -= .79;
      else first.x -= .77;
      this.tags.push({ tag, anchor: first, column: match.column });
    }
    for (const power of powers) {
      const tag = document.createElement('span');
      tag.className = 'match unique-mark';
      tag.textContent = `${power.name} · +${(power.points ?? power.add / 100).toLocaleString('es-ES')}${power.add ? '×' : ''}`;
      const anchor = this.cell(power.cells[0]);
      anchor.y = 1.31;
      this.labels.append(tag);
      this.tags.push({ tag, anchor, column: true });
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
        piece.mesh.scale.setScalar(piece.size * (1 - t));
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
        if (piece.id === this.selected) at.y += .16;
        piece.mesh.scale.setScalar(piece.size * (this.lit.has(piece.id) ? 1.095 : 1));
      }
      if (t < 1 || !at.equals(old)) moving = true;
      old.copy(at);
    }
    for (const [id, piece] of this.extras) {
      if (piece.source) {
        const base = piece.source.mesh;
        piece.mesh.position.copy(base.position);
        piece.mesh.position.x += twinGap;
        piece.mesh.quaternion.copy(base.quaternion);
        piece.mesh.scale.copy(base.scale);
      } else piece.mesh.scale.setScalar(this.lit.has(id) ? .84 : .77);
    }
    if (moving || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.positionTags();
      this.dirty = false;
    }
  }
}
