import { prisma } from "./prisma";

/** Find existing Breeder by userId (preferred) or email (fallback), or create one */
export async function getOrCreateBreeder(
  userId: string,
  email: string,
  name?: string | null
) {
  // Primary: lookup by userId (unique index, fast)
  let breeder = await prisma.breeder.findUnique({ where: { userId } });

  if (!breeder) {
    // Fallback: legacy breeder with matching email but no userId yet
    breeder = await prisma.breeder.findFirst({ where: { email } });
    if (breeder && !breeder.userId) {
      breeder = await prisma.breeder.update({
        where: { id: breeder.id },
        data: { userId },
      });
    }
  }

  if (!breeder) {
    const nameParts = (name || "").split(" ");
    breeder = await prisma.breeder.create({
      data: {
        email,
        userId,
        firstName: nameParts[0] || null,
        lastName: nameParts.slice(1).join(" ") || null,
        loginName: email,
        status: 1,
      },
    });
  }

  return breeder;
}
