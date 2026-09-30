import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { threatMatrix } from './threatMatrix.js';
import { tacticalSound } from './tacticalSound.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().then(() => {
  // Initialize Helios C2 Tactical Threat Matrix
  threatMatrix.init();

  // Bind Tactical Audio Switcher
  const audioBtn = document.getElementById('tactical-audio-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      const active = tacticalSound.toggle();
      audioBtn.style.color = active ? '#00f0ff' : '';
      audioBtn.style.background = active ? 'rgba(0, 240, 255, 0.2)' : '';

      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = active ? 'TACTICAL AUDIO ONLINE · SONAR & COMMS ARMED' : 'TACTICAL AUDIO MUTED';
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 2800);
      }
    });
  }
}).catch((error) => {
  console.error("Helios C2 initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  if (loaderStatus) {
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
  }
});

export { application };
