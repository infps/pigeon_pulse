import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createPaymentSchema = z.object({
  eventInventoryId: z.string(),
  breederId: z.string(),
  amountPaid: z.number(),
  amountToPay: z.number(),
  currency: z.string().default("USD"),
  method: z.enum(["CREDIT_CARD", "PAYPAL", "BANK_TRANSFER", "CASH"]),
  paymentType: z.enum(["ENTRY_FEE", "PERCH_FEE", "RACES_FEE", "PAYOUTS", "OTHER"]),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
});

const updatePaymentSchema = z.object({
  paymentId: z.string(),
  amountPaid: z.number(),
  amountToPay: z.number(),
  currency: z.string().default("USD"),
  method: z.enum(["CREDIT_CARD", "PAYPAL", "BANK_TRANSFER", "CASH"]),
  paymentType: z.enum(["ENTRY_FEE", "PERCH_FEE", "RACES_FEE", "PAYOUTS", "OTHER"]),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPaymentSchema.parse(body);

    const payment = await prisma.payments.create({
      data: validatedData,
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

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updatePaymentSchema.parse(body);

    const { paymentId, ...updateData } = validatedData;

    const payment = await prisma.payments.update({
      where: { paymentId },
      data: updateData,
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

    if (!session) {
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

    await prisma.payments.delete({
      where: { paymentId: paymentId },
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
