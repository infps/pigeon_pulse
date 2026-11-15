import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PAYMENT_TYPE, isOutgoing, paymentTypeFromKey } from "@/lib/payment-types";

const METHOD_MAP: Record<string, number> = { CASH: 0, CREDIT_CARD: 1, PAYPAL: 2, BANK_TRANSFER: 3 };
/** Payment type keys are lib/payment-types keys (HayLoft codes); anything else is refused. */
const paymentTypeKey = z
  .string()
  .refine((k) => k !== "REGISTRATION" && paymentTypeFromKey(k) != null, {
    message: `Unknown payment type. Use one of: ${Object.keys(PAYMENT_TYPE).filter((k) => k !== "REGISTRATION").join(", ")}`,
  });

/** Money going back out (refunds, payouts) is stored negative, as HayLoft does. */
function storedValue(amount: number, type: number | null): number {
  return isOutgoing(type) ? -Math.abs(amount) : amount;
}

const createPaymentSchema = z.object({
  eventInventoryId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  breederId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  amountPaid: z.number(),
  method: z.string().optional(),
  paymentType: paymentTypeKey.optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
});

const updatePaymentSchema = z.object({
  paymentId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  amountPaid: z.number().optional(),
  method: z.string().optional(),
  paymentType: paymentTypeKey.optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const guard = await requirePermission("payments.manage");
    if ("error" in guard) return guard.error;

    const body = await request.json();
    const validatedData = createPaymentSchema.parse(body);

    const type = paymentTypeFromKey(validatedData.paymentType) ?? PAYMENT_TYPE.OTHER;
    const payment = await prisma.payment.create({
      data: {
        eventInventoryId: validatedData.eventInventoryId,
        breederId: validatedData.breederId,
        paymentValue: storedValue(validatedData.amountPaid, type),
        paymentMethod: validatedData.method ? METHOD_MAP[validatedData.method] ?? null : null,
        paymentType: type,
        paymentDesc: validatedData.description,
        transactionId: validatedData.referenceNumber,
        paymentDate: new Date(),
        paymentTimestamp: new Date(),
        status: validatedData.status ?? PaymentStatus.PAID,
      },
    });

    return NextResponse.json(
      {
        payment,
        message: "Payment created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating payment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const guard = await requirePermission("payments.manage");
    if ("error" in guard) return guard.error;

    const body = await request.json();
    const validatedData = updatePaymentSchema.parse(body);

    const { paymentId, amountPaid, method, paymentType, description, referenceNumber, status } = validatedData;

    // The sign follows the type, so read the type the row will end up with.
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { paymentType: true, paymentValue: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Payment not found" }, { status: 404 });
    }
    const type = paymentType !== undefined ? paymentTypeFromKey(paymentType) : existing.paymentType;
    const amount = amountPaid ?? existing.paymentValue ?? 0;

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        ...((amountPaid !== undefined || paymentType !== undefined) && { paymentValue: storedValue(amount, type) }),
        ...(method !== undefined && { paymentMethod: METHOD_MAP[method] ?? null }),
        ...(paymentType !== undefined && { paymentType: type }),
        ...(description !== undefined && { paymentDesc: description }),
        ...(referenceNumber !== undefined && { transactionId: referenceNumber }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json(
      {
        payment,
        message: "Payment updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating payment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request)  {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const guard = await requirePermission("payments.manage");
    if ("error" in guard) return guard.error;

    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { message: "Payment ID is required" },
        { status: 400 }
      );
    }

    const id = parseInt(paymentId);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    await prisma.payment.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Payment deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
