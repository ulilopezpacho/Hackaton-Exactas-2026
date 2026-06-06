export type TripStatus = "draft" | "upcoming" | "completed";

export type TripOverview = {
  city: string;
  country: string;
  dates: string;
  days: string;
  href: string;
  id: string;
  places: string;
  placeCount: number;
  startsOn: string;
  status: TripStatus;
  stripeClass: string;
  tone: string;
  updatedAt: string;
};

export type TripsOverview = {
  recentTrips: TripOverview[];
  stats: {
    drafts: number;
    places: number;
    trips: number;
  };
  trips: TripOverview[];
  upcomingTrip: TripOverview | null;
};
