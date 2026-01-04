import { PaymentMethod, PaymentType } from "@/generated/prisma/enums";

// User Types
export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PROSPECT = "PROSPECT",
}

export enum UserRole {
  BREEDER = "BREEDER",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}

export interface User {
  id: string;
  name: string;
  lastName?: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  username?: string;
  displayUsername?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  phoneNumber?: string;
  webAddress?: string;
  ssn?: string;
  status: UserStatus;
  statusDate: string;
  note?: string;
  role: UserRole;
  taxNumber?: string;
}

export interface Payment{
        method: PaymentMethod;
        eventInventoryId: string;
        breederId: string;
        description: string | null;
        paymentId: string;
        amountPaid: number;
        amountToPay: number;
        currency: string;
        paidAt: Date;
        paymentType: PaymentType;
        referenceNumber: string | null;
}
export interface EventInventoryItem {
  eventInventoryId: string;
  registrationDate: string;
  reservedBirds: number;
  loft: string;
  note?: string;
  eventId: string;
  breederId: string;
  breeder: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image: string | null;
        username: string | null;
        lastName: string | null;
        imageKey: string | null;
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
        statusDate: Date;
        note: string | null;
        role: UserRole;
        taxNumber: string | null;
    };
    payments: Payment[];
    eventInventoryItems?: any[];
}

export interface EventInventoryItemDetail {
  eventInventoryItemId: string;
  birdId: string;
  eventInventoryId: string;
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
  bird: {
    birdId: string;
    band: string;
    band1: string;
    band2: string;
    band3: string;
    band4: string;
    birdName: string;
    color: string;
    rfid: string | null;
    sex: string;
    isActive: boolean;
    isLost: boolean;
    lostDate: string | null;
    lostRaceId: string | null;
    note: string | null;
    picture: string | null;
    breederId: string;
  };
  eventInventory: {
    eventInventoryId: string;
    registrationDate: string;
    reservedBirds: number;
    loft: string;
    note: string | null;
    eventId: string;
    breederId: string;
    breeder: {
      id: string;
      name: string;
      lastName: string | null;
      email: string;
    };
  };
}

export interface UsersResponse {
  users: User[];
  message: string;
}

export interface UserResponse {
  user: User;
  message: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  lastName?: string;
  username?: string;
  displayUsername?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  phoneNumber?: string;
  webAddress?: string;
  ssn?: string;
  status?: UserStatus;
  role?: UserRole;
  taxNumber?: string;
  note?: string;
}

export interface UpdateUserInput {
  id: string;
  name?: string;
  lastName?: string;
  username?: string;
  displayUsername?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  phoneNumber?: string;
  webAddress?: string;
  ssn?: string;
  status?: UserStatus;
  role?: UserRole;
  taxNumber?: string;
  note?: string;
}

export interface DeleteUserInput {
  id: string;
}

