import type { OpeningWindow } from "./types";

export interface MockPlace {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  lat: number;
  lng: number;
  openingWindows: OpeningWindow[];
}

const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

function dailyWindows(
  days: number[],
  opensAt: number,
  closesAt: number
): OpeningWindow[] {
  return days.map((d) => ({ dayOfWeek: d, opensAt, closesAt }));
}

export const MOCK_PLACES_PARIS: MockPlace[] = [
  {
    id: "tour-eiffel",
    name: "Tour Eiffel",
    category: "Historia",
    durationMinutes: 120,
    lat: 48.8584,
    lng: 2.2945,
    openingWindows: dailyWindows(ALL_WEEK, 540, 1440), // 09:00-24:00
  },
  {
    id: "louvre",
    name: "Musée du Louvre",
    category: "Arte",
    durationMinutes: 240,
    lat: 48.8606,
    lng: 2.3376,
    openingWindows: dailyWindows([1, 2, 3, 4, 5, 6], 540, 1080), // 09:00-18:00, closed Sun
  },
  {
    id: "notre-dame",
    name: "Cathédrale Notre-Dame",
    category: "Historia",
    durationMinutes: 90,
    lat: 48.853,
    lng: 2.3499,
    openingWindows: dailyWindows(ALL_WEEK, 480, 1140), // 08:00-19:00
  },
  {
    id: "sacre-coeur",
    name: "Sacré-Cœur",
    category: "Historia",
    durationMinutes: 60,
    lat: 48.8867,
    lng: 2.3431,
    openingWindows: dailyWindows(ALL_WEEK, 360, 1380), // 06:00-23:00
  },
  {
    id: "montmartre",
    name: "Montmartre",
    category: "Paseo",
    durationMinutes: 90,
    lat: 48.8862,
    lng: 2.3411,
    openingWindows: [], // always open
  },
  {
    id: "orsay",
    name: "Musée d'Orsay",
    category: "Arte",
    durationMinutes: 150,
    lat: 48.86,
    lng: 2.3266,
    openingWindows: dailyWindows([2, 3, 4, 5, 6, 0], 570, 1080), // 09:30-18:00, closed Mon
  },
  {
    id: "champs-elysees",
    name: "Champs-Élysées",
    category: "Paseo",
    durationMinutes: 60,
    lat: 48.8698,
    lng: 2.3078,
    openingWindows: [], // always open
  },
  {
    id: "arc-triomphe",
    name: "Arc de Triomphe",
    category: "Historia",
    durationMinutes: 45,
    lat: 48.8738,
    lng: 2.295,
    openingWindows: dailyWindows(ALL_WEEK, 600, 1380), // 10:00-23:00
  },
  {
    id: "jardin-luxembourg",
    name: "Jardin du Luxembourg",
    category: "Aire libre",
    durationMinutes: 75,
    lat: 48.8462,
    lng: 2.3372,
    openingWindows: [], // always open
  },
  {
    id: "marais",
    name: "Le Marais",
    category: "Paseo",
    durationMinutes: 90,
    lat: 48.8566,
    lng: 2.3622,
    openingWindows: [], // always open
  },
  {
    id: "cafe-de-flore",
    name: "Café de Flore",
    category: "Café",
    durationMinutes: 60,
    lat: 48.854,
    lng: 2.3326,
    openingWindows: dailyWindows(ALL_WEEK, 420, 1380), // 07:00-23:00
  },
  {
    id: "le-bouillon-chartier",
    name: "Le Bouillon Chartier",
    category: "Restaurante",
    durationMinutes: 75,
    lat: 48.8719,
    lng: 2.3448,
    openingWindows: dailyWindows(ALL_WEEK, 690, 1380), // 11:30-23:00
  },
  {
    id: "chez-janou",
    name: "Chez Janou",
    category: "Restaurante",
    durationMinutes: 60,
    lat: 48.8571,
    lng: 2.3651,
    openingWindows: dailyWindows(ALL_WEEK, 720, 1380), // 12:00-23:00
  },
];

