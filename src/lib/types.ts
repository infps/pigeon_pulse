import { UserStatus, UserRole } from "@/generated/prisma/enums";

export { UserStatus, UserRole };

// ============================================================
// AUTH
// ============================================================

export interface User {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  imageKey: string | null;
  createdAt: string;
  updatedAt: string;
  username: string | null;
  displayUsername: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  phoneNumber: string | null;
  webAddress: string | null;
  ssn: string | null;
  status: UserStatus;
  statusDate: string;
  note: string | null;
  role: UserRole;
  taxNumber: string | null;
}

// ============================================================
// LEGACY PEOPLE
// ============================================================

export interface Breeder {
  id: number;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  cell: string | null;
  country: string | null;
  address1: string | null;
  city1: string | null;
  state1: string | null;
  zip1: string | null;
  webAddress: string | null;
  ssn: string | null;
  taxNumber: string | null;
  loginName: string | null;
  note: string | null;
  number: number | null;
  status: number | null;
  statusDate: string | null;
  pictureId: number | null;
  // UI compat aliases
  name?: string | null;
  image?: string | null;
  state?: string | null;
}

export interface OrganizerData {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  cell: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  web: string | null;
  note: string | null;
  password: string | null;
}

// ============================================================
// SCHEMES
// ============================================================

export interface RaceType {
  id: number;
  name: string | null;
  numberGroupId: number | null;
}

export interface FeeScheme {
  id: number;
  name: string | null;
  entryFee: number | null;
  isRefundable: number | null;
  maxBirdCount: number | null;
  feesCutPercent: number | null;
  minEntryFees: number | null;
  maxBackupBirdCount: number | null;
  isFloatingBackup: number | null;
  hotSpot1Fee: number | null;
  hotSpot2Fee: number | null;
  hotSpot3Fee: number | null;
  hotSpotFinalFee: number | null;
  raceFeeMode: "PER_BIRD_PER_RACE" | "FLAT_PER_RACE";
  createdById: number | null;
  createdBy?: OrganizerData;
  birdFeeItems?: BirdFeeItem[];
  raceTypeFees?: RaceTypeFeeScheme[];
  events?: Event[];
  // UI compat aliases
  maxBirds?: number | null;
  birdFee?: number | null;
}

export interface BirdFeeItem {
  id: number;
  birdNo: number | null;
  feeSchemeId: number | null;
  birdFee: number | null;
  feeScheme?: FeeScheme;
  // UI compat aliases
  fee?: number | null;
}

export interface RaceTypeFeeScheme {
  feeSchemeId: number;
  raceTypeId: number;
  fee: number;
  raceType?: RaceType;
  feeScheme?: FeeScheme;
}

export interface PrizeScheme {
  id: number;
  name: string | null;
  createdById: number | null;
  createdBy?: OrganizerData;
  prizeSchemeItems?: PrizeSchemeItem[];
  // UI compat aliases
  prizeSchemeId?: number;
}

export interface PrizeSchemeItem {
  id: number;
  prizeSchemeId: number | null;
  fromPosition: number | null;
  toPosition: number | null;
  prizeValue: number | null;
  prizeScheme?: PrizeScheme;
}

export interface BettingScheme {
  id: number;
  name: string | null;
  bettingCutPercent: number | null;
  belgianShow1: number | null;
  belgianShow2: number | null;
  belgianShow3: number | null;
  belgianShow4: number | null;
  belgianShow5: number | null;
  belgianShow6: number | null;
  belgianShow7: number | null;
  standardShow1: number | null;
  standardShow2: number | null;
  standardShow3: number | null;
  standardShow4: number | null;
  standardShow5: number | null;
  standardShow6: number | null;
  wta1: number | null;
  wta2: number | null;
  wta3: number | null;
  wta4: number | null;
  wta5: number | null;
  createdById: number | null;
  createdBy?: OrganizerData;
  standardShowPercentages?: StandardShowPercentage[];
  events?: Event[];
  // UI compat aliases
  bettingSchemeId?: number;
}

export interface StandardShowPercentage {
  id: number;
  bettingSchemeId: number | null;
  place: number | null;
  percValue: number | null;
}

// ============================================================
// EVENTS
// ============================================================

export interface EventType {
  id: number;
  name: string | null;
  description: string | null;
}

export interface Event {
  id: number;
  name: string | null;
  shortName: string | null;
  eventDate: string | null;
  eventTypeId: number | null;
  eventType?: EventType;
  isOpen: number | null;
  feeSchemeId: number | null;
  bettingSchemeId: number | null;
  finalPrizeSchemeId: number | null;
  hotSpot1PrizeSchemeId: number | null;
  hotSpot2PrizeSchemeId: number | null;
  hotSpot3PrizeSchemeId: number | null;
  hotSpotAvgPrizeSchemeId: number | null;
  createdById: number | null;
  createdBy?: OrganizerData;
  feeScheme?: FeeScheme;
  bettingScheme?: BettingScheme;
  finalPrize?: PrizeScheme;
  races?: Race[];
  eventInventories?: EventInventory[];
  // UI compat aliases
  description: string | null;
  endDate: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  contactAddress: string | null;
  socialYt: string | null;
  socialFb: string | null;
  socialTwitter: string | null;
  socialInsta: string | null;
  logoImage: string | null;
  logoImageKey: string | null;
  bannerImage: string | null;
  bannerImageKey: string | null;
}