// Race Type Types
export interface RaceType {
  id: string;
  name: string;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RaceTypesResponse {
  raceTypes: RaceType[];
  message: string;
}

export interface CreateRaceTypeInput {
  name: string;
  isPaid: boolean;
}

export interface UpdateRaceTypeInput extends CreateRaceTypeInput {
  id: string;
}

export interface DeleteRaceTypeInput {
  id: string;
}

// Event Type Types
export interface EventType {
  eventTypeId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventTypesResponse {
  eventTypes: EventType[];
  message: string;
}

export interface CreateEventTypeInput {
  name: string;
  description?: string;
}

export interface UpdateEventTypeInput extends CreateEventTypeInput {
  id: string;
}

export interface DeleteEventTypeInput {
  id: string;
}

// Fee Scheme Types
export interface PerchFeeItem {
  birdNo: number;
  fee: number;
}

export interface RaceTypeFee {
  raceTypeId: string;
  fee: number;
  raceType?: RaceType;
}

export interface FeeScheme {
  id: string;
  name: string;
  description?: string;
  entryFee: number;
  isRefundable: boolean;
  maxBirds: number;
  feesCutPercent: number;
  createdAt: string;
  updatedAt: string;
  perchFeeItems: PerchFeeItem[];
  raceTypes: RaceTypeFee[];
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface FeeSchemesResponse {
  feeSchemes: FeeScheme[];
  message: string;
}

export interface CreateFeeSchemeInput {
  name: string;
  description?: string;
  entryFee: number;
  isRefundable: boolean;
  maxBirds: number;
  feesCutPercent: number;
  perchFeeItems: PerchFeeItem[];
  raceTypes: { raceTypeId: string; fee: number }[];
}

export interface UpdateFeeSchemeInput extends CreateFeeSchemeInput {
  id: string;
}

export interface DeleteFeeSchemeInput {
  id: string;
}

export interface FeeSchemeResponse {
  feeScheme: FeeScheme;
  message: string;
}

// Prize Scheme Types
export interface PrizeSchemeItem {
  raceTypeId: string;
  fromPosition: number;
  toPosition: number;
  prizeAmount: number;
  raceType?: RaceType;
}

export interface PrizeScheme {
  prizeSchemeId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  prizeSchemeItems: PrizeSchemeItem[];
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PrizeSchemesResponse {
  prizeSchemes: PrizeScheme[];
  message: string;
}

export interface CreatePrizeSchemeInput {
  name: string;
  description?: string;
  prizeSchemeItems: {
    raceTypeId: string;
    fromPosition: number;
    toPosition: number;
    prizeAmount: number;
  }[];
}

export interface UpdatePrizeSchemeInput extends CreatePrizeSchemeInput {
  id: string;
}

export interface DeletePrizeSchemeInput {
  id: string;
}

export interface PrizeSchemeResponse {
  prizeScheme: PrizeScheme;
  message: string;
}

// Betting Scheme Types
export interface BettingScheme {
  bettingSchemeId: string;
  name: string;
  description?: string;
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
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface BettingSchemesResponse {
  bettingSchemes: BettingScheme[];
  message: string;
}

export interface CreateBettingSchemeInput {
  name: string;
  description?: string;
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
}

export interface UpdateBettingSchemeInput extends CreateBettingSchemeInput {
  id: string;
}

export interface DeleteBettingSchemeInput {
  id: string;
}

export interface BettingSchemeResponse {
  bettingScheme: BettingScheme;
  message: string;
}

// Event Types
export interface Event {
  eventId: string;
  name: string;
  shortName?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  bannerImage?: string | null;
  logoImage?: string | null;
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
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  contactAddress?: string;
  socialYt?: string;
  socialFb?: string;
  socialTwitter?: string;
  socialInsta?: string;
  races?: Race[];
}

export interface EventsResponse {
  events: Event[];
  message: string;
}

export interface CreateEventInput {
  name: string;
  shortName?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isOpen?: boolean;
  typeId: string;
  feeSchemeId: string;
  prizeSchemeId: string;
  bettingSchemeId: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  contactAddress?: string;
  socialYt?: string;
  socialFb?: string;
  socialTwitter?: string;
  socialInsta?: string;
}

export interface UpdateEventInput {
  eventId: string;
  name?: string;
  shortName?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isOpen?: boolean;
  typeId?: string;
  feeSchemeId?: string;
  prizeSchemeId?: string;
  bettingSchemeId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  contactAddress?: string;
  socialYt?: string;
  socialFb?: string;
  socialTwitter?: string;
  socialInsta?: string;
}

export interface DeleteEventInput {
  eventId: string;
}

export interface EventResponse {
  event: Event;
  message: string;
}

// Race Types
export interface Race {
  raceId: string;
  raceTypeId: string;
  eventId: string;
  name: string;
  description?: string;
  distance: number;
  releaseStation: string;
  releaseDate: string;
  sunriseTime: string;
  sunsetTime: string;
  arrivalTemperature?: number;
  arrivalWind?: string;
  arrivalWeather?: string;
  releaseTemperature?: number;
  releaseWind?: string;
  releaseWeather?: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  raceType?: RaceType;
  event?: {
    eventId: string;
    name: string;
    shortName?: string;
  };
}

export interface RacesResponse {
  races: Race[];
  message: string;
}

export interface CreateRaceInput {
  raceTypeId: string;
  eventId: string;
  name: string;
  description?: string;
  distance: number;
  releaseStation: string;
  releaseDate: string;
  sunriseTime: string;
  sunsetTime: string;
  arrivalTemperature?: number;
  arrivalWind?: string;
  arrivalWeather?: string;
  releaseTemperature?: number;
  releaseWind?: string;
  releaseWeather?: string;
  isClosed?: boolean;
}

export interface UpdateRaceInput {
  raceId: string;
  raceTypeId?: string;
  eventId?: string;
  name?: string;
  description?: string;
  distance?: number;
  releaseStation?: string;
  releaseDate?: string;
  sunriseTime?: string;
  sunsetTime?: string;
  arrivalTemperature?: number;
  arrivalWind?: string;
  arrivalWeather?: string;
  releaseTemperature?: number;
  releaseWind?: string;
  releaseWeather?: string;
  isClosed?: boolean;
}

export interface DeleteRaceInput {
  raceId: string;
}

export interface RaceResponse {
  race: Race;
  message: string;
}
