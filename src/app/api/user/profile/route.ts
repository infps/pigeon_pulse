import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

export async function PUT(req: NextRequest) {
  try {
    // Get the authenticated session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    
    // Extract fields from form data
    const name = formData.get("name") as string;
    const lastName = formData.get("lastName") as string | null;
    const displayUsername = formData.get("displayUsername") as string | null;
    const country = formData.get("country") as string | null;
    const state = formData.get("state") as string | null;
    const city = formData.get("city") as string | null;
    const address = formData.get("address") as string | null;
    const postalCode = formData.get("postalCode") as string | null;
    const phoneNumber = formData.get("phoneNumber") as string | null;
    const webAddress = formData.get("webAddress") as string | null;
    const note = formData.get("note") as string | null;
    const imageFile = formData.get("image") as File | null;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }
    // Handle image upload
    let imageUrl = user?.image;
    let imageKey = user?.imageKey;

    if (imageFile && imageFile.size > 0) {
      // Delete old image if exists
      if (imageKey) {
        try {
          await deleteFromR2(imageKey);
        } catch (error) {
          console.error("Error deleting old image:", error);
        }
      }

      // Upload new image
      const timestamp = Date.now();
      const key = `users/${session.user.id}/profile-${timestamp}.${imageFile.name.split('.').pop()}`;
      
      const { url, key: uploadedKey } = await uploadToR2(imageFile, key);
      imageUrl = url;
      imageKey = uploadedKey;
    }

    // Update user data
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        lastName,
        displayUsername,
        country,
        state,
        city,
        address,
        postalCode,
        phoneNumber,
        webAddress,
        note,
        image: imageUrl,
        imageKey,
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        username: updatedUser.username,
        displayUsername: updatedUser.displayUsername,
        image: updatedUser.image,
        country: updatedUser.country,
        state: updatedUser.state,
        city: updatedUser.city,
        address: updatedUser.address,
        postalCode: updatedUser.postalCode,
        phoneNumber: updatedUser.phoneNumber,
        webAddress: updatedUser.webAddress,
        note: updatedUser.note,
        status: updatedUser.status,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        username: true,
        displayUsername: true,
        image: true,
        country: true,
        state: true,
        city: true,
        address: true,
        postalCode: true,
        phoneNumber: true,
        webAddress: true,
        note: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { message: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
