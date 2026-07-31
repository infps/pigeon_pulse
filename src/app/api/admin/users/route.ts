import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { createUserSchema, updateUserSchema } from "@/lib/zod";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const userSelect = {
  id: true,
  name: true,
  lastName: true,
  email: true,
  emailVerified: true,
  image: true,
  imageKey: true,
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
  loftName: true,
  timezone: true,
  legalName: true,
  ssnDocKey: true,
  taxDocKey: true,
} as const;

function mapBreederToUser(breeder: any) {
  return {
    id: `legacy-${breeder.id}`,
    breederId: breeder.id,
    name: breeder.firstName || "",
    lastName: breeder.lastName,
    email: breeder.email || "",
    emailVerified: false,
    createdAt: breeder.statusDate || new Date().toISOString(),
    updatedAt: breeder.statusDate || new Date().toISOString(),
    username: breeder.loginName,
    displayUsername: null,
    country: breeder.country,
    state: breeder.state1,
    city: breeder.city1,
    address: breeder.address1,
    postalCode: breeder.zip1,
    phoneNumber: breeder.phone || breeder.cell,
    webAddress: breeder.webAddress,
    ssn: breeder.ssn,
    status: breeder.status === 1 ? "ACTIVE" : breeder.status === 0 ? "INACTIVE" : "ACTIVE",
    statusDate: breeder.statusDate || new Date().toISOString(),
    note: breeder.note,
    role: "BREEDER",
    taxNumber: breeder.taxNumber,
    loftName: null,
    isLegacy: true,
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and SUPERADMIN can list users
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const role = searchParams.get("role");

    let users;
    let legacyBreeders: any[] = [];

    if (eventId) {
      const eventIdInt = parseInt(eventId);
      const activeSeason = await prisma.season.findFirst({
        where: { eventId: eventIdInt, isActive: true },
        orderBy: { startDate: "desc" },
      });
      const inventories = await prisma.eventInventory.findMany({
        where: { seasonId: activeSeason?.id },
        include: { breeder: true },
      });

      const breederEmails = inventories
        .map(inv => inv.breeder?.email)
        .filter((e): e is string => !!e);

      const whereClause: any = { email: { in: breederEmails } };
      if (role) whereClause.role = role;

      users = await prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        select: userSelect,
      });

      // Include legacy breeders from this event that have no matching User
      if (!role || role === "BREEDER") {
        const userEmails = new Set(users.map(u => u.email.toLowerCase()));
        legacyBreeders = inventories
          .map(inv => inv.breeder)
          .filter((b): b is NonNullable<typeof b> => !!b)
          .filter(b => !b.email || !userEmails.has(b.email.toLowerCase()))
          .map(mapBreederToUser);
      }
    } else {
      const whereClause: any = {};
      if (role) whereClause.role = role;

      users = await prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        select: userSelect,
      });

      // Include legacy breeders that have no matching User
      if (!role || role === "BREEDER") {
        const userEmails = new Set(users.map(u => u.email.toLowerCase()));
        const allBreeders = await prisma.breeder.findMany();
        legacyBreeders = allBreeders
          .filter(b => !b.email || !userEmails.has(b.email.toLowerCase()))
          .map(mapBreederToUser);
      }
    }

    // Attach breederId to regular users (by userId, fallback to email)
    const userIds = users.map((u: any) => u.id);
    const emails = users.map((u: any) => u.email?.toLowerCase()).filter(Boolean);
    const allLinkedBreeders = userIds.length > 0
      ? await prisma.breeder.findMany({
          where: {
            OR: [
              { userId: { in: userIds } },
              { email: { in: emails } },
            ],
          },
          select: { id: true, userId: true, email: true },
        })
      : [];
    const breederByUserId = new Map(
      allLinkedBreeders.filter(b => b.userId).map(b => [b.userId, b.id])
    );
    const breederByEmail = new Map(
      allLinkedBreeders.filter(b => b.email).map(b => [b.email!.toLowerCase(), b.id])
    );
    const usersWithBreeder = users.map((u: any) => ({
      ...u,
      breederId: breederByUserId.get(u.id) ?? breederByEmail.get(u.email?.toLowerCase()) ?? null,
    }));

    const merged = [...usersWithBreeder, ...legacyBreeders];

    return NextResponse.json(
      { users: merged, message: "Users fetched successfully" },
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
        loftName: validatedData.loftName,
        note: validatedData.note,
        image: validatedData.image,
        imageKey: validatedData.imageKey,
        timezone: validatedData.timezone,
        legalName: validatedData.legalName,
        ssnDocKey: validatedData.ssnDocKey,
        taxDocKey: validatedData.taxDocKey,
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        image: true,
        imageKey: true,
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
        loftName: true,
        timezone: true,
        legalName: true,
        ssnDocKey: true,
        taxDocKey: true,
      },
    });

    // Create linked Breeder record so the user appears in breeder dropdowns
    await getOrCreateBreeder(
      authUser.user.id,
      validatedData.email,
      `${validatedData.name}${validatedData.lastName ? ` ${validatedData.lastName}` : ""}`
    );

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

    // Empty string on the unique username column collides across users
    // (Postgres allows many NULLs but only one ""). Store blanks as null.
    const normalizedUsername =
      validatedData.username !== undefined
        ? validatedData.username.trim() || null
        : undefined;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...validatedData,
        username: normalizedUsername,
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
        image: true,
        imageKey: true,
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
        loftName: true,
        timezone: true,
        legalName: true,
        ssnDocKey: true,
        taxDocKey: true,
      },
    });

    // When elevated to admin/superadmin, ensure they have an OrganizerData record
    if (validatedData.role && ["ADMIN", "SUPERADMIN"].includes(validatedData.role)) {
      await prisma.organizerData.upsert({
        where: { userId: id },
        create: {
          userId: id,
          email: updatedUser.email,
          name: `${updatedUser.name}${updatedUser.lastName ? ` ${updatedUser.lastName}` : ""}`,
        },
        update: {},
      });
    }

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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const fields = (error.meta?.target as string[] | undefined)?.join(", ");
      return NextResponse.json(
        { message: `Already in use: ${fields ?? "unique field"}` },
        { status: 409 }
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
    const { id, ids } = body;

    // Support bulk delete via ids array or single delete via id
    const deleteIds: string[] = ids || (id ? [id] : []);

    if (deleteIds.length === 0) {
      return NextResponse.json(
        { message: "User ID(s) required" },
        { status: 400 }
      );
    }

    // Prevent deleting own account
    if (deleteIds.includes(session.user.id)) {
      return NextResponse.json(
        { message: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Filter out legacy IDs — they can't be deleted from user table
    const realIds = deleteIds.filter((i: string) => !i.startsWith("legacy-"));

    if (realIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: realIds } },
      });
    }

    return NextResponse.json(
      { message: `${realIds.length} user(s) deleted successfully` },
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
