import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer, customSession, username } from "better-auth/plugins";

const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 min — short enough to pick up role changes
        },
    },
    advanced: {
        disableCSRFCheck: true,
        ipAddress: {
            disableIpTracking: true,
        },
    },
    emailAndPassword:{
        enabled:true,
    },
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    try {
                        const nameParts = (user.name || "").split(" ");
                        // Check if legacy breeder exists by email → link it
                        const existing = await prisma.breeder.findFirst({
                            where: { email: user.email },
                        });
                        if (existing) {
                            await prisma.breeder.update({
                                where: { id: existing.id },
                                data: { userId: user.id },
                            });
                        } else {
                            await prisma.breeder.create({
                                data: {
                                    email: user.email,
                                    userId: user.id,
                                    firstName: nameParts[0] || null,
                                    lastName: nameParts.slice(1).join(" ") || null,
                                    loginName: user.email,
                                    status: 1,
                                },
                            });
                        }
                    } catch (e) {
                        console.error("Failed to create/link breeder record:", e);
                    }
                },
            },
        },
    },
    plugins:[bearer(),username(),
        customSession(async({user,session})=>{
            // Avoid extra DB round-trip if role is already on the session user
            const existingRole = (user as any).role as string | undefined;
            if (existingRole) {
                return { ...session, user: { ...user, role: existingRole } };
            }

            const fetchRole = () => prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
            try {
                let dbUser = await fetchRole().catch(async (e: any) => {
                    // Retry once on Neon cold-start timeout
                    if (e?.code === "ETIMEDOUT" || e?.code === "P1001") {
                        await new Promise(r => setTimeout(r, 1500));
                        return fetchRole();
                    }
                    throw e;
                });
                return {
                    ...session,
                    user: { ...user, role: dbUser?.role ?? "BREEDER" }
                };
            } catch (e) {
                console.error("[customSession] failed to fetch role for user", user.id, e);
                throw e;
            }
        })
    ]
});

export { auth };
export type AuthType = typeof auth;
