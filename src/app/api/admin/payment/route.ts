import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const METHOD_MAP: Record<string, number> = { CASH: 0, CREDIT_CARD: 1, PAYPAL: 2, BANK_TRANSFER: 3 };
const TYPE_MAP: Record<string, number> = { PERCH_FEE: 0, BIRD_FEE: 1, RACES_FEE: 2, PAYOUTS: 3, OTHER: 4 };

const createPaymentSchema = z.object({
  eventInventoryId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  breederId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  amountPaid: z.number(),
  method: z.string().optional(),
  paymentType: z.string().optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
});

const updatePaymentSchema = z.object({
  paymentId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  amountPaid: z.number().optional(),
  method: z.string().optional(),
  paymentType: z.string().optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPaymentSchema.parse(body);

    const payment = await prisma.payment.create({
      data: {
        eventInventoryId: validatedData.eventInventoryId,
        breederId: validatedData.breederId,
        paymentValue: validatedData.amountPaid,
        paymentMethod: validatedData.method ? METHOD_MAP[validatedData.method] ?? null : null,
        paymentType: validatedData.paymentType ? TYPE_MAP[validatedData.paymentType] ?? null : null,
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

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updatePaymentSchema.parse(body);

    const { paymentId, amountPaid, method, paymentType, description, referenceNumber, status } = validatedData;

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        ...(amountPaid !== undefined && { paymentValue: amountPaid }),
        ...(method !== undefined && { paymentMethod: METHOD_MAP[method] ?? null }),
        ...(paymentType !== undefined && { paymentType: TYPE_MAP[paymentType] ?? null }),
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

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
