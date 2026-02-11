import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer, customSession, username } from "better-auth/plugins";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    advanced: {
        disableCSRFCheck: true,
    },
    emailAndPassword:{
        enabled:true,
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