import AppController from "./app-controller.js";
import { logError } from "./core/errors.js";

const startApp = async () => {
  try {
    await AppController.init();
  } catch (err) {
    logError("Failed to initialize application.", err, { onceKey: "init-app-controller" });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void startApp();
  });
} else {
  void startApp();
}
