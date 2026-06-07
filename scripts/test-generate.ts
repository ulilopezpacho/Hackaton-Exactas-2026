import { generateItinerary } from "../lib/itinerary/generate";
import { createClient } from "../lib/supabase/server";

// This script should be run with npx tsx
async function test() {
  const tripId = process.argv[2];
  if (!tripId) {
    console.error("Usage: npx tsx scripts/test-generate.ts <tripId>");
    process.exit(1);
  }

  try {
    console.log(`Testing itinerary generation for trip: ${tripId}`);
    // We need to mock placeIds or get some from the trip
    // For testing, we'll just pass an empty array and let it fetch from catalog if possible
    const result = await generateItinerary(tripId, []);
    console.log("Success!");
    // console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
