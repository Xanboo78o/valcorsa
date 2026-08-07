/* Module bootstrap: loads three.js r185 + addons, exposes them as globals, then loads the
   classic (non-module) game scripts in order. The game must be served over http (server.js
   locally / Cloudflare Pages in prod) — file:// no longer works. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

window.THREE = THREE;
window.FX = { EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, BokehPass, OutputPass, RoundedBoxGeometry, BufferGeometryUtils };

window.CAR_GLB = null;   // toy cars now — no hero glb

// classic scripts, in dependency order (they share top-level bindings)
const SCRIPTS = ['js/config.js', 'js/palette.js', 'js/tracks.js', 'js/citydata.js', 'js/daynight.js',
                 'js/weather.js', 'js/postfx.js', 'js/carfactory.js', 'js/pair.js', 'js/dress.js',
                 'js/rallyhouse.js', 'js/main.js', 'js/items.js', 'js/damage.js', 'js/parts.js',
                 'js/enginecat.js', 'js/particons.js', 'js/economy.js', 'js/city.js', 'js/garage3d.js',
                 'js/touch.js', 'js/roar.js', 'js/net.js', 'js/schedule.js', 'js/league.js', 'js/shell.js',
                 'js/hotlap.js', 'js/radio.js', 'js/flex.js', 'js/billboards.js'];
for (const src of SCRIPTS) {
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src + (window.APEX_V ? '?v=' + window.APEX_V : '');
    s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src));
    document.body.appendChild(s);
  });
}
