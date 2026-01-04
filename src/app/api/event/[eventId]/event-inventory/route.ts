import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request,{ params }: { params: Promise<{ eventId: string }> }){
    const {eventId} = await params;

    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        const eventInventory = await prisma.eventInventory.findMany({
            where:{
                eventId: eventId
            },
            include:{
                breeder:true,
                payments:true
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