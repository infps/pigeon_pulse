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

const adminBirds = {
  base: "/api/admin/birds",
  birdById: (birdId: number | string) => `/api/admin/bird/${birdId}`,
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
  addBirds: (eventId: number | string) => `/api/admin/event/${eventId}/add-birds`,
};

const races = {
  base: "/api/admin/race",
  start: (raceId: number | string) => `/api/admin/race/${raceId}/start`,
  end: (raceId: number | string) => `/api/admin/race/${raceId}/end`,
};

const raceItems = {
  base: "/api/admin/race-item",
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
  birds: "/api/breeder/birds",
  birdsBulk: "/api/breeder/birds/bulk",
  birdById: (birdId: number | string) => `/api/breeder/birds/${birdId}`,
  birdImage: (birdId: number | string) => `/api/breeder/birds/${birdId}/image`,
  payments: "/api/breeder/payments",
  eventInventoryItems: (eventId: number | string) => `/api/breeder/event/${eventId}/inventory-items`,
  eventInventory: (eventId: number | string) => `/api/breeder/event/${eventId}/inventory`,
  eventDefaulters: (eventId: number | string) => `/api/breeder/event/${eventId}/defaulters`,
  raceItems: (raceId: number | string) => `/api/breeder/races/${raceId}/items`,
  eventMessages: (eventId: number | string) => `/api/breeder/event/${eventId}/messages`,
  messages: "/api/breeder/messages",
};

const betting = {
  // breeder/bettor — per race
  bets: (raceId: number | string) => `/api/breeder/race/${raceId}/bet`,
  // admin — per race
  toggle: (raceId: number | string) => `/api/admin/race/${raceId}/betting/toggle`,
  pool: (raceId: number | string) => `/api/admin/race/${raceId}/betting/pool`,
  calculatePayouts: (raceId: number | string) =>
    `/api/admin/race/${raceId}/betting/calculate-payouts`,
  placeCashBet: (raceId: number | string) =>
    `/api/admin/race/${raceId}/betting/place-cash-bet`,
};

const eventMessages = {
  list: (eventId: number | string) => `/api/admin/event/${eventId}/messages`,
  byId: (eventId: number | string, messageId: number | string) =>
    `/api/admin/event/${eventId}/messages/${messageId}`,
};

const birds = {
  location: (birdId: number | string) => `/api/birds/${birdId}/location`,
  history: (birdId: number | string) => `/api/birds/${birdId}/history`,
};

const eventBaskets = {
  checkinStatus: (eventId: number | string) => `/api/admin/event/${eventId}/checkin-status`,
  checkin: (eventId: number | string) => `/api/admin/event/${eventId}/checkin`,
  list: (eventId: number | string) => `/api/admin/event/${eventId}/baskets`,
  generateLoft: (eventId: number | string) => `/api/admin/event/${eventId}/baskets/generate-loft`,
  scanLoft: (eventId: number | string) => `/api/admin/event/${eventId}/baskets/scan-loft`,
  assign: (eventId: number | string) => `/api/admin/event/${eventId}/baskets/assign`,
  assignRace: (eventId: number | string) => `/api/admin/event/${eventId}/baskets/assign-race`,
};

const birdStatusCodes = {
  base: "/api/admin/bird-status-codes",
};

const birdGroups = {
  base: (eventId: number | string) => `/api/admin/event/${eventId}/bird-groups`,
  byId: (eventId: number | string, id: number | string) => `/api/admin/event/${eventId}/bird-groups/${id}`,
  members: (eventId: number | string, id: number | string) => `/api/admin/event/${eventId}/bird-groups/${id}/members`,
  move: (eventId: number | string) => `/api/admin/event/${eventId}/bird-groups/move`,
};

const calcutta = {
  config: (eventId: number | string) => `/api/admin/event/${eventId}/calcutta/config`,
  generateGroups: (eventId: number | string) => `/api/admin/event/${eventId}/calcutta/generate-groups`,
  groups: (eventId: number | string) => `/api/admin/event/${eventId}/calcutta/groups`,
  earlyBuy: (eventId: number | string, groupId: number | string) => `/api/admin/event/${eventId}/calcutta/groups/${groupId}/early-buy`,
  setHouse: (eventId: number | string, groupId: number | string) => `/api/admin/event/${eventId}/calcutta/groups/${groupId}/set-house`,
  reprice: (eventId: number | string, groupId: number | string) => `/api/admin/event/${eventId}/calcutta/groups/${groupId}/reprice`,
  auctionStart: (eventId: number | string) => `/api/admin/event/${eventId}/calcutta/auction/start`,
  auctionClose: (eventId: number | string) => `/api/admin/event/${eventId}/calcutta/auction/close`,
  bid: (eventId: number | string) => `/api/calcutta/${eventId}/bid`,
  state: (eventId: number | string) => `/api/calcutta/${eventId}/state`,
};

export const apiEndpoints = {
  birdStatusCodes,
  birdGroups,
  calcutta,
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
  raceItems,
  breeder,
  eventBaskets,
  betting,
  eventMessages,
  birds,
  admin: {
    birds: adminBirds,
  },
};
