/* Installation help and offline loading; no timers or audio run in the worker. */
(function () {
  'use strict';
  const button = document.getElementById('installHelpButton');
  const dialog = document.getElementById('installHelpDialog');
  button.addEventListener('click', () => dialog.showModal());
  if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', {scope:'./'}).then(() => navigator.serviceWorker.ready).then(() => {
      document.getElementById('offlineStatus').textContent = 'Lista para abrir sin internet en este dispositivo.';
    }).catch(() => {
      document.getElementById('offlineStatus').textContent = 'Puedes usar Pulso con conexión. La descarga para uso sin internet no se completó.';
    });
  }, {once:true});
})();
