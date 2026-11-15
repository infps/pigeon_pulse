import { PAYMENT_TYPE } from "@/lib/payment-types";
import { paypalClient, paypal } from "@/lib/paypal";
import { settleHotspotsForPayments } from "@/lib/hotspot-settle";
import { pendingForCapture } from "@/lib/paypal-capture";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { NextResponse } from "next/server";

/**
 * PayPal webhook handler for payment events
 * Configure webhook in PayPal dashboard to point to: https://yourdomain.com/api/payment/paypal/webhook
 * Subscribe to: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headers = request.headers;

    // Verify webhook signature (recommended for production)
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (webhookId) {
      const verifyRequest = {
        auth_algo: headers.get("paypal-auth-algo") || "",
        cert_url: headers.get("paypal-cert-url") || "",
        transmission_id: headers.get("paypal-transmission-id") || "",
        transmission_sig: headers.get("paypal-transmission-sig") || "",
        transmission_time: headers.get("paypal-transmission-time") || "",
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      };

      const client = paypalClient();
      const verifyResponse : any = await client.execute(
        new paypal.notifications.WebhookVerifySignatureRequest(verifyRequest)
      );

      if (verifyResponse.result.verification_status !== "SUCCESS") {
        console.error("Webhook signatu~re verification failed");
        return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
      }
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;
    const resource = event.resource;

    console.log(`PayPal webhook received: ${eventType}`, resource);

    // Handle different event types
    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const captureId = resource.id;
        const customId = resource.custom_id;
        const amount = parseFloat(resource.amount.value);

        if (!customId) {
          console.warn("No custom_id in capture, skipping");
          break;
        }

        const eventInventoryId = parseInt(customId);
        const eventInventory = await prisma.eventInventory.findUnique({
          where: { id: eventInventoryId },
          include: { payments: true },
        });

        if (!eventInventory) {
          console.error(`EventInventory ${eventInventoryId} not found`);
          break;
        }

        // Already recorded by the capture endpoint: nothing more to do.
        const recorded = await prisma.payment.findFirst({ where: { transactionId: captureId }, select: { id: true } });
        if (recorded) {
          console.log(`Capture ${captureId} already recorded as payment ${recorded.id}`);
          break;
        }

        // The pending payment this amount pays, matched to the cent; never a
        // different row, and its amount and description are kept.
        const pendingPayment = pendingForCapture(eventInventory.payments, amount);

        if (pendingPayment) {
          await prisma.payment.update({
            where: { id: pendingPayment.id },
            data: {
              status: PaymentStatus.PAID,
              transactionId: captureId,
              paymentDate: new Date(),
              paymentTimestamp: new Date(),
              paymentDesc: pendingPayment.paymentDesc
                ? `${pendingPayment.paymentDesc} · PayPal webhook: ${event.id}`
                : `PayPal webhook: ${event.id}`,
            },
          });
          await settleHotspotsForPayments([pendingPayment.id]);
        } else {
          await prisma.payment.create({
            data: {
              eventInventoryId,
              breederId: eventInventory.breederId,
              paymentType: PAYMENT_TYPE.REGISTRATION,
              paymentValue: amount,
              status: PaymentStatus.PAID,
              transactionId: captureId,
              paymentDate: new Date(),
              paymentTimestamp: new Date(),
              paymentDesc: `PayPal webhook: ${event.id}`,
            },
          });
        }

        console.log(`Payment marked as PAID for eventInventoryId: ${eventInventoryId}`);
        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        const captureId = resource.id;
        const customId = resource.custom_id;

        if (customId) {
          const eventInventoryId = parseInt(customId);
          const payment = await prisma.payment.findFirst({
            where: { eventInventoryId, transactionId: captureId },
          });

          if (payment) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.FAILED },
            });
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        const captureId = resource.id;
        const payment = await prisma.payment.findFirst({
          where: { transactionId: captureId },
        });

        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.REFUNDED },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json({ message: "Webhook processing failed" }, { status: 500 });
  }
}
