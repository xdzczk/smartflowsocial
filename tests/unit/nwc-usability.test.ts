import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUserEncryptedNwc = vi.fn();
const mockValidateNWCString = vi.fn();
const mockDecrypt = vi.fn();

vi.mock("~/features/user/repositories/nwc-data.server", () => ({
  findUserEncryptedNwc: (...args: unknown[]) =>
    mockFindUserEncryptedNwc(...args),
  findUserNwcFields: vi.fn(),
  updateUserNwc: vi.fn(),
  updateUserNwcEnabled: vi.fn(),
  clearUserNwc: vi.fn(),
  touchUserNwcLastUsed: vi.fn(),
}));

vi.mock("~/lib/encryption.server", () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  encrypt: vi.fn(),
  maskNWCString: vi.fn(),
  validateNWCString: (...args: unknown[]) => mockValidateNWCString(...args),
}));

import { hasUsableNwc } from "~/features/user/services/nwc.server";

describe("hasUsableNwc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when nwc is disabled and empty", async () => {
    mockFindUserEncryptedNwc.mockResolvedValue({
      encryptedNwc: null,
      nwcEnabled: false,
    });

    await expect(hasUsableNwc("u1")).resolves.toBe(false);
  });

  it("returns false when enabled but encrypted secret is missing", async () => {
    mockFindUserEncryptedNwc.mockResolvedValue({
      encryptedNwc: null,
      nwcEnabled: true,
    });

    await expect(hasUsableNwc("u1")).resolves.toBe(false);
  });

  it("returns true only when decrypt succeeds and string validates", async () => {
    mockFindUserEncryptedNwc.mockResolvedValue({
      encryptedNwc: "enc",
      nwcEnabled: true,
    });
    mockDecrypt.mockReturnValue("nostr+walletconnect://valid");
    mockValidateNWCString.mockReturnValue(true);

    await expect(hasUsableNwc("u1")).resolves.toBe(true);
  });
});
