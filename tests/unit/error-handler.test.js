import { jest } from "@jest/globals";

describe("withErrorHandling", () => {
  let withErrorHandling;
  let showToastMock;
  let translateMock;
  let logErrorMock;

  const loadModule = async () => {
    jest.resetModules();
    showToastMock = jest.fn();
    translateMock = jest.fn().mockReturnValue("translated");
    logErrorMock = jest.fn();

    jest.unstable_mockModule("../../src/ui-manager.js", () => ({
      default: {
        showToast: showToastMock,
      },
    }));

    jest.unstable_mockModule("../../src/i18n.js", () => ({
      default: {
        t: translateMock,
      },
    }));

    jest.unstable_mockModule("../../src/core/errors.js", () => ({
      logError: logErrorMock,
    }));

    ({ default: withErrorHandling } = await import("../../src/error-handler.js"));
  };

  beforeEach(async () => {
    await loadModule();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns fallback value when provided", async () => {
    const fallback = [];
    const onceKey = "load-items";

    const result = await withErrorHandling(
      async () => {
        throw new Error("boom");
      },
      { logContext: "Load items", fallback, onceKey },
    );

    expect(result).toBe(fallback);
    expect(logErrorMock).toHaveBeenCalledWith("Load items", expect.any(Error), { onceKey });
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("returns null by default when no fallback is supplied", async () => {
    const result = await withErrorHandling(async () => {
      throw new Error("explode");
    });

    expect(result).toBeNull();
    expect(logErrorMock).toHaveBeenCalledWith("Task failed", expect.any(Error), {
      onceKey: undefined,
    });
  });

  it("rethrows when requested after logging and showing toast", async () => {
    await expect(
      withErrorHandling(
        async () => {
          throw new Error("kaboom");
        },
        {
          errorMessageKey: "errors.save",
          rethrow: true,
          onceKey: "save-item",
        },
      ),
    ).rejects.toThrow("kaboom");

    expect(logErrorMock).toHaveBeenCalledWith("Task failed", expect.any(Error), {
      onceKey: "save-item",
    });
    expect(translateMock).toHaveBeenCalledWith("errors.save");
    expect(showToastMock).toHaveBeenCalledWith("translated");
  });
});
