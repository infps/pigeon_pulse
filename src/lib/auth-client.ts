import { customSessionClient, usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import type { AuthType } from "./auth"

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_AUTH_BASE_URL || "http://localhost:3000",
    plugins:[
        usernameClient(),
        customSessionClient<AuthType>()
    ]
})
