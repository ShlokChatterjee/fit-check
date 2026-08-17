import { describe, expect, it } from "vitest";

import { interpretRequest } from "./interpret-request";

describe("interpretRequest (stub interpreter)", () => {
  it("extracts weather from a rainy work-day request", async () => {
    const intent = await interpretRequest("something for a rainy work day");
    expect(intent.weather).toBe("wet");
    expect(intent.formality).toBe("smart_casual");
    expect(intent.occasion).toBe("work");
  });

  it("reads casual weekend intent", async () => {
    const intent = await interpretRequest("casual weekend brunch");
    expect(intent.formality).toBe("casual");
    expect(intent.occasion).toBe("brunch");
  });

  it("detects formal occasions", async () => {
    const intent = await interpretRequest("a formal wedding outfit");
    expect(intent.formality).toBe("formal");
    expect(intent.weather).toBeUndefined();
  });

  it("always returns a descriptors array without stopwords", async () => {
    const intent = await interpretRequest("something bold for a summer party");
    expect(Array.isArray(intent.descriptors)).toBe(true);
    expect(intent.descriptors).toContain("bold");
    expect(intent.descriptors).not.toContain("for");
    expect(intent.descriptors).not.toContain("something");
  });
});
