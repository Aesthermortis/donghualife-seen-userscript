import { jest } from "@jest/globals";

const i18nModuleMock = {
  default: {
    t: jest.fn((key) => key),
  },
};

await jest.unstable_mockModule("../../src/styles.css", () => ({ default: {} }));
await jest.unstable_mockModule("../../src/i18n.js", () => i18nModuleMock);

const { default: UIManager } = await import("../../src/ui-manager.js");

describe("UIManager", () => {
  let triggerButton;

  beforeEach(() => {
    document.body.innerHTML = "";
    triggerButton = document.createElement("button");
    triggerButton.id = "trigger";
    triggerButton.textContent = "Open Modal";
    document.body.append(triggerButton);

    jest.clearAllMocks();
  });

  describe("Modal Focus Management", () => {
    test("should restore focus to the trigger element when modal is closed", async () => {
      triggerButton.focus();
      expect(document.activeElement).toBe(triggerButton);

      const promise = UIManager.showConfirm({ title: "Test", text: "Confirm?" });

      await new Promise(requestAnimationFrame);
      const modal = document.querySelector(".us-dhl-modal");
      expect(modal).not.toBeNull();
      expect(document.activeElement).not.toBe(triggerButton);

      const okButton = document.querySelector(".us-dhl-modal-btn.primary");
      okButton.click();

      await promise;
      await new Promise(requestAnimationFrame);

      expect(document.activeElement).toBe(triggerButton);
    });

    test("should tolerate repeated close attempts", async () => {
      triggerButton.focus();
      const promise = UIManager.showConfirm({ title: "Test", text: "Confirm?" });
      await new Promise(requestAnimationFrame);

      const overlay = document.querySelector(".us-dhl-modal-overlay");

      expect(() => {
        overlay.click();
        overlay.click();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }).not.toThrow();

      await promise;
      await new Promise(requestAnimationFrame);
      expect(document.activeElement).toBe(triggerButton);
    });

    test("should restore focus when closed with Escape key", async () => {
      triggerButton.focus();
      const promise = UIManager.showConfirm({ title: "Test", text: "Confirm?" });
      await new Promise(requestAnimationFrame);

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      await promise;
      await new Promise(requestAnimationFrame);

      expect(document.activeElement).toBe(triggerButton);
    });

    test("should restore focus when closed by clicking the overlay", async () => {
      triggerButton.focus();
      const promise = UIManager.showConfirm({ title: "Test", text: "Confirm?" });
      await new Promise(requestAnimationFrame);

      const overlay = document.querySelector(".us-dhl-modal-overlay");
      overlay.click();

      await promise;
      await new Promise(requestAnimationFrame);

      expect(document.activeElement).toBe(triggerButton);
    });
  });
});
