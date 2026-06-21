import { describe, expect, it } from "vitest";
import { addMonths, getMonthLabel, getMonthGridWeeks } from "./appSupport";

describe("addMonths", () => {
  it("moves forward and backward within a year", () => {
    expect(addMonths("2026-06-20", 1)).toBe("2026-07-20");
    expect(addMonths("2026-06-20", -1)).toBe("2026-05-20");
  });

  it("crosses year boundaries", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("clamps the day to the target month length", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28"); // Feb, non-leap
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // Feb, leap
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("getMonthLabel", () => {
  it("returns the full month and year", () => {
    expect(getMonthLabel("2026-06-20")).toBe("June 2026");
    expect(getMonthLabel("2026-12-01")).toBe("December 2026");
  });
});

describe("getMonthGridWeeks", () => {
  it("builds Monday-start weeks of 7 days each", () => {
    const weeks = getMonthGridWeeks("2026-06-20");
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    // June 1, 2026 is a Monday, so the grid starts exactly on the 1st.
    expect(weeks[0][0]).toBe("2026-06-01");
    expect(weeks[0][6]).toBe("2026-06-07");
  });

  it("includes leading days from the previous month when the 1st isn't a Monday", () => {
    // July 1, 2026 is a Wednesday → grid starts on Mon Jun 29.
    const weeks = getMonthGridWeeks("2026-07-15");
    expect(weeks[0][0]).toBe("2026-06-29");
    expect(weeks[0][2]).toBe("2026-07-01");
  });

  it("covers every day of the month", () => {
    const weeks = getMonthGridWeeks("2026-07-15");
    const all = weeks.flat();
    for (let d = 1; d <= 31; d += 1) {
      expect(all).toContain(`2026-07-${String(d).padStart(2, "0")}`);
    }
  });
});
