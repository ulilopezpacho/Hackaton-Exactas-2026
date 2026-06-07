import {
  buildReplanConstraints,
  isReplanConstraints,
} from "./replan-contract";

const currentItem = {
  durationMinutes: 60,
  endsAt: "2026-06-07T14:00:00.000Z",
  id: "current",
  itemType: "place",
  placeId: "current-place",
};
const upcomingItems = [
  {
    durationMinutes: 75,
    endsAt: "2026-06-07T16:00:00.000Z",
    id: "closed-item",
    itemType: "place",
    placeId: "closed-place",
  },
  {
    durationMinutes: 45,
    endsAt: "2026-06-07T17:00:00.000Z",
    id: "later-item",
    itemType: "place",
    placeId: "later-place",
  },
];

describe("buildReplanConstraints", () => {
  test("moves the effective start forward for an overstay", () => {
    const constraints = buildReplanConstraints({
      currentItem,
      scenario: "overstay",
      sourceItineraryId: "latest-copy",
      upcomingItems,
    });

    expect(constraints.effectiveStartAt).toBe(
      "2026-06-07T14:30:00.000Z",
    );
    expect(constraints.sourceItineraryId).toBe("latest-copy");
    expect(constraints.durationMinutesByItemId).toEqual({
      "closed-item": 75,
      "later-item": 45,
    });
  });

  test("excludes the first pending place for a closure", () => {
    const constraints = buildReplanConstraints({
      currentItem,
      scenario: "closed",
      sourceItineraryId: "latest-copy",
      upcomingItems,
    });

    expect(constraints.effectiveStartAt).toBe(currentItem.endsAt);
    expect(constraints.excludedPlaceIds).toEqual(["closed-place"]);
    expect(isReplanConstraints(constraints)).toBe(true);
  });
});
