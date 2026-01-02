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
