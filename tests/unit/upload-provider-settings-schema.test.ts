import { describe, expect, it } from "vitest";

import { updateUploadProviderSchema } from "~/lib/validation/schemas/settings.schemas";

describe("updateUploadProviderSchema", () => {
  it("requires custom URL when BLOSSOM_CUSTOM is selected", () => {
    const result = updateUploadProviderSchema.safeParse({
      uploadProvider: "BLOSSOM_CUSTOM",
      customBlossomUrl: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-https custom URL", () => {
    const result = updateUploadProviderSchema.safeParse({
      uploadProvider: "BLOSSOM_CUSTOM",
      customBlossomUrl: "http://custom.example.com",
    });
    expect(result.success).toBe(false);
  });

  it("accepts and normalizes custom URL", () => {
    const result = updateUploadProviderSchema.safeParse({
      uploadProvider: "BLOSSOM_CUSTOM",
      customBlossomUrl: "https://custom.example.com/",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.customBlossomUrl).toBe("https://custom.example.com");
  });

  it("allows non-custom provider without URL", () => {
    const result = updateUploadProviderSchema.safeParse({
      uploadProvider: "BLOSSOM_PRIMAL",
    });
    expect(result.success).toBe(true);
  });
});
