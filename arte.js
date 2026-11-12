import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { glazes, hasFace, powers, rarities } from './catalogo.js?v=patio-1';

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
  ctx.strokeStyle = stone ? '#d0d0cba0' : spec.eternal ? '#15171e' : gilded ? '#ffe392' : '#f6e7c7b9';
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
  if (!stone && spec.eternal) {
    ctx.fillStyle = '#10121a';
    ctx.strokeStyle = '#fff1d4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(43, 9, 42, 21, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff1d4';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('∞', 64, 19);
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

const tileMotifs = {
  chisel: 'M38 83 78 43 87 51 47 91 32 96Z M74 38 80 32 97 48 92 55 M40 64H26 M48 52 41 42 M58 42V28',
  midas: 'M31 86 63 54 73 64 41 96 26 101Z M60 48 69 39 88 58 79 68 M90 28V48 M80 38H100 M94 71V88 M85 80H103',
  aces: 'M65 31 92 43V71Q88 90 65 100 40 90 37 71V43Z M55 57 65 48V79 M55 81H77',
  colonnade: 'M27 51 64 31 101 51Z M29 94H99 M35 85H93 M43 55V82 M64 55V82 M85 55V82',
  acanthus: 'M63 98C60 77 52 57 34 43Q68 43 67 71Q71 42 93 32Q98 57 74 77 M68 97Q79 76 98 77Q91 93 68 97 M60 90Q39 89 29 72Q49 70 60 90',
  cobalt: 'M64 55 73 64 64 73 55 64Z M45 46Q25 64 45 82 M82 46Q102 64 82 82 M35 35Q7 64 35 93 M93 35Q121 64 93 93',
  frieze: 'M26 88H102V98H26Z M32 80 27 47 49 64 64 35 79 64 101 47 96 80Z M64 57 70 69 64 78 58 69Z',
  prism: 'M61 30 91 86H36Z M24 56 49 66 67 66 102 46 M68 67 105 66 M68 68 101 89',
  patience: 'M40 30H88 M40 98H88 M45 32Q46 54 64 64Q46 75 45 96 M83 32Q82 54 64 64Q82 75 83 96 M52 88 64 78 76 88Z',
  mortar: 'M42 35 70 29 94 47 99 71 85 93 54 99 33 82 28 58Z M66 30 54 51 69 64 52 77 54 97 M69 64 95 50 M52 77 33 80',
  basalt: 'M37 84Q44 77 44 60A20 20 0 0 1 84 60Q84 77 91 84Z M55 91Q64 107 73 91 M64 33V26 M34 48 27 41 M94 48 101 41',
  alhambra: 'M33 97V62Q33 45 64 29Q95 45 95 62V97Z M48 97V67Q48 57 64 47Q80 57 80 67V97 M23 97H105 M64 68V97',
};

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
  ctx.fillStyle = color;
  for (const x of [20, 108]) for (const y of [20, 108]) {
    const diamond = new Path2D();
    diamond.moveTo(x - 4, y); diamond.lineTo(x, y - 4); diamond.lineTo(x + 4, y); diamond.lineTo(x, y + 4); diamond.closePath();
    ctx.fill(diamond);
  }
  if (rarity >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.arc(64, 64, 46, 0, Math.PI * 2);
    ctx.stroke();
  }
  const motif = new Path2D(tileMotifs[key]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#fff7e3';
  ctx.stroke(motif);
  ctx.lineWidth = 5;
  ctx.strokeStyle = ink;
  ctx.stroke(motif);
  const result = { map: texture(canvas), url: canvas.toDataURL() };
  tiles.set(key, result);
  return result;
}
