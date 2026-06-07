import { resolvedTripStatus } from "./status";

describe("resolvedTripStatus", () => {
  it("treats a generated itinerary as planned when the stored status is stale", () => {
    expect(resolvedTripStatus("generating", true)).toBe("planned");
  });

  it("keeps generating while no itinerary exists", () => {
    expect(resolvedTripStatus("generating", false)).toBe("generating");
  });

  it.each(["planned", "ongoing", "completed"] as const)(
    "keeps %s unchanged",
    (status) => {
      expect(resolvedTripStatus(status, true)).toBe(status);
    },
  );
});
