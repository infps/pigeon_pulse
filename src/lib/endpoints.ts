const raceTypes = {
  base: "/api/admin/race-type",
};

const eventTypes = {
  base: "/api/admin/event-type",
};

const feeSchemes = {
  base: "/api/admin/fee-scheme",
};

const prizeSchemes = {
  base: "/api/admin/prize-scheme",
};

const bettingSchemes = {
  base: "/api/admin/betting-scheme",
};

const users = {
  base: "/api/admin/users",
};

const events = {
  base: "/api/admin/event",
};

const teams = {
  base: "/api/admin/team",
};

const eventInventory = {
  base: "/api/admin/event",
  byEvent: (eventId: string) => `/api/admin/event/${eventId}/event-inventory`,
  itemsByEvent: (eventId: string) => `/api/admin/event/${eventId}/event-inventory-items`,
};

const races = {
  base: "/api/admin/race",
};

const baskets = {
  base: "/api/admin/basket",
  byId: "/api/admin/basket/:basketId",
};

const raceItems = {
  base: "/api/admin/race-item",
  basket: "/api/admin/race-item/basket",
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
  baskets,
  raceItems,
};
