const raceTypes = {
  base: "/api/race-type",
};

const eventTypes = {
  base: "/api/event-type",
};

const feeSchemes = {
  base: "/api/fee-scheme",
};

const prizeSchemes = {
  base: "/api/prize-scheme",
};

const bettingSchemes = {
  base: "/api/betting-scheme",
};

const users = {
  base: "/api/users",
};

const events = {
  base: "/api/event",
};

const teams = {
  base: "/api/team",
};

const eventInventory = {
  base: "/api/event",
  byEvent: (eventId: string) => `/api/event/${eventId}/event-inventory`,
  itemsByEvent: (eventId: string) => `/api/event/${eventId}/event-inventory-items`,
};

const races = {
  base: "/api/race",
};

export const apiEndpoints = {
  raceTypes,
  eventTypes,
  feeSchemes,
  prizeSchemes,
  bettingSchemes,
  users,
  events,
  teams,
  eventInventory,
  races,
};
