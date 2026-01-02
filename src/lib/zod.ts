import z from "zod";

export const createRaceTypeSchema = z.object({
    name:z.string().min(1, "Name is required"),
    isPaid:z.boolean().default(false),
})

export const createEventTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
})

export const perchFeeItemSchema = z.object({
    birdNo: z.number().int().positive("Bird number must be a positive integer"),
    fee: z.number().nonnegative("Fee must be a non-negative number"),
})

export const raceTypeFeeSchema = z.object({
    raceTypeId: z.string().min(1, "Race type ID is required"),
    fee: z.number().nonnegative("Fee must be a non-negative number"),
})

export const createFeeSchemeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    entryFee: z.number().nonnegative("Entry fee must be a non-negative number").default(0),
    isRefundable: z.boolean().default(false),
    maxBirds: z.number().int().nonnegative("Max birds must be a non-negative integer").default(0),
    feesCutPercent: z.number().min(0).max(100, "Fees cut percent must be between 0 and 100").default(0),
    perchFeeItems: z.array(perchFeeItemSchema).default([]),
    raceTypes: z.array(raceTypeFeeSchema).default([]),
}).refine(
    (data) => data.perchFeeItems.length === data.maxBirds,
    {
        message: "Number of perch fee items must equal maxBirds",
        path: ["perchFeeItems"],
    }
)

export const prizeSchemeItemSchema = z.object({
    raceTypeId: z.string().min(1, "Race type ID is required"),
    fromPosition: z.number().int().positive("From position must be a positive integer"),
    toPosition: z.number().int().positive("To position must be a positive integer"),
    prizeAmount: z.number().nonnegative("Prize amount must be a non-negative number"),
}).refine(
    (data) => data.toPosition >= data.fromPosition,
    {
        message: "To position must be greater than or equal to from position",
        path: ["toPosition"],
    }
)

export const createPrizeSchemeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    prizeSchemeItems: z.array(prizeSchemeItemSchema).default([]),
})

export const createBettingSchemeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    bettingCutPercent: z.number().min(0).max(100, "Betting cut percent must be between 0 and 100").default(0),
    belgianShow1: z.number().nonnegative("Belgian show 1 must be non-negative").default(0),
    belgianShow2: z.number().nonnegative("Belgian show 2 must be non-negative").default(0),
    belgianShow3: z.number().nonnegative("Belgian show 3 must be non-negative").default(0),
    belgianShow4: z.number().nonnegative("Belgian show 4 must be non-negative").default(0),
    belgianShow5: z.number().nonnegative("Belgian show 5 must be non-negative").default(0),
    belgianShow6: z.number().nonnegative("Belgian show 6 must be non-negative").default(0),
    belgianShow7: z.number().nonnegative("Belgian show 7 must be non-negative").default(0),
    standardShow1: z.number().nonnegative("Standard show 1 must be non-negative").default(0),
    standardShow2: z.number().nonnegative("Standard show 2 must be non-negative").default(0),
    standardShow3: z.number().nonnegative("Standard show 3 must be non-negative").default(0),
    standardShow4: z.number().nonnegative("Standard show 4 must be non-negative").default(0),
    standardShow5: z.number().nonnegative("Standard show 5 must be non-negative").default(0),
    wta1: z.number().nonnegative("WTA 1 must be non-negative").default(0),
    wta2: z.number().nonnegative("WTA 2 must be non-negative").default(0),
    wta3: z.number().nonnegative("WTA 3 must be non-negative").default(0),
    wta4: z.number().nonnegative("WTA 4 must be non-negative").default(0),
    wta5: z.number().nonnegative("WTA 5 must be non-negative").default(0),
})