/**
 * Manual test for scorePlaces().
 * Uses real data from the Supabase DB (Buenos Aires places with Google Places scores).
 *
 * Run:  npx tsx lib/places/score.manual-test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local since we're outside Next.js
const envPath = resolve(__dirname, "../../.env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

import { scorePlaces } from "./score";
import type { PlaceForScoring, UserPreferencesForScoring } from "./score";

// --- Real places from DB (Buenos Aires, with Google Places rating data) ---
const PLACES: PlaceForScoring[] = [
  {
    id: "da93b7f0-f526-462c-94d4-dfda79ebf3e4",
    name: "El Ateneo Grand Splendid",
    description: "A historic bookstore housed in a former theater, featuring Art Deco architecture.",
    category: "Bookstore",
    rating: 4.8,
    userRatingsTotal: 99464,
    qualityScore: 4.80,
    popularity: 5.0,
  },
  {
    id: "046884a0-f235-415d-874b-001975da2689",
    name: "Teatro Colón",
    description: "A world-renowned opera house completed in 1908, featuring Beaux-Arts architecture.",
    category: "Cultural Heritage",
    rating: 4.8,
    userRatingsTotal: 87983,
    qualityScore: 4.80,
    popularity: 4.94,
  },
  {
    id: "2324bd31-7838-4486-9a9a-6c7409ba6d67",
    name: "National Museum of Fine Arts",
    description: "Argentina's premier art museum housing Latin American and European masterpieces.",
    category: "Museum",
    rating: 4.8,
    userRatingsTotal: 39496,
    qualityScore: 4.80,
    popularity: 4.60,
  },
  {
    id: "fd4ca673-d418-463f-a5f0-6b61538a14c1",
    name: "El Rosedal Garden",
    description: "Scenic garden within Palermo featuring extensive rose gardens and a picturesque lake.",
    category: "Garden",
    rating: 4.7,
    userRatingsTotal: 52594,
    qualityScore: 4.70,
    popularity: 4.72,
  },
  {
    id: "f1616716-08c4-46df-ae7d-b44a6fc6001b",
    name: "Tres de Febrero Park",
    description: "Large urban park featuring green spaces, rose garden, boating, and a planetarium.",
    category: "Park",
    rating: 4.7,
    userRatingsTotal: 40117,
    qualityScore: 4.70,
    popularity: 4.60,
  },
  {
    id: "ec2914de-0c09-4448-b4f3-b18a173776ea",
    name: "Obelisk",
    description: "Iconic limestone monument unveiled in 1936, symbol of Buenos Aires.",
    category: "Landmark",
    rating: 4.6,
    userRatingsTotal: 182356,
    qualityScore: 4.60,
    popularity: 5.26,
  },
  {
    id: "fe237950-78b9-4907-b5f0-7cf049d9cadc",
    name: "Plaza de Mayo",
    description: "Historic city square significant to Argentina's independence movement in 1810.",
    category: "Landmark",
    rating: 4.6,
    userRatingsTotal: 141298,
    qualityScore: 4.60,
    popularity: 5.15,
  },
  {
    id: "eb10b806-c68d-4384-a2d2-04f4b3ce6086",
    name: "Jardín Japonés",
    description: "Japanese-themed garden featuring traditional landscaping and ornamental ponds.",
    category: "Garden",
    rating: 4.6,
    userRatingsTotal: 134928,
    qualityScore: 4.60,
    popularity: 5.13,
  },
  {
    id: "0d2b1489-879e-465f-9d8e-7570dee8b949",
    name: "Museo de Arte Latinoamericano de Buenos Aires",
    description: "A contemporary art museum showcasing Latin American art and design.",
    category: "Museum",
    rating: 4.6,
    userRatingsTotal: 39901,
    qualityScore: 4.60,
    popularity: 4.60,
  },
  {
    id: "e84bbaf9-f136-46b1-8389-4a797bd18580",
    name: "Caminito",
    description: "A famous pedestrian street in La Boca known for colorful buildings and tango heritage.",
    category: "Neighborhood",
    rating: 4.6,
    userRatingsTotal: 14682,
    qualityScore: 4.60,
    popularity: 4.17,
  },
  {
    id: "b7a5f642-56bb-40ad-93a6-3b25fd61cdda",
    name: "Café Tortoni",
    description: "A historic café established in 1858, known for its Belle Époque interior.",
    category: "Café",
    rating: 4.5,
    userRatingsTotal: 39901,
    qualityScore: 4.50,
    popularity: 4.60,
  },
  {
    id: "22e3abd5-7e47-4213-b4e5-46571c9f5343",
    name: "Puny - Pasta & Grill",
    description: "A popular restaurant featuring contemporary Argentine cuisine and wood-fired grilled meats.",
    category: "Restaurant",
    rating: 4.9,
    userRatingsTotal: 46900,
    qualityScore: 4.90,
    popularity: 4.67,
  },
  {
    id: "fd5cc1fe-6c8b-4306-908c-76c43d0aec06",
    name: "Palacio Barolo",
    description: "An iconic 1923 building featuring neogothic and art deco architecture.",
    category: "Landmark",
    rating: 4.6,
    userRatingsTotal: 29040,
    qualityScore: 4.60,
    popularity: 4.46,
  },
  {
    id: "82ef5d74-d713-41a7-8f32-6758c072e547",
    name: "Piazzolla Tango",
    description: "An intimate tango theater featuring live performances of traditional and modern tango.",
    category: "Entertainment",
    rating: 4.6,
    userRatingsTotal: 3460,
    qualityScore: 4.58,
    popularity: 3.54,
  },
  {
    id: "8f2cc484-dfde-458f-b582-d7adc406530f",
    name: "Backroom Bar",
    description: "Sophisticated cocktail bar with an attached bookstore and regular jazz performances.",
    category: "Bar/Entertainment",
    rating: 4.6,
    userRatingsTotal: 3684,
    qualityScore: 4.59,
    popularity: 3.57,
  },
  {
    id: "dcc7a331-3290-457e-9bbd-1b8015ad719a",
    name: "Parque Lezama",
    description: "Landscaped urban park featuring monuments, statuary, and tree-lined walkways.",
    category: "Park",
    rating: 4.5,
    userRatingsTotal: 61550,
    qualityScore: 4.50,
    popularity: 4.79,
  },
  {
    id: "eecc463a-e681-4e30-91a7-942777606045",
    name: "El Zanjón de Granados",
    description: "A restored colonial building from 1685 featuring archaeological exhibits.",
    category: "Museum",
    rating: 4.8,
    userRatingsTotal: 5117,
    qualityScore: 4.79,
    popularity: 3.71,
  },
  {
    id: "a4de77bc-2044-4f75-8d69-bc3394a72cd6",
    name: "Buenos Aires Metropolitan Cathedral",
    description: "Historic cathedral dating to the early 17th century, former seat of Pope Francis.",
    category: "Church",
    rating: 4.7,
    userRatingsTotal: 9297,
    qualityScore: 4.69,
    popularity: 3.97,
  },
  {
    id: "87117260-e3cb-44d6-a9ec-0f8fd0b478e3",
    name: "Mural Diego Maradona",
    description: "A large street mural honoring football legend Diego Maradona.",
    category: "Street Art",
    rating: 4.8,
    userRatingsTotal: 506,
    qualityScore: 4.68,
    popularity: 2.71,
  },
  {
    id: "5e9b2610-4ef7-45d4-890b-86dd585c70d6",
    name: "Jardín Botánico Carlos Thays",
    description: "A 7-hectare botanical garden featuring diverse plant collections and sculptures.",
    category: "Garden",
    rating: 4.6,
    userRatingsTotal: 65518,
    qualityScore: 4.60,
    popularity: 4.82,
  },
];

// --- Real user preferences from DB (owner b421804c...) ---
const USER_PREFS: UserPreferencesForScoring = {
  interests: ["Aire libre", "Vistas", "Paseo"],
  pace: "intense",
  budget: "under_50",
  travelStylePrompt: null,
};

// --- Real trip route_customization_prompt from DB ---
const TRIP_PROMPT =
  "Queremos caminar poco, priorizar clásicos y dejar margen para café.";

async function main() {
  console.log("=== Place Scoring Manual Test (Buenos Aires — Real DB Data) ===\n");
  console.log(`Places: ${PLACES.length}`);
  console.log(`User interests: ${USER_PREFS.interests.join(", ")}`);
  console.log(`Pace: ${USER_PREFS.pace} | Budget: ${USER_PREFS.budget}`);
  console.log(`Trip prompt: "${TRIP_PROMPT}"\n`);

  console.log("Calling Claude for scoring...\n");
  const start = Date.now();

  const scored = await scorePlaces({
    places: PLACES,
    userPreferences: USER_PREFS,
    tripCustomizationPrompt: TRIP_PROMPT,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s\n`);

  console.log("--- Results (sorted by score) ---\n");
  console.log(
    "Score | Rating | QS   | Pop  | Place                                       | Category           | Reasoning",
  );
  console.log(
    "------|--------|------|------|---------------------------------------------|--------------------|----------",
  );
  for (const s of scored) {
    const place = PLACES.find((p) => p.id === s.id);
    const name = (place?.name ?? "???").padEnd(43);
    const cat = (place?.category ?? "???").padEnd(18);
    const rating = (place?.rating?.toFixed(1) ?? " n/a").padStart(4);
    const qs = (place?.qualityScore?.toFixed(2) ?? " n/a").padStart(4);
    const pop = (place?.popularity?.toFixed(2) ?? " n/a").padStart(4);
    console.log(
      `  ${String(s.score).padStart(3)} |  ${rating} | ${qs} | ${pop} | ${name} | ${cat} | ${s.reasoning}`,
    );
  }

  const top15 = scored.slice(0, 15);
  console.log(
    `\n--- Top 15 for solver ---\n${top15.map((s, i) => `  ${i + 1}. ${PLACES.find((p) => p.id === s.id)?.name} (score: ${s.score})`).join("\n")}`,
  );

  console.log(
    `\n--- Dropped (below top 15) ---\n${scored.slice(15).map((s) => `  - ${PLACES.find((p) => p.id === s.id)?.name} (score: ${s.score})`).join("\n")}`,
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
