const raceTypes = {
  base: "/api/race-type",
  delete: (id: string) => `/api/race-type?id=${id}`,
};

const eventTypes = {
  base: "/api/event-type",
  delete: (eventTypeId: string) => `/api/event-type?eventTypeId=${eventTypeId}`,
};

export const apiEndpoints = {
  raceTypes,
  eventTypes
};
