import {
  applyPreparedReplan,
  ReplanConflictError,
  type ReplanApplyRepository,
  type ReplanItemInsert,
  type ReplanSnapshot,
} from "./replan-apply";
import type { ReplanConstraints } from "./replan-contract";
import type { ReplanSolverResult } from "./replan-solver";

const constraints: ReplanConstraints = {
  currentItemId: "current-item",
  durationMinutesByItemId: { upcoming: 60 },
  effectiveStartAt: "2026-06-07T14:00:00.000Z",
  excludedPlaceIds: [],
  sourceItineraryId: "source-itinerary",
};

const result: ReplanSolverResult = {
  droppedPlaceIds: [],
  newItems: [
    {
      description: null,
      endsAt: "2026-06-07T16:00:00.000Z",
      itemType: "place",
      placeId: "next-place",
      position: 2,
      startsAt: "2026-06-07T15:00:00.000Z",
      title: "Next place",
    },
  ],
  score: 100,
};

function sourceSnapshot(): ReplanSnapshot {
  return {
    currentItemId: constraints.currentItemId,
    sourceItinerary: {
      day_number: 1,
      generation_prompt: null,
      id: constraints.sourceItineraryId,
      itinerary_type: "generated",
      status: "active",
      title: "Day 1",
    },
    sourceItems: [
      {
        description: null,
        ends_at: "2026-06-07T14:00:00.000Z",
        id: constraints.currentItemId,
        item_type: "place",
        locked: false,
        place_id: "current-place",
        position: 1,
        starts_at: "2026-06-07T13:00:00.000Z",
        title: "Current place",
      },
    ],
  };
}

class FakeRepository implements ReplanApplyRepository {
  archived = false;
  currentItemId = constraints.currentItemId;
  deleted: string[] = [];
  failInsert = false;
  failUpdate = false;
  inserted: ReplanItemInsert[] = [];
  sourceId = constraints.sourceItineraryId;

  async archiveItinerary(itineraryId: string) {
    if (itineraryId !== this.sourceId || this.archived) return false;
    this.archived = true;
    return true;
  }

  async createDraft() {
    return "draft-itinerary";
  }

  async deleteItinerary(itineraryId: string) {
    this.deleted.push(itineraryId);
  }

  async insertItems(items: ReplanItemInsert[]) {
    if (this.failInsert) throw new Error("insert failed");
    this.inserted = items;
    return items.map((item, index) => ({
      id: index === 0 ? "new-current-item" : `new-item-${index}`,
      position: item.position,
    }));
  }

  async loadSnapshot() {
    const snapshot = sourceSnapshot();
    snapshot.currentItemId = this.currentItemId;
    snapshot.sourceItinerary.id = this.sourceId;
    snapshot.sourceItinerary.status = this.archived ? "archived" : "active";
    return snapshot;
  }

  async markItineraryActive() {
    return this.archived;
  }

  async restoreItinerary() {
    this.archived = false;
  }

  async updateCurrentItem(
    _tripId: string,
    expectedCurrentItemId: string,
    nextCurrentItemId: string,
  ) {
    if (this.failUpdate || this.currentItemId !== expectedCurrentItemId) {
      return false;
    }
    this.currentItemId = nextCurrentItemId;
    return true;
  }
}

describe("applyPreparedReplan", () => {
  test("keeps the source chain and replaces only the suffix", async () => {
    const repository = new FakeRepository();

    const applied = await applyPreparedReplan({
      constraints,
      repository,
      result,
      tripId: "trip",
    });

    expect(applied.itineraryId).toBe("draft-itinerary");
    expect(repository.inserted).toHaveLength(2);
    expect(repository.inserted[0]).toMatchObject({
      itinerary_id: "draft-itinerary",
      place_id: "current-place",
      position: 1,
    });
    expect(repository.inserted[1]).toMatchObject({
      itinerary_id: "draft-itinerary",
      place_id: "next-place",
      position: 2,
    });
    expect(repository.currentItemId).toBe("new-current-item");
    expect(repository.archived).toBe(true);
  });

  test("rejects a stale preview before creating a version", async () => {
    const repository = new FakeRepository();
    repository.currentItemId = "another-current-item";

    await expect(
      applyPreparedReplan({
        constraints,
        repository,
        result,
        tripId: "trip",
      }),
    ).rejects.toBeInstanceOf(ReplanConflictError);

    expect(repository.inserted).toHaveLength(0);
  });

  test("deletes the draft when item insertion fails", async () => {
    const repository = new FakeRepository();
    repository.failInsert = true;

    await expect(
      applyPreparedReplan({
        constraints,
        repository,
        result,
        tripId: "trip",
      }),
    ).rejects.toThrow("insert failed");

    expect(repository.deleted).toEqual(["draft-itinerary"]);
    expect(repository.archived).toBe(false);
  });

  test("restores the source when updating the trip fails", async () => {
    const repository = new FakeRepository();
    repository.failUpdate = true;

    await expect(
      applyPreparedReplan({
        constraints,
        repository,
        result,
        tripId: "trip",
      }),
    ).rejects.toBeInstanceOf(ReplanConflictError);

    expect(repository.deleted).toEqual(["draft-itinerary"]);
    expect(repository.archived).toBe(false);
    expect(repository.currentItemId).toBe(constraints.currentItemId);
  });

  test("only one concurrent apply can claim the active source", async () => {
    const repository = new FakeRepository();

    const attempts = await Promise.allSettled([
      applyPreparedReplan({
        constraints,
        repository,
        result,
        tripId: "trip",
      }),
      applyPreparedReplan({
        constraints,
        repository,
        result,
        tripId: "trip",
      }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(
      1,
    );
  });
});
