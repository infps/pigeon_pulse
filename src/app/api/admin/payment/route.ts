import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createPaymentSchema = z.object({
  eventInventoryId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  breederId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  paymentValue: z.number().optional(),
  paymentMethod: z.number().optional(),
  paymentType: z.number().optional(),
  status: z.number().optional(),
  paymentDesc: z.string().optional(),
  transactionId: z.string().optional(),
});

const updatePaymentSchema = z.object({
  paymentId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
  paymentValue: z.number().optional(),
  paymentMethod: z.number().optional(),
  paymentType: z.number().optional(),
  status: z.number().optional(),
  paymentDesc: z.string().optional(),
  transactionId: z.string().optional(),
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
        paymentValue: validatedData.paymentValue,
        paymentMethod: validatedData.paymentMethod,
        paymentType: validatedData.paymentType,
        status: validatedData.status,
        paymentDesc: validatedData.paymentDesc,
        transactionId: validatedData.transactionId,
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

    const { paymentId, ...updateData } = validatedData;

    const payment = await prisma.payment.update({
      where: { id: paymentId },
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
