import { jest } from "@jest/globals";

const i18nModuleMock = {
  default: {
    t: jest.fn((key) => key),
  },
};

const utilsModuleMock = {
  default: {
    $: jest.fn(),
    $$: jest.fn(() => []),
    isElementVisible: jest.fn(() => true),
  },
};

await jest.unstable_mockModule("../../src/styles.css", () => ({ default: {} }));
await jest.unstable_mockModule("../../src/i18n.js", () => i18nModuleMock);
await jest.unstable_mockModule("../../src/utils.js", () => utilsModuleMock);

const { default: UIManager } = await import("../../src/ui-manager.js");
const { default: Utils } = await import("../../src/utils.js");

describe("UIManager", () => {
  let triggerButton;

  beforeEach(() => {
    document.body.innerHTML = "";
    triggerButton = document.createElement("button");
    triggerButton.id = "trigger";
    triggerButton.textContent = "Open Modal";
    document.body.appendChild(triggerButton);

    jest.clearAllMocks();

    Utils.$.mockImplementation((selector, parent = document) => parent.querySelector(selector));
    Utils.$$.mockImplementation((selector, parent = document) =>
      Array.from(parent.querySelectorAll(selector)),
    );
    Utils.isElementVisible.mockReturnValue(true);
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
