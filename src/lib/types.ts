import { PaymentMethod, PaymentType, BirdSex, UserStatus, UserRole } from "@/generated/prisma/enums";

export { PaymentMethod, PaymentType, BirdSex, UserStatus, UserRole };

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

export interface RaceType {
  id: string;
  name: string;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeScheme {
  id: string;
  name: string;
  description: string | null;
  entryFee: number;
  isRefundable: boolean;
  maxBirds: number;
  feesCutPercent: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  perchFeeItems?: PerchFeeItem[];
  raceTypes?: RaceTypeFeeScheme[];
  events?: Event[];
  createdBy?: User;
}

export interface PerchFeeItem {
  feeSchemeId: string;
  birdNo: number;
  fee: number;
  feeScheme?: FeeScheme;
}

export interface RaceTypeFeeScheme {
  feeSchemeId: string;
  raceTypeId: string;
  fee: number;
  raceType?: RaceType;
  feeScheme?: FeeScheme;
}

export interface PrizeScheme {
  prizeSchemeId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: User;
  events?: Event[];
  prizeSchemeItems?: PrizeSchemeItem[];
}

export interface PrizeSchemeItem {
  prizeSchemeId: string;
  raceTypeId: string;
  fromPosition: number;
  toPosition: number;
  prizeAmount: number;
  prizeScheme?: PrizeScheme;
  raceType?: RaceType;
}

export interface BettingScheme {
  bettingSchemeId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  bettingCutPercent: number;
  belgianShow1: number;
  belgianShow2: number;
  belgianShow3: number;
  belgianShow4: number;
  belgianShow5: number;
  belgianShow6: number;
  belgianShow7: number;
  standardShow1: number;
  standardShow2: number;
  standardShow3: number;
  standardShow4: number;
  standardShow5: number;
  wta1: number;
  wta2: number;
  wta3: number;
  wta4: number;
  wta5: number;
  events?: Event[];
  createdById: string;
  createdBy?: User;
}

export interface Payments {
  paymentId: string;
  amountPaid: number;
  amountToPay: number;
  currency: string;
  method: PaymentMethod;
  paidAt: string;
  description: string | null;
  eventInventoryId: string;
  eventInventory?: EventInventory;
  breederId: string;
  breeder?: User;
  paymentType: PaymentType;
  referenceNumber: string | null;
}

export interface EventType {
  eventTypeId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  events?: Event[];
}

export interface Event {
  eventId: string;
  name: string;
  shortName: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  bannerImage: string | null;
  logoImage: string | null;
  bannerImageKey: string | null;
  logoImageKey: string | null;
  isOpen: boolean;
  typeId: string;
  type?: EventType;
  feeSchemeId: string;
  feeScheme?: FeeScheme;
  prizeSchemeId: string;
  prizeScheme?: PrizeScheme;
  bettingSchemeId: string;
  bettingScheme?: BettingScheme;
  createdById: string;
  createdBy?: User;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  contactAddress: string | null;
  socialYt: string | null;
  socialFb: string | null;
  socialTwitter: string | null;
  socialInsta: string | null;
  races?: Race[];
  eventInventories?: EventInventory[];
}

export interface Bird {
  birdId: string;
  band: string;
  band1: string;
  band2: string;
  band3: string;
  band4: string;
  birdName: string;
  color: string;
  rfid: string | null;
  sex: BirdSex;
  isActive: boolean;
  isLost: boolean;
  lostDate: string | null;
  lostRaceId: string | null;
  lostRace?: Race;
  note: string | null;
  picture: string | null;
  breederId: string;
  breeder?: User;
  eventInventoryItems?: EventInventoryItem[];
  raceItems?: RaceItem[];
}

export interface EventInventory {
  eventInventoryId: string;
  registrationDate: string;
  reservedBirds: number;
  loft: string;
  note: string | null;
  eventId: string;
  event: Event;
  breederId: string;
  breeder: User;
  partners: User[];
  eventInventoryItems?: EventInventoryItem[];
  payments: Payments[];
}

export interface EventInventoryItem {
  eventInventoryItemId: string;
  birdId: string;
  eventInventoryId: string;
  eventInventory: EventInventory;
  bird: Bird;
  birdNo: number | null;
  arrivalTime: string | null;
  departureTime: string | null;
  perchFeeValue: number;
  entryFeeRefunded: boolean;
  entryFeePaid: boolean;
  isBackup: boolean;
  belgianShowBet1: boolean;
  belgianShowBet2: boolean;
  belgianShowBet3: boolean;
  belgianShowBet4: boolean;
  belgianShowBet5: boolean;
  belgianShowBet6: boolean;
  belgianShowBet7: boolean;
  standardShowBet1: boolean;
  standardShowBet2: boolean;
  standardShowBet3: boolean;
  standardShowBet4: boolean;
  standardShowBet5: boolean;
  wtaBet1: boolean;
  wtaBet2: boolean;
  wtaBet3: boolean;
  wtaBet4: boolean;
  wtaBet5: boolean;
  raceItems?: RaceItem[];
}

export interface Basket {
  basketId: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: User;
  basketNo: number;
  isRaceBasket: boolean;
  raceId: string;
  race?: Race;
  raceItems?: RaceItem[];
  loftItems?: RaceItem[];
}

export interface Race {
  raceId: string;
  raceTypeId: string;
  eventId: string;
  event?: Event;
  raceType?: RaceType;
  description: string | null;
  name: string;
  distance: number;
  releaseStation: string;
  releaseDate: string;
  sunriseTime: string;
  sunsetTime: string;
  arrivalTemperature: number | null;
  arrivalWind: string | null;
  arrivalWeather: string | null;
  releaseTemperature: number | null;
  releaseWind: string | null;
  releaseWeather: string | null;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  baskets?: Basket[];
  raceItems?: RaceItem[];
  birds?: Bird[];
}

export interface RaceItem {
  raceItemId: string;
  raceId: string;
  birdId: string;
  eventInventoryItemId: string;
  race?: Race;
  bird?: Bird;
  eventInventoryItem?: EventInventoryItem;
  isLoftBasketed: boolean;
  isRaceBasketed: boolean;
  raceBasketedAt: string | null;
  loftBasket?: Basket;
  loftBasketId: string | null;
  raceBasket?: Basket;
  raceBasketId: string | null;
  birdPosition: number | null;
  arrivalTime: string | null;
  speed: number | null;
  prizeValue: number | null;
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  breederId: string;
  breeder?: User;
}
