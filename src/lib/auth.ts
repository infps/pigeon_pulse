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
    // Declared so the session (and its cookie cache) carries them; without this
    // customSession below re-read the user on every request. input:false keeps
    // sign-up from setting either one.
    user: {
        additionalFields: {
            role: { type: "string", required: false, input: false },
            approvalStatus: { type: "string", required: false, input: false },
            // name = first name; signups send lastName separately.
            lastName: { type: "string", required: false, input: true },
        },
    },
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    try {
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
                                    firstName: user.name || null,
                                    lastName: (user as any).lastName || null,
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
            // Role and approval both ride on the session: every guard reads them
            // on each request, so fetching them here avoids a query per check.
            const existingRole = (user as any).role as string | undefined;
            const existingApproval = (user as any).approvalStatus as string | undefined;
            if (existingRole && existingApproval) {
                return {
                    ...session,
                    user: { ...user, role: existingRole, approvalStatus: existingApproval },
                };
            }

            const fetchUser = () =>
                prisma.user.findUnique({
                    where: { id: user.id },
                    select: { role: true, approvalStatus: true },
                });
            try {
                const dbUser = await fetchUser();
                return {
                    ...session,
                    user: {
                        ...user,
                        role: dbUser?.role ?? "BREEDER",
                        // An account whose row we could not read is treated as
                        // approved rather than locked out; the guards fail open
                        // for reads and closed for actions either way.
                        approvalStatus: dbUser?.approvalStatus ?? "APPROVED",
                    },
                };
            } catch (e) {
                console.error("[customSession] failed to fetch user for", user.id, e);
                throw e;
            }
        })
    ]
});

export { auth };
export type AuthType = typeof auth;