export interface EventInventory {
  id: number;
  eventId: number | null;
  breederId: number | null;
  reservedBirds: number | null;
  loft: string | null;
  note: string | null;
  signInDate: string | null;
  isWaiting: number | null;
  waitingDate: string | null;
  event?: Event;
  breeder?: Breeder;
  items?: EventInventoryItem[];
  partners?: Partner[];
  payments?: Payment[];
}

export interface EventInventoryItem {
  id: number;
  birdId: number | null;
  eventInventoryId: number | null;
  replacedItemId: number | null;
  birdNo: number | null;
  arrivalDate: string | null;
  departureDate: string | null;
  entryFeeValue: number | null;
  entryFeePaid: number | null;
  entryRefund: number | null;
  perchFeeValue: number | null;
  hotSpotFeeValue: number | null;
  raceFeeValue: number | null;
  hotSpotRefund: number | null;
  betsRefund: number | null;
  isBackup: number | null;
  isBetActive: number | null;
  transferDue: number | null;
  belgianShowBet1: number | null;
  belgianShowBet2: number | null;
  belgianShowBet3: number | null;
  belgianShowBet4: number | null;
  belgianShowBet5: number | null;
  belgianShowBet6: number | null;
  belgianShowBet7: number | null;
  standardShowBet1: number | null;
  standardShowBet2: number | null;
  standardShowBet3: number | null;
  standardShowBet4: number | null;
  standardShowBet5: number | null;
  standardShowBet6: number | null;
  wtaBet1: number | null;
  wtaBet2: number | null;
  wtaBet3: number | null;
  wtaBet4: number | null;
  wtaBet5: number | null;
  eventInventory?: EventInventory;
  bird?: Bird;
  raceItems?: RaceItem[];
  // UI compat aliases
  arrivalTime?: string | null;
  departureTime?: string | null;
}

export interface Partner {
  breederId: number;
  eventInventoryId: number;
  breeder?: Breeder;
  eventInventory?: EventInventory;
}

export interface Payment {
  id: number;
  eventInventoryId: number | null;
  breederId: number | null;
  pictureId: number | null;
  paymentValue: number | null;
  paymentMethod: number | null;
  paymentType: number | null;
  paymentDate: string | null;
  paymentTimestamp: string | null;
  paymentDesc: string | null;
  transactionId: string | null;
  status: number | null;
  eventInventory?: EventInventory;
  breeder?: Breeder;
}

// ============================================================
// RACES
// ============================================================

export interface Race {
  id: number;
  raceTypeId: number | null;
  eventId: number | null;
  raceNumber: number | null;
  description: string | null;
  distance: number | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  sunrise: string | null;
  sunset: string | null;
  temperature: string | null;
  weather: string | null;
  wind: string | null;
  arrivalTemperature: string | null;
  arrivalWeather: string | null;
  arrivalWind: string | null;
  isClosed: number | null;
  event?: Event;
  raceType?: RaceType;
  raceItems?: RaceItem[];
  baskets?: Basket[];
}

export interface RaceItem {
  id: number;
  raceId: number | null;
  inventoryItemId: number | null;
  distBasketId: number | null;
  raceBasketId: number | null;
  isDistBasketed: number | null;
  isLost: number | null;
  lostRaceId: number | null;
  raceBasketTime: string | null;
  race?: Race;
  inventoryItem?: EventInventoryItem;
  result?: RaceItemResult;
  // UI compat aliases
  bird?: Bird;
  status?: string | null;
  speed?: number | null;
  eventInventoryItem?: EventInventoryItem;
  birdPosition?: number | null;
  arrivalTime?: string | null;
  isLoftBasketed?: boolean | number | null;
  isRaceBasketed?: boolean | number | null;
  loftBasket?: Basket;
  raceBasket?: Basket;
  raceItemId?: number;
  distBasket?: Basket;
}

export interface RaceItemResult {
  raceItemId: number;
  arrivalTime: string | null;
  birdDrop: number | null;
  birdPosition: number | null;
  birdPositionHotSpot: number | null;
  prizeValue: number | null;
}

// ============================================================
// BIRDS
// ============================================================

export interface Bird {
  id: number;
  band: string | null;
  band1: string | null;
  band2: string | null;
  band3: string | null;
  band4: string | null;
  birdName: string | null;
  color: string | null;
  rfid: string | null;
  sex: number | null;
  isActive: number | null;
  isLost: number | null;
  lostDate: string | null;
  lostRaceId: number | null;
  note: string | null;
  pictureId: number | null;
  breederId: number | null;
  breeder?: Breeder;
  inventoryItems?: EventInventoryItem[];
}

// ============================================================
// OTHER
// ============================================================

export interface Basket {
  id: number;
  basketNo: number | null;
  capacity: number | null;
  raceId: number | null;
  isRaceBasket: number | null;
  race?: Race;
  distItems?: RaceItem[];
  raceItems?: RaceItem[];
  // UI compat aliases
  basketId?: number;
}

export interface Team {
  id: number;
  name: string | null;
  breederId: number | null;
  breeder?: Breeder;
}

export interface RfidScan {
  id: number;
  rfidTag: string;
  scannerId: string;
  timestamp: string;
  processed: boolean;
  birdId: number | null;
  raceId: number | null;
  notes: string | null;
  createdAt: string;
  bird?: Bird;
  race?: Race;
}