export const MOCK_PLACES_MADRID: MockPlace[] = [
  {
    id: "palacio-real",
    name: "Palacio Real",
    category: "Historia",
    durationMinutes: 120,
    lat: 40.417955,
    lng: -3.714312,
    openingWindows: dailyWindows([1, 2, 3, 4, 5, 6], 600, 1080), // 10:00-18:00
  },
  {
    id: "plaza-mayor",
    name: "Plaza Mayor",
    category: "Clásico",
    durationMinutes: 60,
    lat: 40.415511,
    lng: -3.707399,
    openingWindows: [], // always open
  },
  {
    id: "mercado-san-miguel",
    name: "Mercado de San Miguel",
    category: "Gastro",
    durationMinutes: 60,
    lat: 40.415397,
    lng: -3.708973,
    openingWindows: dailyWindows(ALL_WEEK, 600, 1440), // 10:00-24:00
  },
  {
    id: "prado",
    name: "Museo del Prado",
    category: "Arte",
    durationMinutes: 180,
    lat: 40.413782,
    lng: -3.692127,
    openingWindows: dailyWindows([1, 2, 3, 4, 5, 6], 600, 1200), // 10:00-20:00
  },
  {
    id: "retiro",
    name: "Parque del Retiro",
    category: "Aire libre",
    durationMinutes: 90,
    lat: 40.41526,
    lng: -3.684649,
    openingWindows: [], // always open
  },
  {
    id: "reina-sofia",
    name: "Museo Reina Sofía",
    category: "Arte",
    durationMinutes: 120,
    lat: 40.407912,
    lng: -3.694431,
    openingWindows: dailyWindows([1, 2, 3, 4, 5, 6], 600, 1260), // 10:00-21:00
  },
  {
    id: "barrio-letras",
    name: "Barrio de las Letras",
    category: "Paseo",
    durationMinutes: 90,
    lat: 40.414041,
    lng: -3.697644,
    openingWindows: [], // always open
  },
  {
    id: "templo-debod",
    name: "Templo de Debod",
    category: "Vistas",
    durationMinutes: 60,
    lat: 40.424021,
    lng: -3.717769,
    openingWindows: dailyWindows([2, 3, 4, 5, 6, 0], 600, 1140), // 10:00-19:00, closed Mon
  },
  {
    id: "gran-via",
    name: "Gran Vía",
    category: "Paseo",
    durationMinutes: 60,
    lat: 40.420043,
    lng: -3.701807,
    openingWindows: [], // always open
  },
  {
    id: "bernabeu",
    name: "Estadio Santiago Bernabéu",
    category: "Fútbol",
    durationMinutes: 120,
    lat: 40.453054,
    lng: -3.688344,
    openingWindows: dailyWindows(ALL_WEEK, 570, 1140), // 09:30-19:00
  },
  {
    id: "sobrino-botin",
    name: "Sobrino de Botín",
    category: "Restaurante",
    durationMinutes: 75,
    lat: 40.4146,
    lng: -3.7085,
    openingWindows: dailyWindows(ALL_WEEK, 780, 1380), // 13:00-23:00
  },
  {
    id: "lateral-castellana",
    name: "Lateral Castellana",
    category: "Restaurante",
    durationMinutes: 60,
    lat: 40.4318,
    lng: -3.6903,
    openingWindows: dailyWindows(ALL_WEEK, 720, 1440), // 12:00-24:00
  },
];

export const MOCK_CITIES: Record<string, MockPlace[]> = {
  madrid: MOCK_PLACES_MADRID,
  paris: MOCK_PLACES_PARIS,
};

export const MOCK_PLACES = MOCK_PLACES_MADRID;

export const MOCK_TRIP = {
  startsOn: "2026-06-12",
  endsOn: "2026-06-14",
};
