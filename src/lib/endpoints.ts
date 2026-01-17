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
  start: (raceId: string) => `/api/admin/race/${raceId}/start`,
};

const baskets = {
  base: "/api/admin/basket",
  byId: "/api/admin/basket/:basketId",
};

const raceItems = {
  base: "/api/admin/race-item",
  basket: "/api/admin/race-item/basket",
};

const breeder = {
  events: "/api/breeder/events",
  eventDetails: "/api/breeder/events/[eventId]",
  liveRaces: "/api/breeder/races/live",
  eventTypes: "/api/breeder/event-types",
  raceTypes: "/api/breeder/race-types",
  feeSchemes: "/api/breeder/fee-schemes",
  prizeSchemes: "/api/breeder/prize-schemes",
  bettingSchemes: "/api/breeder/betting-schemes",
  races: "/api/breeder/races",
  teams: "/api/breeder/teams",
  eventInventoryItems: (eventId: string) => `/api/breeder/event/${eventId}/inventory-items`,
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
  breeder,
};
