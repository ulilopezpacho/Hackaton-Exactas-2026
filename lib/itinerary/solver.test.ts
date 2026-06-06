import { solve } from "./solver";
import type { SolverInput, SolverPlace, SolverDay, TravelMatrix } from "./types";

const places: SolverPlace[] = [
  {
    id: "palacio-real",
    name: "Palacio Real",
    durationMinutes: 120,
    openingWindows: [
      { dayOfWeek: 1, opensAt: 600, closesAt: 1080 }, // Mon 10:00-18:00
      { dayOfWeek: 2, opensAt: 600, closesAt: 1080 }, // Tue
      { dayOfWeek: 3, opensAt: 600, closesAt: 1080 }, // Wed
    ],
  },
  {
    id: "museo-prado",
    name: "Museo del Prado",
    durationMinutes: 180,
    openingWindows: [
      { dayOfWeek: 1, opensAt: 600, closesAt: 1200 }, // Mon 10:00-20:00
      { dayOfWeek: 2, opensAt: 600, closesAt: 1200 },
      { dayOfWeek: 3, opensAt: 600, closesAt: 1200 },
    ],
  },
  {
    id: "plaza-mayor",
    name: "Plaza Mayor",
    durationMinutes: 60,
    openingWindows: [], // always open
  },
  {
    id: "retiro",
    name: "Parque del Retiro",
    durationMinutes: 90,
    openingWindows: [], // always open
  },
  {
    id: "templo-debod",
    name: "Templo de Debod",
    durationMinutes: 45,
    openingWindows: [
      { dayOfWeek: 2, opensAt: 600, closesAt: 1140 }, // Tue only 10:00-19:00
    ],
  },
];

const mealPlaces: SolverPlace[] = [
  {
    id: "mercado-san-miguel",
    name: "Mercado de San Miguel",
    durationMinutes: 60,
    openingWindows: [
      { dayOfWeek: 1, opensAt: 600, closesAt: 1440 },
      { dayOfWeek: 2, opensAt: 600, closesAt: 1440 },
      { dayOfWeek: 3, opensAt: 600, closesAt: 1440 },
    ],
  },
  {
    id: "sobrino-botin",
    name: "Sobrino de Botín",
    durationMinutes: 75,
    openingWindows: [
      { dayOfWeek: 1, opensAt: 780, closesAt: 1380 }, // 13:00-23:00
      { dayOfWeek: 2, opensAt: 780, closesAt: 1380 },
      { dayOfWeek: 3, opensAt: 780, closesAt: 1380 },
    ],
  },
];

const travelMatrix: TravelMatrix = {};
const allIds = [...places, ...mealPlaces].map((p) => p.id);
for (const a of allIds) {
  travelMatrix[a] = {};
  for (const b of allIds) {
    travelMatrix[a][b] = a === b ? 0 : 10 + Math.floor(Math.random() * 15);
  }
}
// fix symmetry
for (const a of allIds) {
  for (const b of allIds) {
    travelMatrix[b][a] = travelMatrix[a][b];
  }
}

const days: SolverDay[] = [
  { date: "2026-06-15", dayOfWeek: 1 }, // Monday
  { date: "2026-06-16", dayOfWeek: 2 }, // Tuesday
  { date: "2026-06-17", dayOfWeek: 3 }, // Wednesday
];

const input: SolverInput = {
  places,
  mealPlaces,
  days,
  travelMatrix,
  config: {
    dayStartTime: 9 * 60,  // 09:00
    dayEndTime: 22 * 60,    // 22:00
    mealIntervalMinutes: 240,
  },
};

console.log("Running solver with 5 places, 2 meal places, 3 days...\n");
const t0 = Date.now();
const result = solve(input);
const elapsed = Date.now() - t0;

console.log(`Score: ${result.score}`);
console.log(`Time: ${elapsed}ms`);
console.log(`Unplaced: ${result.unplacedPlaces.length > 0 ? result.unplacedPlaces.join(", ") : "none"}\n`);

for (const day of result.days) {
  console.log(`=== Day ${day.dayIndex + 1} (${days[day.dayIndex].date}) ===`);
  for (const item of day.items) {
    const start = `${String(Math.floor(item.startMinute / 60)).padStart(2, "0")}:${String(item.startMinute % 60).padStart(2, "0")}`;
    const end = `${String(Math.floor(item.endMinute / 60)).padStart(2, "0")}:${String(item.endMinute % 60).padStart(2, "0")}`;
    const badge = item.type === "place" ? "📍" : item.type === "transfer" ? "🚶" : "💡";
    console.log(`  ${badge} ${start}-${end}  ${item.title}  [${item.type}]`);
  }
  console.log();
}

// Validations
let errors = 0;

for (const day of result.days) {
  for (let i = 1; i < day.items.length; i++) {
    if (day.items[i].startMinute < day.items[i - 1].endMinute) {
      console.error(`ERROR: overlap on day ${day.dayIndex + 1} between items ${i - 1} and ${i}`);
      errors++;
    }
  }
  for (const item of day.items) {
    if (item.startMinute < input.config.dayStartTime) {
      console.error(`ERROR: item starts before day start on day ${day.dayIndex + 1}`);
      errors++;
    }
    if (item.endMinute > input.config.dayEndTime) {
      console.error(`ERROR: item ends after day end on day ${day.dayIndex + 1}`);
      errors++;
    }
  }
}

const placedIds = new Set<string>();
for (const day of result.days) {
  for (const item of day.items) {
    if (item.type === "place" && item.placeId) placedIds.add(item.placeId);
  }
}
for (const p of places) {
  if (!placedIds.has(p.id) && !result.unplacedPlaces.includes(p.id)) {
    console.error(`ERROR: place ${p.id} neither placed nor listed as unplaced`);
    errors++;
  }
}

console.log(errors === 0 ? "✅ All validations passed" : `❌ ${errors} error(s) found`);
