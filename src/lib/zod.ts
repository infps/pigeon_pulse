import z from "zod";

export const createUserSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1, "Name is required"),
    lastName: z.string().optional(),
    username: z.string().optional(),
    displayUsername: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    phoneNumber: z.string().optional(),
    webAddress: z.string().url("Invalid URL").optional().or(z.literal("")),
    ssn: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("ACTIVE"),
    role: z.enum(["BREEDER", "ADMIN", "SUPERADMIN", "BETTOR"]).default("BREEDER"),
    taxNumber: z.string().optional(),
    loftName: z.string().optional(),
    note: z.string().optional(),
    image: z.string().optional(),
    imageKey: z.string().optional(),
    timezone: z.string().optional(),
    legalName: z.string().optional(),
    ssnDocKey: z.string().optional(),
    taxDocKey: z.string().optional(),
});

export const updateUserSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    lastName: z.string().optional(),
    username: z.string().optional(),
    displayUsername: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    phoneNumber: z.string().optional(),
    webAddress: z.string().url("Invalid URL").optional().or(z.literal("")),
    ssn: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
    role: z.enum(["BREEDER", "ADMIN", "SUPERADMIN", "BETTOR"]).optional(),
    taxNumber: z.string().optional(),
    loftName: z.string().optional(),
    note: z.string().optional(),
    image: z.string().optional(),
    imageKey: z.string().optional(),
    timezone: z.string().optional(),
    legalName: z.string().optional(),
    ssnDocKey: z.string().optional(),
    taxDocKey: z.string().optional(),
});

export const createRaceTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex like #1d4ed8").optional().nullable(),
    isPaymentRequired: z.boolean().optional().default(false),
})

export const createEventTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
})

export const birdFeeItemSchema = z.object({
    birdNo: z.number().int().positive("Bird number must be a positive integer"),
    birdFee: z.number().nonnegative("Fee must be non-negative"),
})

export const raceTypeFeeSchema = z.object({
    raceTypeId: z.number().int().positive("Race type ID is required"),
    fee: z.number().nonnegative("Fee must be non-negative"),
})

export const createFeeSchemeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    entryFee: z.number().int().nonnegative("Entry fee must be non-negative").default(0),
    isRefundable: z.number().int().min(0).max(1).default(0),
    maxBirdCount: z.number().int().nonnegative("Max birds must be non-negative").default(0),
    feesCutPercent: z.number().int().min(0).max(100).default(0),
    minEntryFees: z.number().int().nonnegative().default(0),
    maxBackupBirdCount: z.number().int().nonnegative().default(0),
    isFloatingBackup: z.number().int().min(0).max(1).default(0),
    hotSpot1Fee: z.number().int().nonnegative().default(0),
    hotSpot2Fee: z.number().int().nonnegative().default(0),
    hotSpot3Fee: z.number().int().nonnegative().default(0),
    hotSpotFinalFee: z.number().int().nonnegative().default(0),
    raceFeeMode: z.enum(["PER_BIRD_PER_RACE", "FLAT_PER_RACE"]).default("PER_BIRD_PER_RACE"),
    birdFeeItems: z.array(birdFeeItemSchema).default([]),
    raceTypeFees: z.array(raceTypeFeeSchema).default([]),
})

export const prizeSchemeItemSchema = z.object({
    raceTypeId: z.number().int().positive("Race type ID is required"),
    fromPosition: z.number().int().positive("From position must be positive"),
    toPosition: z.number().int().positive("To position must be positive"),
    prizeValue: z.number().nonnegative("Prize value must be non-negative"),
}).refine(
    (data) => data.toPosition >= data.fromPosition,
    {
        message: "To position must be >= from position",
        path: ["toPosition"],
    }
)

export const createPrizeSchemeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    prizeSchemeItems: z.array(prizeSchemeItemSchema).default([]),
})

export const standardShowPercentageSchema = z.object({
    place: z.number().int().positive("Place must be at least 1"),
    percValue: z.number().min(0).max(100).default(0),
})

export const createBettingSchemeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    bettingCutPercent: z.number().min(0).max(100).default(0),
    belgianRatio: z.number().int().positive().default(10),
    belgianShow1: z.number().nonnegative().default(0),
    belgianShow2: z.number().nonnegative().default(0),
    belgianShow3: z.number().nonnegative().default(0),
    belgianShow4: z.number().nonnegative().default(0),
    belgianShow5: z.number().nonnegative().default(0),
    belgianShow6: z.number().nonnegative().default(0),
    belgianShow7: z.number().nonnegative().default(0),
    standardShow1: z.number().nonnegative().default(0),
    standardShow2: z.number().nonnegative().default(0),
    standardShow3: z.number().nonnegative().default(0),
    standardShow4: z.number().nonnegative().default(0),
    standardShow5: z.number().nonnegative().default(0),
    standardShow6: z.number().nonnegative().default(0),
    wta1: z.number().nonnegative().default(0),
    wta2: z.number().nonnegative().default(0),
    wta3: z.number().nonnegative().default(0),
    wta4: z.number().nonnegative().default(0),
    wta5: z.number().nonnegative().default(0),
    standardShowPercentages: z.array(standardShowPercentageSchema).default([]),
})

export const createEventSchema = z.object({
    name: z.string().min(1, "Event name is required"),
    shortName: z.string().optional(),
    eventDate: z.string().min(1, "Event date is required"),
    eventTypeId: z.coerce.number().int().optional(),
    isOpen: z.coerce.number().int().min(0).max(1).default(1),
    feeSchemeId: z.coerce.number().int().positive("Fee scheme is required"),
    bettingSchemeId: z.coerce.number().int().positive("Betting scheme is required"),
    finalPrizeSchemeId: z.coerce.number().int().positive("Prize scheme is required"),
    hotSpot1PrizeSchemeId: z.coerce.number().int().optional(),
    hotSpot2PrizeSchemeId: z.coerce.number().int().optional(),
    hotSpot3PrizeSchemeId: z.coerce.number().int().optional(),
    hotSpotAvgPrizeSchemeId: z.coerce.number().int().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
})

export const updateEventSchema = z.object({
    name: z.string().min(1, "Event name is required").optional(),
    shortName: z.string().optional(),
    eventDate: z.string().optional(),
    endDate: z.string().optional(),
    description: z.string().optional(),
    eventTypeId: z.coerce.number().int().optional(),
    isOpen: z.coerce.number().int().min(0).max(1).optional(),
    feeSchemeId: z.coerce.number().int().optional(),
    bettingSchemeId: z.coerce.number().int().optional(),
    finalPrizeSchemeId: z.coerce.number().int().optional(),
    hotSpot1PrizeSchemeId: z.coerce.number().int().optional(),
    hotSpot2PrizeSchemeId: z.coerce.number().int().optional(),
    hotSpot3PrizeSchemeId: z.coerce.number().int().optional(),
    hotSpotAvgPrizeSchemeId: z.coerce.number().int().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    locationAddress: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    contactWebsite: z.string().optional(),
    contactAddress: z.string().optional(),
    socialYt: z.string().optional(),
    socialFb: z.string().optional(),
    socialTwitter: z.string().optional(),
    socialInsta: z.string().optional(),
})
