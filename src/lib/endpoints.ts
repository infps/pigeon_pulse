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

const breeders = {
  base: "/api/admin/breeders",
  birds: (breederId: number | string) => `/api/admin/breeders/${breederId}/birds`,
};

const events = {
  base: "/api/admin/event",
};

const teams = {
  base: "/api/admin/team",
};

const eventInventory = {
  base: "/api/admin/event",
  byEvent: (eventId: number | string) => `/api/admin/event/${eventId}/event-inventory`,
  itemsByEvent: (eventId: number | string) => `/api/admin/event/${eventId}/event-inventory-items`,
};

const races = {
  base: "/api/admin/race",
  start: (raceId: number | string) => `/api/admin/race/${raceId}/start`,
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
  eventDetails: (eventId: number | string) => `/api/breeder/events/${eventId}`,
  liveRaces: "/api/breeder/races/live",
  eventTypes: "/api/breeder/event-types",
  raceTypes: "/api/breeder/race-types",
  feeSchemes: "/api/breeder/fee-schemes",
  prizeSchemes: "/api/breeder/prize-schemes",
  bettingSchemes: "/api/breeder/betting-schemes",
  races: "/api/breeder/races",
  teams: "/api/breeder/teams",
  eventInventoryItems: (eventId: number | string) => `/api/breeder/event/${eventId}/inventory-items`,
  eventInventory: (eventId: number | string) => `/api/breeder/event/${eventId}/inventory`,
  raceItems: (raceId: number | string) => `/api/breeder/races/${raceId}/items`,
};

export const apiEndpoints = {
  raceTypes,
  eventTypes,
  feeSchemes,
  prizeSchemes,
  bettingSchemes,
  users,
  breeders,
  events,
  teams,
  eventInventory,
  races,
  baskets,
  raceItems,
  breeder,
};
