import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { rarities } from './catalogo.js?v=ceramica-1';

export class Workshop {
  constructor(art, tileMap) {
    this.art = art;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Taller de cerámica en tres dimensiones');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1a12);
    this.camera = new THREE.OrthographicCamera(-3.45, 3.45, 2, -2, .1, 25);
    this.camera.position.set(0, 5, 8);
    this.camera.lookAt(0, .21, .25);
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.86);
    this.platforms = new THREE.Group();
    this.models = new Map();
    this.exhibits = new Map();
    this.sockets = [];
    this.scene.add(this.platforms, new THREE.HemisphereLight(0xf6e6cf, 0x627fa6, 1.7));
    const lamp = new THREE.DirectionalLight(0xffe3bf, 2.5);
    lamp.position.set(-3, 6, 5);
    this.sparkLight = new THREE.PointLight(0xffbb63, 0, 8);
    this.sparkLight.position.set(0, 2.1, -.2);
    this.scene.add(lamp, this.sparkLight);
    this.baseMaterial = new THREE.MeshStandardMaterial({ color: 0x213a50, roughness: .68 });
    this.clay = new THREE.MeshStandardMaterial({ color: 0x9d5136, roughness: .71 });
    this.porcelain = new THREE.MeshStandardMaterial({ map: tileMap, roughness: .5 });
    this.cream = new THREE.MeshStandardMaterial({ color: 0xe5d2ad, roughness: .42 });
    this.brass = new THREE.MeshStandardMaterial({ color: 0xb77e43, roughness: .41, metalness: .39 });
    this.permanentMaterials = [this.brass, this.baseMaterial, this.clay, this.porcelain, this.cream];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), this.baseMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.26;
    this.scene.add(floor);
    this.canvas.addEventListener('pointerdown', event => this.down(event));
    this.canvas.addEventListener('pointermove', event => this.move(event));
    this.canvas.addEventListener('pointerup', event => this.up(event));
    this.canvas.addEventListener('pointercancel', () => this.cancel());
    this.canvas.addEventListener('lostpointercapture', () => this.cancel());
  }

  attach(container) { container.prepend(this.canvas); }

  clear() {
    this.cancel();
    this.mode = null;
    this.celebration = null;
    this.sparkLight.intensity = 0;
    this.removeModels();
    for (const mesh of this.platforms.children) {
      mesh.geometry.dispose();
      for (const material of new Set([mesh.material].flat())) if (!this.permanentMaterials.includes(material)) material.dispose();
    }
    this.platforms.clear();
    this.exhibits.clear();
    this.sockets = [];
    this.width = this.height = 0;
    this.canvas.remove();
  }

  removeModels() {
    for (const item of this.models.values()) {
      this.scene.remove(item.mesh);
      this.art.release(item.mesh);
    }
    this.models.clear();
  }

  platform(geometry, material, x, y, z) {
    const piece = new THREE.Mesh(geometry, material);
    piece.position.set(x, y, z);
    this.platforms.add(piece);
    return piece;
  }

  model(spec, id, x, y, z) {
    const mesh = this.art.create(spec);
    mesh.position.set(x, y, z);
    mesh.userData.id = id;
    this.scene.add(mesh);
    const item = { mesh, home: mesh.position.clone(), target: mesh.position.clone() };
    this.models.set(id, item);
    return item;
  }

  gallery(specs, purchased) {
    this.clear();
    this.mode = 'gallery';
    this.camera.lookAt(0, .62, .12);
    this.counter();
    this.selected = -1;
    specs.forEach((spec, index) => {
      const x = (index - 1) * 2.16;
      const light = new THREE.MeshBasicMaterial({ color: rarities[spec.rarity].color });
      this.platform(new THREE.CylinderGeometry(.65, .73, .22, 40), this.baseMaterial, x, -.08, .15);
      this.platform(new THREE.CylinderGeometry(.51, .51, .027, 40), light, x, .042, .15);
      const beam = new THREE.MeshBasicMaterial({ color: rarities[spec.rarity].color, transparent: true,
        opacity: .12, depthWrite: false, side: THREE.DoubleSide });
      this.platform(new THREE.CylinderGeometry(.78, .46, 1.63, 30, 1, true), beam, x, .89, .15);
      if (!purchased.includes(index)) this.model(spec, index, x, .92, .15);
      this.exhibits.set(`inspect/${index}`, new THREE.Vector3(x, .84, .15));
    });
  }

  counter() {
    this.platform(new RoundedBoxGeometry(6.58, .3, 4.46, 2, .095), this.clay, 0, -.23, .2);
    this.platform(new RoundedBoxGeometry(6.46, .14, 4.35, 2, .06), this.baseMaterial, 0, -.079, .2);
    for (let column = -4; column <= 4; column++) {
      const ceramic = [this.cream, this.cream, this.porcelain, this.cream, this.cream, this.cream];
      for (const z of [-1.65, 1.92]) this.platform(new RoundedBoxGeometry(.65, .04, .55, 1, .018), ceramic, column * .69, .003, z);
    }
  }

  recipes(keys, used) {
    this.clear();
    this.mode = 'oven';
    this.camera.lookAt(0, .54, .18);
    this.counter();
    this.platform(new RoundedBoxGeometry(6.3, .16, 1.05, 2, .055), this.clay, 0, .08, -.78);
    this.platform(new RoundedBoxGeometry(5.81, 1.22, .18, 2, .045), this.baseMaterial, 0, .67, -1.15);
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
      this.platform(new RoundedBoxGeometry(.65, .28, .73, 2, .04), this.clay, side * 2.83, .28 + row * .30, -.78);
    }
    for (let index = -4; index <= 4; index++) {
      this.platform(new RoundedBoxGeometry(.68, .31, .75, 2, .045), this.clay, index * .70, 1.49, -.78);
      const heat = new THREE.MeshStandardMaterial({ color: used ? 0x3c3d40 : 0x8d3925,
        emissive: index % 2 ? 0xea5722 : 0xf2a040, emissiveIntensity: used ? 0 : .68, roughness: .86 });
      const coal = this.platform(new THREE.DodecahedronGeometry(.24, 0), heat, index * .53, .23, -.59 + (index % 2) * .12);
      coal.rotation.z = index * .23;
    }
    keys.forEach((key, index) => {
      const x = (index - .5) * 2.69;
      this.platform(new RoundedBoxGeometry(2.36, .24, 1.43, 2, .08), this.baseMaterial, x, .16, .59);
      this.platform(new RoundedBoxGeometry(2.22, .14, 1.32, 2, .055), this.cream, x, .34, .59).rotation.x = .20;
      this.exhibits.set(`effect-inspect/${key}`, new THREE.Vector3(x, .42, .59));
    });
  }

  anchors(layer) {
    for (const button of layer.children) {
      const point = this.exhibits.get(`${button.dataset.market}/${button.dataset.key}`);
      if (!point) continue;
      const screen = point.clone().project(this.camera);
      button.style.left = `${(screen.x + 1) * 50}%`;
      button.style.top = `${(1 - screen.y) * 50}%`;
    }
  }

  altar(ids, bag, count, onSelect, onDrop) {
    this.clear();
    this.mode = 'forge';
    this.camera.lookAt(0, .16, .30);
    this.counter();
    this.onSelect = onSelect;
    this.onDrop = onDrop;
    this.platform(new RoundedBoxGeometry(3.75, .25, 1.67, 2, .1), this.baseMaterial, 0, -.066, -.49);
    for (let index = 0; index < count; index++) {
      const x = (index - (count - 1) / 2) * 1.55;
      const ring = this.platform(new THREE.TorusGeometry(.48, .047, 10, 32), this.brass, x, .081, -.49);
      ring.rotation.x = -Math.PI / 2;
      const hole = this.platform(new THREE.CylinderGeometry(.45, .45, .025, 32), this.baseMaterial, x, .078, -.49);
      hole.userData.slot = index;
      this.sockets.push(hole);
    }
    this.platform(new RoundedBoxGeometry(5.1, .18, 1.09, 2, .075), this.brass, 0, -.14, 1.42);
    ids.forEach((id, index) => {
      const x = (index - (ids.length - 1) / 2) * 1.2;
      const item = this.model(bag[id], id, x, .39, 1.42);
      item.mesh.rotation.y = .28 * (index - 1.5);
    });
  }

  socketsFor(ids) {
    for (const [id, item] of this.models) {
      const index = ids.indexOf(id);
      item.target.copy(index < 0 ? item.home : this.sockets[index].position);
      if (index >= 0) item.target.y += .43;
    }
  }

  celebrate(spec, ids, now) {
    this.cancel();
    this.mode = 'result';
    for (const [id, item] of this.models) {
      if (ids.includes(id)) item.home.copy(item.mesh.position);
      else { this.scene.remove(item.mesh); this.art.release(item.mesh); this.models.delete(id); }
    }
    this.celebration = { spec, start: now, finished: false };
  }

  cast(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
  }

  down(event) {
    if (this.mode !== 'forge' || this.pointer || event.button !== 0) return;
    this.cast(event);
    const hit = this.ray.intersectObjects([...this.models.values()].map(item => item.mesh))[0];
    if (!hit) return;
    this.pointer = { pointerId: event.pointerId, id: hit.object.userData.id, x: event.clientX, y: event.clientY, moving: false };
    this.canvas.setPointerCapture(event.pointerId);
  }

  move(event) {
    if (this.pointer?.pointerId !== event.pointerId) return;
    if (!this.pointer.moving && Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y) < 6) return;
    this.pointer.moving = true;
    this.cast(event);
    const target = this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (target) this.models.get(this.pointer.id).mesh.position.copy(target);
  }

  up(event) {
    const pointer = this.pointer;
    if (pointer?.pointerId !== event.pointerId) return;
    this.cancel();
    if (!pointer.moving) { this.onSelect(pointer.id); return; }
    this.cast(event);
    const hit = this.ray.intersectObjects(this.sockets)[0];
    if (hit) this.onDrop(pointer.id, hit.object.userData.slot);
  }

  cancel() {
    const pointer = this.pointer;
    this.pointer = null;
    if (pointer && this.canvas.hasPointerCapture(pointer.pointerId)) this.canvas.releasePointerCapture(pointer.pointerId);
  }

  frame(now) {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!this.mode || !width || !height) return;
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.renderer.setSize(width, height, false);
      const halfHeight = Math.max(1.62, 3.45 * height / width);
      const halfWidth = halfHeight * width / height;
      this.camera.top = halfHeight;
      this.camera.bottom = -halfHeight;
      this.camera.left = -halfWidth;
      this.camera.right = halfWidth;
      this.camera.updateProjectionMatrix();
    }
    if (this.mode === 'gallery') for (const [id, item] of this.models) {
      const t = now / 1000;
      item.mesh.position.y = item.home.y + Math.sin(t * 2.15 + id * 1.4) * .13 + (this.selected === id ? .10 : 0);
      item.mesh.rotation.set(.33 + Math.sin(t + id) * .19, t * (.66 + id * .09) + id * .9, .16 + Math.cos(t + id) * .12);
      item.mesh.scale.setScalar((width < 520 ? 1.2 : 1) * (this.selected === id ? 1.08 : 1));
    }
    if (this.mode === 'forge') for (const [id, item] of this.models) {
      if (this.pointer?.moving && this.pointer.id === id) continue;
      item.mesh.position.lerp(item.target, .23);
    }
    if (this.mode === 'result') {
      const effect = this.celebration;
      const t = Math.min(1, (now - effect.start) / 1150);
      if (t < .56) for (const item of this.models.values()) {
        item.mesh.position.lerpVectors(item.home, new THREE.Vector3(0, 1.15, -.32), t / .56);
        item.mesh.rotation.y += .15;
        item.mesh.scale.setScalar(1 - t * .6);
      } else {
        if (!effect.finished) {
          this.removeModels();
          this.model(effect.spec, -1, 0, 1.12, -.32);
          effect.finished = true;
        }
        const item = this.models.get(-1);
        item.mesh.rotation.set(.31, now * .0015, .13);
        item.mesh.scale.setScalar(.78 + Math.min(1, (t - .56) * 3) * .57);
      }
      this.sparkLight.intensity = Math.max(0, 1 - Math.abs(t - .55) * 3.2) * 30;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
