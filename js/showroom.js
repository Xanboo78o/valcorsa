// VALCORSA — THE SHOWROOM. Rocket-League-garage energy for the home screen:
// YOUR kart, live 3D, floodlit on the paddock floor behind the menu, idling on
// a slow turn. Name and number on a chip. AI slop doesn't know your name.
'use strict';

(function () {
  const $ = id => document.getElementById(id);
  let R = null, scene = null, cam = null, kart = null, raf = 0, lastKit = '';

  function ensure() {
    const menu = $('menu');
    if (!menu || $('showroomWrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'showroomWrap';
    wrap.innerHTML = '<canvas id="showroomCv"></canvas><div id="showroomChip"></div>';
    menu.appendChild(wrap);
    R = new THREE.WebGLRenderer({ canvas: $('showroomCv'), alpha: true, antialias: true });
    R.setPixelRatio(Math.min(devicePixelRatio, 2));
    R.setSize(360, 240, false);
    R.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x8fa8e8, 0.55));
    const key = new THREE.SpotLight(0xffffff, 260, 40, 0.55, 0.5);
    key.position.set(4, 9, 6); scene.add(key);
    const rim = new THREE.DirectionalLight(0x2e6bff, 1.4); rim.position.set(-6, 3, -6); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.4, 40),
      new THREE.MeshStandardMaterial({ color: 0x0c1530, roughness: 0.35, metalness: 0.4 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.05, 8, 60),
      new THREE.MeshBasicMaterial({ color: 0x2e6bff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
    cam = new THREE.PerspectiveCamera(30, 1.5, 0.1, 60);
    cam.position.set(6.6, 3.4, 8.2);
    cam.lookAt(0, 0.7, 0);
  }

  function rebuild() {
    if (!scene || typeof KIT === 'undefined' || typeof buildKitMesh !== 'function') return;
    const sig = JSON.stringify(KIT);
    if (sig === lastKit && kart) return;
    lastKit = sig;
    if (kart) scene.remove(kart);
    try {
      kart = buildKitMesh({ ...KIT }, 0xffdd55);
      scene.add(kart);
      const a = JSON.parse(localStorage.getItem('apex_account') || 'null');
      const num = KIT.num || ((KIT.paint * 37 + 13) % 89) + 1;
      $('showroomChip').innerHTML = a ? `<b>${a.username || 'RACER'}</b><span>#${num}</span>` : '';
    } catch (e) { kart = null; }
  }

  function loop(t) {
    raf = 0;
    const menu = $('menu');
    if (!menu || menu.style.display === 'none' || document.hidden) return;   // menu gone: sleep
    rebuild();
    if (kart) kart.rotation.y = t / 4200;
    R.render(scene, cam);
    raf = requestAnimationFrame(loop);
  }
  function wake() { ensure(); if (!raf && $('menu') && $('menu').style.display !== 'none') raf = requestAnimationFrame(loop); }

  // wake when the menu shows (boot, back-to-menu, tab hop)
  const arm = () => {
    const menu = $('menu');
    if (!menu || menu._srWatched) return;
    menu._srWatched = true;
    new MutationObserver(wake).observe(menu, { attributes: true, attributeFilter: ['style'] });
  };
  arm();
  new MutationObserver(arm).observe(document.body, { childList: true });
  document.addEventListener('visibilitychange', wake);
  wake();
})();
