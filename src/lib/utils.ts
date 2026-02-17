import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PaymentStatus } from "@/generated/prisma/enums"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type PaymentStatusType = PaymentStatus;

/**
 * Computes payment status from amounts if explicit status not set
 * Hybrid approach: uses explicit status if available, otherwise derives from amounts
 */
export function getPaymentStatus(
  amountPaid: number,
  amountToPay: number,
  explicitStatus?: PaymentStatus | null
): PaymentStatus {
  // Use explicit status if set (except for auto-computable ones)
  if (explicitStatus === PaymentStatus.FAILED || explicitStatus === PaymentStatus.REFUNDED) {
    return explicitStatus;
  }

  // Compute from amounts
  if (amountPaid <= 0) return PaymentStatus.PENDING;
  if (amountPaid >= amountToPay) return PaymentStatus.PAID;
  return PaymentStatus.PARTIAL;
}
