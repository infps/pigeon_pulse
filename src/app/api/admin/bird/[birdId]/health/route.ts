import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isFitToFly } from "@/lib/bird-health";

/**
 * Record a bird's health.
 *
 * Health is a property of the bird, not of any one race: an injured bird stays
 * injured across races until an admin clears it. Anything other than HEALTHY
 * blocks the bird from being basketted.
 */
const bodySchema = z.object({
  healthStatus: z.enum(["HEALTHY", "INJURED", "HOSPITALIZED", "DEAD"]),
  healthNote: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const id = parseInt(birdId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "Invalid bird ID" }, { status: 400 });
    }

    const { healthStatus, healthNote } = bodySchema.parse(await request.json());

    const existing = await prisma.bird.findUnique({
      where: { id },
      select: { id: true, healthStatus: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }

    const bird = await prisma.bird.update({
      where: { id },
      data: {
        healthStatus,
        healthNote: healthNote ?? null,
        healthUpdatedAt: new Date(),
        // A dead bird is also out of the active roster.
        ...(healthStatus === "DEAD" ? { isActive: 0 } : {}),
      },
      select: { id: true, healthStatus: true, healthNote: true, healthUpdatedAt: true },
    });

    // Log against every registration this bird belongs to, so the note shows up
    // in the bird's event history wherever an operator looks for it.
    const items = await prisma.eventInventoryItem.findMany({
      where: { birdId: id },
      select: { id: true },
    });
    if (items.length > 0) {
      await prisma.birdEventHistory.createMany({
        data: items.map((item) => ({
          eventInventoryItemId: item.id,
          action: "STATUS_CHANGED" as const,
          detail: healthNote
            ? `Health: ${existing.healthStatus} to ${healthStatus} — ${healthNote}`
            : `Health: ${existing.healthStatus} to ${healthStatus}`,
          performedById: session.user.id ?? null,
        })),
      });
    }

    return NextResponse.json({
      bird,
      allowedToFly: isFitToFly(healthStatus),
      message:
        healthStatus === "HEALTHY"
          ? "Bird cleared to fly."
          : `Bird marked ${healthStatus.toLowerCase()} and held back from basketting.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Health status must be HEALTHY, INJURED, HOSPITALIZED or DEAD." },
        { status: 400 }
      );
    }
    console.error("Failed to set bird health:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
