import { describe, expect, it } from "vitest";

import { formatDate, formatMoney, formatNumber, toAsciiDigits } from "@/lib/format";

describe("toAsciiDigits", () => {
  it("converts Bangla digits and leaves other characters", () => {
    expect(toAsciiDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
    expect(toAsciiDigits("পরিমাণ ১২")).toBe("পরিমাণ 12");
  });
});

describe("formatMoney", () => {
  it("uses the taka symbol", () => {
    expect(formatMoney(1250, "en")).toBe("৳1,250.00");
    expect(formatMoney(1250, "bn")).toContain("৳");
    expect(formatMoney(1250, "bn")).toContain("১,২৫০.০০");
  });
});

describe("formatNumber", () => {
  it("uses Bangla digits for bn-BD", () => {
    expect(formatNumber(1250, "en")).toBe("1,250");
    expect(formatNumber(1250, "bn")).toBe("১,২৫০");
  });
});

describe("formatDate", () => {
  it("formats in Asia/Dhaka", () => {
    const date = new Date("2026-10-15T00:00:00Z");
    expect(formatDate(date, "en")).toBe("Oct 15, 2026");
    expect(formatDate(date, "bn")).toContain("১৫");
    expect(formatDate(date, "bn")).toContain("২০২৬");
  });
});
