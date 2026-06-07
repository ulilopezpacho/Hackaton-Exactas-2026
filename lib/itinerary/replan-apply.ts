import type { ReplanConstraints } from "./replan-contract";
import type { ReplanSolverResult } from "./replan-solver";

export type ReplanItemInsert = {
  description: string | null;
  ends_at: string;
  itinerary_id: string;
  item_type: string;
  locked?: boolean;
  place_id: string | null;
  position: number;
  starts_at: string;
  title: string;
};

export type ReplanSourceItem = Omit<
  ReplanItemInsert,
  "itinerary_id"
> & {
  id: string;
};

export type ReplanSourceItinerary = {
  day_number: number;
  generation_prompt: string | null;
  id: string;
  itinerary_type: string | null;
  status: string;
  title: string;
};

export type ReplanSnapshot = {
  currentItemId: string;
  sourceItinerary: ReplanSourceItinerary;
  sourceItems: ReplanSourceItem[];
};

export interface ReplanApplyRepository {
  archiveItinerary(itineraryId: string): Promise<boolean>;
  createDraft(input: {
    dayNumber: number;
    generationPrompt: string | null;
    itineraryType: string | null;
    title: string;
    tripId: string;
  }): Promise<string>;
  deleteItinerary(itineraryId: string): Promise<void>;
  insertItems(
    items: ReplanItemInsert[],
  ): Promise<Array<{ id: string; position: number }>>;
  loadSnapshot(tripId: string): Promise<ReplanSnapshot | null>;
  markItineraryActive(
    itineraryId: string,
    sourceItineraryId: string,
  ): Promise<boolean>;
  restoreItinerary(itineraryId: string): Promise<void>;
  updateCurrentItem(
    tripId: string,
    expectedCurrentItemId: string,
    nextCurrentItemId: string,
  ): Promise<boolean>;
}

export class ReplanConflictError extends Error {
  constructor(message = "The itinerary changed while replanning") {
    super(message);
    this.name = "ReplanConflictError";
  }
}

export async function applyPreparedReplan(input: {
  constraints: ReplanConstraints;
  repository: ReplanApplyRepository;
  result: ReplanSolverResult;
  tripId: string;
}) {
  const { constraints, repository, result, tripId } = input;
  const snapshot = await repository.loadSnapshot(tripId);
  assertSnapshot(snapshot, constraints);

  const currentIndex = snapshot.sourceItems.findIndex(
    (item) => item.id === constraints.currentItemId,
  );
  if (currentIndex < 0) {
    throw new ReplanConflictError("Current item is no longer in the itinerary");
  }

  const draftId = await repository.createDraft({
    dayNumber: snapshot.sourceItinerary.day_number,
    generationPrompt: snapshot.sourceItinerary.generation_prompt,
    itineraryType: snapshot.sourceItinerary.itinerary_type,
    title: snapshot.sourceItinerary.title,
    tripId,
  });
  let currentItemUpdated = false;
  let sourceArchived = false;
  let newCurrentItemId = "";

  try {
    const prefix = snapshot.sourceItems
      .slice(0, currentIndex + 1)
      .map((item) => ({
        description: item.description,
        ends_at: item.ends_at,
        itinerary_id: draftId,
        item_type: item.item_type,
        locked: item.locked,
        place_id: item.place_id,
        position: item.position,
        starts_at: item.starts_at,
        title: item.title,
      }));
    const generated = result.newItems.map((item) => ({
      description: item.description,
      ends_at: item.endsAt,
      itinerary_id: draftId,
      item_type: item.itemType,
      locked: false,
      place_id: item.placeId,
      position: item.position,
      starts_at: item.startsAt,
      title: item.title,
    }));
    const insertedItems = await repository.insertItems([
      ...prefix,
      ...generated,
    ]);
    const newCurrentItem = insertedItems.find(
      (item) => item.position === snapshot.sourceItems[currentIndex].position,
    );
    if (!newCurrentItem) {
      throw new Error("Failed to map the current item into the new itinerary");
    }
    newCurrentItemId = newCurrentItem.id;

    const freshSnapshot = await repository.loadSnapshot(tripId);
    assertSnapshot(freshSnapshot, constraints);

    // The existing partial unique index allows only one active itinerary per
    // day/type. Archiving conditionally claims the source version before the
    // draft can become active.
    sourceArchived = await repository.archiveItinerary(
      constraints.sourceItineraryId,
    );
    if (!sourceArchived) {
      throw new ReplanConflictError();
    }

    const activated = await repository.markItineraryActive(
      draftId,
      constraints.sourceItineraryId,
    );
    if (!activated) {
      throw new ReplanConflictError();
    }

    currentItemUpdated = await repository.updateCurrentItem(
      tripId,
      constraints.currentItemId,
      newCurrentItemId,
    );
    if (!currentItemUpdated) {
      throw new ReplanConflictError();
    }

    return { itineraryId: draftId, tripId };
  } catch (error) {
    if (currentItemUpdated) {
      await repository
        .updateCurrentItem(
          tripId,
          newCurrentItemId,
          constraints.currentItemId,
        )
        .catch(() => undefined);
    }
    await repository.deleteItinerary(draftId).catch(() => undefined);
    if (sourceArchived) {
      await repository
        .restoreItinerary(constraints.sourceItineraryId)
        .catch(() => undefined);
    }
    throw error;
  }
}

function assertSnapshot(
  snapshot: ReplanSnapshot | null,
  constraints: ReplanConstraints,
): asserts snapshot is ReplanSnapshot {
  if (
    !snapshot ||
    snapshot.currentItemId !== constraints.currentItemId ||
    snapshot.sourceItinerary.id !== constraints.sourceItineraryId ||
    snapshot.sourceItinerary.status !== "active"
  ) {
    throw new ReplanConflictError();
  }
}
