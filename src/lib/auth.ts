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
            const role = await prisma.user.findUnique({
                where:{id:user.id},
                select:{role:true}
            });
            return {
                ...session,
                user:{
                    ...user,
                    role:role?.role || "BREEDER"
                }
            }
        })
    ]
});

export { auth };
export type AuthType = typeof auth;
