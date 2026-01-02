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
    role: z.enum(["BREEDER", "ADMIN", "SUPERADMIN"]).default("BREEDER"),
    taxNumber: z.string().optional(),
    note: z.string().optional(),
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
    role: z.enum(["BREEDER", "ADMIN", "SUPERADMIN"]).optional(),
    taxNumber: z.string().optional(),
    note: z.string().optional(),
});

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

export const createEventSchema = z.object({
    name: z.string().min(1, "Event name is required"),
    shortName: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().optional(),
    isOpen: z.boolean().default(true),
    typeId: z.string().min(1, "Event type is required"),
    feeSchemeId: z.string().min(1, "Fee scheme is required"),
    prizeSchemeId: z.string().min(1, "Prize scheme is required"),
    bettingSchemeId: z.string().min(1, "Betting scheme is required"),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    contactPhone: z.string().optional(),
    contactWebsite: z.string().url("Invalid URL").optional().or(z.literal("")),
    contactAddress: z.string().optional(),
    socialYt: z.string().url("Invalid YouTube URL").optional().or(z.literal("")),
    socialFb: z.string().url("Invalid Facebook URL").optional().or(z.literal("")),
    socialTwitter: z.string().url("Invalid Twitter URL").optional().or(z.literal("")),
    socialInsta: z.string().url("Invalid Instagram URL").optional().or(z.literal("")),
})

export const updateEventSchema = z.object({
    name: z.string().min(1, "Event name is required").optional(),
    shortName: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isOpen: z.boolean().optional(),
    typeId: z.string().optional(),
    feeSchemeId: z.string().optional(),
    prizeSchemeId: z.string().optional(),
    bettingSchemeId: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    contactPhone: z.string().optional(),
    contactWebsite: z.string().url("Invalid URL").optional().or(z.literal("")),
    contactAddress: z.string().optional(),
    socialYt: z.string().url("Invalid YouTube URL").optional().or(z.literal("")),
    socialFb: z.string().url("Invalid Facebook URL").optional().or(z.literal("")),
    socialTwitter: z.string().url("Invalid Twitter URL").optional().or(z.literal("")),
    socialInsta: z.string().url("Invalid Instagram URL").optional().or(z.literal("")),
})