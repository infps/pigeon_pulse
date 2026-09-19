import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Waive a late-payment penalty — "admin can waive with proof".
 *
 * A waived row is kept rather than deleted: the charge, who waived it, why, and
 * the proof they were shown all stay on record. Only live rows count toward what
 * a registration owes.
 */
const bodySchema = z.object({
  reason: z.string().min(1, "A reason is required").max(500),
  proofUrl: z.string().url().optional(),
  proofKey: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ penaltyId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { penaltyId } = await params;
    const id = parseInt(penaltyId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "Invalid penalty ID" }, { status: 400 });
    }

    const body = bodySchema.parse(await request.json());

    const penalty = await prisma.paymentPenalty.findUnique({
      where: { id },
      select: { id: true, amount: true, waivedAt: true },
    });
    if (!penalty) {
      return NextResponse.json({ message: "Penalty not found" }, { status: 404 });
    }
    if (penalty.waivedAt != null) {
      return NextResponse.json(
        { message: "That penalty has already been waived." },
        { status: 400 }
      );
    }

    const waived = await prisma.paymentPenalty.update({
      where: { id },
      data: {
        waivedAt: new Date(),
        waivedBy: session.user.id ?? null,
        waiverReason: body.reason,
        waiverProofUrl: body.proofUrl ?? null,
        waiverProofKey: body.proofKey ?? null,
      },
      select: { id: true, amount: true, waivedAt: true, waiverReason: true },
    });

    return NextResponse.json({
      penalty: waived,
      message: `Penalty of ${penalty.amount.toFixed(2)} waived.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "A reason is required to waive a penalty." },
        { status: 400 }
      );
    }
    console.error("Penalty waiver failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
