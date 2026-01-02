import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUserSchema, updateUserSchema } from "@/lib/zod";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can list all users
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get eventId from query params
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    let users;
    if (session.user.role === "SUPERADMIN") {
      const whereClause = eventId 
        ? {
            eventInventories: {
              some: {
                eventId: eventId,
              },
            },
          }
        : {};

      users = await prisma.user.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          username: true,
          displayUsername: true,
          country: true,
          state: true,
          city: true,
          address: true,
          postalCode: true,
          phoneNumber: true,
          webAddress: true,
          ssn: true,
          status: true,
          statusDate: true,
          note: true,
          role: true,
          taxNumber: true,
        },
      });
    } else {
      const whereClause = eventId
        ? {
            eventInventories: {
              some: {
                eventId: eventId,
                event: {
                  createdById: session.user.id,
                },
              },
            },
          }
        : {
            eventInventories: {
              some: {
                event: {
                  createdById: session.user.id,
                },
              },
            },
          };

      users = await prisma.user.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          username: true,
          displayUsername: true,
          country: true,
          state: true,
          city: true,
          address: true,
          postalCode: true,
          phoneNumber: true,
          webAddress: true,
          ssn: true,
          status: true,
          statusDate: true,
          note: true,
          role: true,
          taxNumber: true,
        },
      });
    }

    return NextResponse.json(
      { users, message: "Users fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can create users
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // First, create the user in better-auth
    const authUser = await auth.api.signUpEmail({
      body: {
        username: validatedData.username,
        email: validatedData.email,
        password: validatedData.password,
        name: validatedData.name,
      },
    });

    if (!authUser || !authUser.user) {
      return NextResponse.json(
        { message: "Failed to create user in authentication system" },
        { status: 500 }
      );
    }

    // Then update the user with additional fields
    const updatedUser = await prisma.user.update({
      where: { id: authUser.user.id },
      data: {
        lastName: validatedData.lastName,
        username: validatedData.username,
        displayUsername: validatedData.displayUsername,
        country: validatedData.country,
        state: validatedData.state,
        city: validatedData.city,
        address: validatedData.address,
        postalCode: validatedData.postalCode,
        phoneNumber: validatedData.phoneNumber,
        webAddress: validatedData.webAddress,
        ssn: validatedData.ssn,
        status: validatedData.status,
        role: validatedData.role,
        taxNumber: validatedData.taxNumber,
        note: validatedData.note,
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        username: true,
        displayUsername: true,
        country: true,
        state: true,
        city: true,
        address: true,
        postalCode: true,
        phoneNumber: true,
        webAddress: true,
        ssn: true,
        status: true,
        statusDate: true,
        note: true,
        role: true,
        taxNumber: true,
      },
    });

    return NextResponse.json(
      { message: "User created successfully", user: updatedUser },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating user:", error);
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

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { message: "User ID is required" },
        { status: 400 }
      );
    }

    // Users can update their own profile, or ADMIN/SUPERADMIN can update any user
    if (
      session.user.id !== id &&
      session.user.role !== "ADMIN" &&
      session.user.role !== "SUPERADMIN"
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const validatedData = updateUserSchema.parse(updateData);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...validatedData,
        statusDate: validatedData.status ? new Date() : undefined,
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        username: true,
        displayUsername: true,
        country: true,
        state: true,
        city: true,
        address: true,
        postalCode: true,
        phoneNumber: true,
        webAddress: true,
        ssn: true,
        status: true,
        statusDate: true,
        note: true,
        role: true,
        taxNumber: true,
      },
    });

    return NextResponse.json(
      { message: "User updated successfully", user: updatedUser },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only SUPERADMIN can delete users
    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { message: "User ID is required" },
        { status: 400 }
      );
    }

    // Prevent deleting own account
    if (session.user.id === id) {
      return NextResponse.json(
        { message: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
