import z from "zod";

export const createRaceTypeSchema = z.object({
    name:z.string().min(1, "Name is required"),
    isPaid:z.boolean().default(false),
})

export const createEventTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
})