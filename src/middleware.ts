import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 200 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    response.headers.set("Access-Control-Expose-Headers", "set-auth-token");
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Expose-Headers", "set-auth-token");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
