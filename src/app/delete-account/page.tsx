import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, LegalPage, Mail } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Delete your account | Pigeon Pulse",
  description: "How to delete your Pigeon Pulse account and the data linked to it.",
};

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your Pigeon Pulse account" updated="November 13, 2026">
      <p>
        You can ask {COMPANY} to delete your Pigeon Pulse account and the personal data linked to
        it at any time. This applies to accounts used in the Pigeon Pulse app on Android and iOS
        and on the Pigeon Pulse website.
      </p>

      <h2>How to request deletion</h2>
      <ol>
        <li>
          Send an email to <Mail subject="Delete my Pigeon Pulse account" /> from the email
          address registered on your account.
        </li>
        <li>
          Use the subject <strong>&ldquo;Delete my Pigeon Pulse account&rdquo;</strong> and
          include your username.
        </li>
        <li>
          We may reply to confirm the request comes from you. If you cannot send from your
          registered address, tell us and we will ask you to verify your identity another way.
        </li>
        <li>
          We delete your account within <strong>30 days</strong> of confirming the request and
          email you when it is done.
        </li>
      </ol>
      <p>
        Before deleting, make sure any open entries, bets or balances with an event are settled.
        Deleting your account cannot be undone.
      </p>

      <h2>What we delete</h2>
      <ul>
        <li>Your account: name, username, email address and password.</li>
        <li>Your profile: phone number, address, loft name, website and profile picture.</li>
        <li>Tax identification numbers and documents, unless we must keep them by law.</li>
        <li>Your bird photos and notes, and your push notification tokens.</li>
        <li>Your messages, notifications and team memberships.</li>
      </ul>

      <h2>What we keep, and for how long</h2>
      <ul>
        <li>
          <strong>Payment, betting, prize and tax records</strong> are kept for as long as
          financial and tax laws require, then deleted. They are used for nothing else.
        </li>
        <li>
          <strong>Race results</strong> that have already been published (band numbers, arrival
          times and speeds) stay part of the event&rsquo;s official results, but are no longer
          linked to your name or contact details.
        </li>
        <li>
          <strong>Backups</strong> may hold your data for up to 30 more days until they are
          overwritten.
        </li>
      </ul>

      <h2>Delete some data without closing your account</h2>
      <p>
        You can change or remove most profile details yourself in the app. To ask us to delete
        specific data while keeping your account, email <Mail /> and tell us what you would like
        removed.
      </p>

      <p>
        See our <Link href="/privacy">Privacy Policy</Link> for more about how we handle your
        data.
      </p>
    </LegalPage>
  );
}
