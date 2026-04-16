import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer, customSession, username } from "better-auth/plugins";

const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    advanced: {
        disableCSRFCheck: true,
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

            try {
                const dbUser = await prisma.user.findUnique({
                    where:{id:user.id},
                    select:{role:true}
                });
                return {
                    ...session,
                    user:{
                        ...user,
                        role: dbUser?.role ?? "BREEDER"
                    }
                };
            } catch (e) {
                console.error("[customSession] failed to fetch role for user", user.id, e);
                // Re-throw so better-auth surfaces a proper error rather than
                // silently downgrading the role to BREEDER and causing a 401.
                throw e;
            }
        })
    ]
});

export { auth };
export type AuthType = typeof auth;
