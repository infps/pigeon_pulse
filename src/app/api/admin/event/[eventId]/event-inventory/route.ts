import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request,{ params }: { params: Promise<{ eventId: string }> }){
    const {eventId: eventIdParam} = await params;
    const eventId = parseInt(eventIdParam);

    if (isNaN(eventId)) {
        return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // TODO: implement auth bridge for admin/organizer mapping
        // Skipping ownership check for now

        const eventInventory = await prisma.eventInventory.findMany({
            where:{
                eventId: eventId
            },
            include:{
                breeder:true,
                payments:true,
                items:{
                    include:{
                        bird:true
                    },
                }
            }
        })
        return NextResponse.json(
            { eventInventory, message: "Event inventory fetched successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching event inventory:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}
