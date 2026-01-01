import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { customSession, username } from "better-auth/plugins";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword:{
        enabled:true,
    },
    plugins:[username(),
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