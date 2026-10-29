/* Presentation fills the available screen; AirPlay mirroring stays under iOS control. */
(function () {
  'use strict';
  const get = id => document.getElementById(id);
  const tvButton = get('tvModeButton');
  const fullscreenButton = get('fullscreenButton');
  const exitButton = get('exitTVButton');
  const status = get('displayStatus');
  const helpButton = get('projectionHelpButton');
  const helpDialog = get('projectionHelpDialog');
  const body = document.body;
  const root = document.documentElement;
  let presenting = false;
  let wasFullscreen = false;
  let operation = 0;
  let messageTimer = null;
  let messageVersion = 0;

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null;
  }
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
    if (tvButton) {
      tvButton.setAttribute('aria-pressed', String(presenting));
      tvButton.textContent = presenting ? 'Modo TV activado' : 'Modo TV';
    }
    if (fullscreenButton) {
      fullscreenButton.setAttribute('aria-pressed', String(fullscreen));
      fullscreenButton.textContent = fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
    }
    if (exitButton) exitButton.hidden = !presenting && !fullscreen;
  }
  function fallback() {
    message('Modo TV activo. Si Safari no permite ocultar sus barras, abre Pulso desde la pantalla de inicio y gira el iPhone. Para proyectar, usa Duplicar pantalla.');
  }
  function exitNative() {
    if (!fullscreenElement()) return Promise.resolve();
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (!exit) return Promise.resolve();
    try {
      return Promise.resolve(exit.call(document)).catch(() => {
        message('Usa el control de pantalla completa del navegador para salir.');
      });
    } catch (_) {
      message('Usa el control de pantalla completa del navegador para salir.');
      return Promise.resolve();
    }
  }
  function requestNative(token) {
    if (fullscreenElement()) { sync(); return; }
    const request = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen;
    if (!request) { fallback(); return; }
    // Invoke directly inside the click, before any await, to keep user activation.
    try {
      const result = request.call(root);
      Promise.resolve(result).then(() => {
        if (token !== operation || !presenting) {
          if (fullscreenElement()) exitNative();
          return;
        }
        sync();
        if (fullscreenElement()) message('Pantalla completa activada. Para proyectar el iPhone, usa Duplicar pantalla.');
        else fallback();
      }).catch(() => { if (token === operation && presenting) fallback(); });
    } catch (_) { if (token === operation && presenting) fallback(); }
  }
  function enter() {
    if (helpDialog && helpDialog.open) helpDialog.close();
    const token = ++operation;
    presenting = true;
    message('Modo TV activo. Gira el iPhone para usar la vista horizontal.');
    sync();
    requestNative(token);
  }
  function leave() {
    if (helpDialog && helpDialog.open) helpDialog.close();
    operation += 1;
    presenting = false;
    message('');
    sync();
    exitNative();
  }
  if (tvButton) tvButton.addEventListener('click', () => { if (presenting) leave(); else enter(); });
  if (fullscreenButton) fullscreenButton.addEventListener('click', () => { if (fullscreenElement()) leave(); else enter(); });
  if (exitButton) exitButton.addEventListener('click', leave);
  if (helpButton) helpButton.addEventListener('click', () => {
    if (helpDialog && typeof helpDialog.showModal === 'function') helpDialog.showModal();
    else message('Gira el iPhone. Abre el Centro de control, toca Duplicar pantalla y elige una TV compatible conectada a la misma red wifi.');
  });
  document.addEventListener('fullscreenchange', () => {
    const ended = wasFullscreen && !fullscreenElement();
    sync();
    if (ended) { operation += 1; message(''); }
  });
  document.addEventListener('webkitfullscreenchange', () => {
    const ended = wasFullscreen && !fullscreenElement();
    sync();
    if (ended) { operation += 1; message(''); }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]') || (!presenting && !fullscreenElement())) return;
    event.preventDefault();
    leave();
  });
  sync();
})();
