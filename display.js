/* The horizontal workout offers one expand control. AirPlay stays under iOS control. */
(function () {
  'use strict';
  const get = id => document.getElementById(id);
  const expandButton = get('expandTimerButton');
  const expandIcon = get('expandTimerIcon');
  const timerScreen = get('timerScreen');
  const status = get('displayStatus');
  const helpButton = get('projectionHelpButton');
  const helpDialog = get('projectionHelpDialog');
  const body = document.body;
  const root = document.documentElement;
  const landscape = typeof matchMedia === 'function' ? matchMedia('(orientation: landscape)') : null;
  let presenting = false;
  let wasFullscreen = false;
  let operation = 0;
  let messageTimer = null;
  let messageVersion = 0;

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null;
  }
  function isLandscape() { return !landscape || landscape.matches; }
  function timerVisible() { return !!timerScreen && !timerScreen.hidden; }
  function message(text) {
    if (messageTimer !== null) clearTimeout(messageTimer);
    messageTimer = null;
    const version = ++messageVersion;
    if (!status) return;
    status.textContent = text;
    status.hidden = !text;
    if (text) messageTimer = setTimeout(() => {
      if (version !== messageVersion) return;
      status.textContent = '';
      status.hidden = true;
      messageTimer = null;
    }, 7000);
  }
  function sync() {
    const fullscreen = !!fullscreenElement();
    if (wasFullscreen && !fullscreen) presenting = false;
    wasFullscreen = fullscreen;
    body.classList.toggle('presentation-mode', presenting);
    if (expandButton) {
      const active = presenting || fullscreen;
      // A failed native exit must never strand the user without an exit control.
      expandButton.hidden = fullscreen ? false : !timerVisible() || !isLandscape();
      expandButton.setAttribute('aria-pressed', String(active));
      expandButton.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Pantalla completa');
    }
    if (expandIcon) expandIcon.setAttribute('href', presenting || fullscreen ? '#i-collapse' : '#i-expand');
  }
  function fallback() {
    message('Vista ampliada activa. Si Safari no oculta sus barras, abre Pulso desde la pantalla de inicio. Para proyectar, usa Duplicar pantalla.');
  }
  function exitNative() {
    if (!fullscreenElement()) return Promise.resolve();
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (!exit) { message('Usa el control de pantalla completa del navegador para salir.'); sync(); return Promise.resolve(); }
    try {
      return Promise.resolve(exit.call(document)).then(sync).catch(() => {
        message('Usa el control de pantalla completa del navegador para salir.');
        sync();
      });
    } catch (_) {
      message('Usa el control de pantalla completa del navegador para salir.');
      sync();
      return Promise.resolve();
    }
  }
  function requestNative(token) {
    if (fullscreenElement()) { sync(); return; }
    const request = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen;
    if (!request) { fallback(); return; }
    // Invoke inside the original click to preserve Safari's user activation.
    try {
      const result = request.call(root);
      Promise.resolve(result).then(() => {
        if (token !== operation || !presenting || !timerVisible() || !isLandscape()) {
          if (fullscreenElement()) exitNative();
          return;
        }
        sync();
        if (fullscreenElement()) message('Pantalla completa activada.');
        else fallback();
      }).catch(() => { if (token === operation && presenting) fallback(); });
    } catch (_) { if (token === operation && presenting) fallback(); }
  }
  function enter() {
    if (!timerVisible() || !isLandscape()) return;
    const token = ++operation;
    presenting = true;
    message('');
    sync();
    requestNative(token);
  }
  function leave() {
    operation += 1;
    presenting = false;
    message('');
    sync();
    exitNative();
  }
  if (expandButton) expandButton.addEventListener('click', () => {
    if (presenting || fullscreenElement()) leave(); else enter();
  });
  if (helpButton) helpButton.addEventListener('click', () => {
    if (helpDialog && typeof helpDialog.showModal === 'function') helpDialog.showModal();
    else message('Gira el iPhone. Abre el Centro de control, toca Duplicar pantalla y elige una TV compatible conectada a la misma red wifi.');
  });
  function screenOrOrientationChanged() {
    if ((!timerVisible() || !isLandscape()) && (presenting || fullscreenElement())) leave();
    else sync();
  }
  if (landscape) {
    if (landscape.addEventListener) landscape.addEventListener('change', screenOrOrientationChanged);
    else if (landscape.addListener) landscape.addListener(screenOrOrientationChanged);
  }
  if (timerScreen && typeof MutationObserver === 'function') {
    new MutationObserver(screenOrOrientationChanged).observe(timerScreen, {attributes: true, attributeFilter: ['hidden']});
  }
  function fullscreenChanged() {
    const ended = wasFullscreen && !fullscreenElement();
    sync();
    if (ended) { operation += 1; message(''); }
  }
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]') || (!presenting && !fullscreenElement())) return;
    event.preventDefault();
    leave();
  });
  sync();
})();
