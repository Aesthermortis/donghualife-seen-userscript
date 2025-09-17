import AppController from './app-controller.js';

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", AppController.init);
} else {
  AppController.init();
}

