import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { glazes, hasFace, powers, rarities } from './catalogo.js?v=azulejos-1';

const pips = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const stoneGlaze = { color: '#65737c', light: '#a7adb1', darkPips: true };
const rainbow = ['#ef8a76', '#f1c563', '#a0cf9d', '#69a7db', '#9874c1', '#de8aaf'];

function texture(canvas) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function dieFace(spec, face, stone) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gilded = !stone && hasFace(spec.gild, face);
  const glaze = stone ? stoneGlaze : gilded ? glazes[6] : glazes[spec.glaze];
  const wash = ctx.createLinearGradient(5, 7, 124, 115);
  if (spec.rainbow && !stone && !gilded) rainbow.forEach((color, i) => wash.addColorStop(i / (rainbow.length - 1), color));
  else {
    wash.addColorStop(0, glaze.light);
    if (spec.second != null && !stone && !gilded) {
      wash.addColorStop(.49, glaze.color);
      wash.addColorStop(.51, glazes[spec.second].light);
      wash.addColorStop(1, glazes[spec.second].color);
    } else wash.addColorStop(1, glaze.color);
  }
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = stone ? '#d0d0cba0' : spec.eternal || gilded ? '#ffe392' : '#f6e7c7b9';
  ctx.lineWidth = spec.eternal && !stone ? 3 : 1.8;
  ctx.beginPath();
  ctx.roundRect(11, 11, 106, 106, 11);
  ctx.stroke();
  for (const x of [23, 105]) for (const y of [23, 105]) {
    ctx.beginPath();
    ctx.arc(x, y, 5.8, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }
  const dark = glaze.darkPips || spec.rainbow;
  const ink = stone || dark ? '#212f3e' : '#fff1d4';
  if (!stone && hasFace(spec.wild, face)) {
    ctx.font = '54px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;
    ctx.fillText('★', 64, 64);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(spec.faces[face], 64, 100);
  } else for (const pip of pips[spec.faces[face]]) {
    const x = 37 + pip % 3 * 27, y = 37 + Math.floor(pip / 3) * 27;
    ctx.beginPath();
    ctx.arc(x, y + 1.3, 7.9, 0, 2 * Math.PI);
    ctx.fillStyle = '#18273277';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 7.1, 0, 2 * Math.PI);
    ctx.fillStyle = ink;
    ctx.fill();
  }
  if (!stone && hasFace(spec.boost, face)) {
    ctx.fillStyle = '#182433';
    ctx.beginPath();
    ctx.roundRect(75, 90, 35, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#ffda87';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×2', 92, 100);
  }
  return texture(canvas);
}

export class DiceArt {
  constructor() {
    this.geometry = new RoundedBoxGeometry(.86, .86, .86, 3, .106);
    this.cache = new Map();
  }

  create(spec, stone = false) {
    const key = JSON.stringify([stone, spec.faces, stone ? 0 : [spec.glaze, spec.second, spec.boost, spec.gild, spec.wild, spec.eternal, spec.rainbow]]);
    let item = this.cache.get(key);
    if (!item) {
      const materials = [2, 3, 0, 5, 1, 4].map(face => new THREE.MeshPhysicalMaterial({ map: dieFace(spec, face, stone),
        roughness: stone ? .66 : .32, clearcoat: stone ? 0 : .27, clearcoatRoughness: .36 }));
      item = { count: 0, materials };
      this.cache.set(key, item);
    }
    item.count++;
    const mesh = new THREE.Mesh(this.geometry, item.materials);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.art = key;
    return mesh;
  }

  release(mesh) {
    const key = mesh.userData.art;
    const item = this.cache.get(key);
    if (!item || --item.count) return;
    item.materials.forEach(material => { material.map.dispose(); material.dispose(); });
    this.cache.delete(key);
  }
}

const tiles = new Map();

export function tileArt(key) {
  if (tiles.has(key)) return tiles.get(key);
  const { rarity } = powers[key];
  const { ink, color } = rarities[rarity];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const glaze = ctx.createLinearGradient(8, 6, 117, 126);
  glaze.addColorStop(0, '#fff8e8');
  glaze.addColorStop(1, '#d5c4a4');
  ctx.fillStyle = glaze;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.lineWidth = 1.7;
  ctx.strokeRect(13, 13, 102, 102);
  ctx.translate(64, 64);
  const petals = [4, 8, 8, 12, 12][rarity];
  const shape = Array.from(key).reduce((value, char) => value + char.charCodeAt(0), 0) % 4;
  for (let index = 0; index < petals; index++) {
    ctx.rotate(2 * Math.PI / petals);
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.quadraticCurveTo(11 + shape, -17, 0, -38 - shape);
    ctx.quadraticCurveTo(-11 - shape, -17, 0, 5);
    ctx.fillStyle = index % 2 || rarity === 0 ? ink : color;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 9 + rarity * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
  if (rarity >= 2) {
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();
  }
  const result = { map: texture(canvas), url: canvas.toDataURL() };
  tiles.set(key, result);
  return result;
}
