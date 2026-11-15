import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, LegalPage, Mail } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Pigeon Pulse",
  description: "How Pigeon Pulse collects, uses and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 13, 2026">
      <p>
        This policy explains what information {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects when you use the Pigeon Pulse mobile app for Android and iOS and the Pigeon
        Pulse website (together, the &ldquo;Service&rdquo;), how we use it, who we share it
        with, and the choices you have. If you have a question, email us at <Mail />.
      </p>

      <h2>Information we collect</h2>
      <p>
        <strong>Account information.</strong> When you create an account: your name, username,
        email address and password. Passwords are stored only in hashed form.
      </p>
      <p>
        <strong>Profile and contact details.</strong> Information you add to your profile, such
        as your phone number, postal address, loft name, website and profile picture.
      </p>
      <p>
        <strong>Tax information.</strong> If you win prize money, we may ask for a tax
        identification number (for example a Social Security or tax number) and supporting
        documents where the law requires us to report prize payments. This is only collected
        when needed for that purpose.
      </p>
      <p>
        <strong>Racing information.</strong> The birds you register (band numbers, names,
        colour, sex, photos, notes, vaccination records), your event and race entries, team
        memberships, and race results such as arrival times and speeds.
      </p>
      <p>
        <strong>Payments and bets.</strong> Records of entry fees, store purchases, bets and
        pool entries, prizes and refunds. Payments are processed by PayPal. We receive a
        confirmation of the payment, not your full card or bank details.
      </p>
      <p>
        <strong>Location.</strong> Only for race staff who use the transport and liberation
        feature. While a transport is being tracked, the app collects the device&rsquo;s precise
        location, including in the background, so that organisers and breeders can follow the
        truck and record the release point. Tracking stops when the transport is ended. Breeders
        who do not use this feature do not have their location collected.
      </p>
      <p>
        <strong>Device and usage information.</strong> A push notification token so we can send
        you race and account notifications, and basic technical information our servers record
        automatically, such as your IP address, device type, operating system version and the
        time of requests.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To create and run your account and verify who you are.</li>
        <li>To register birds, take entries, run races and calculate and publish results.</li>
        <li>To process payments, bets, prizes and refunds, and to keep financial records.</li>
        <li>To send you notifications and messages about events, races and your account.</li>
        <li>To show live transport tracking during races.</li>
        <li>To meet legal, tax and regulatory obligations.</li>
        <li>To keep the Service secure, prevent fraud and fix problems.</li>
      </ul>
      <p>We do not sell your personal information and we do not use it for third-party advertising.</p>

      <h2>What other people can see</h2>
      <p>
        Pigeon racing is public by nature. Race results, which can include your name or loft
        name, your birds&rsquo; band numbers and their arrival times and speeds, are shown to
        other users and may be published by the event organiser. Race organisers and staff can
        see the details needed to run their events, such as your contact details, entries and
        payment status.
      </p>

      <h2>Who we share information with</h2>
      <ul>
        <li>
          <strong>Event organisers</strong> of events you enter, so they can run the event.
        </li>
        <li>
          <strong>PayPal</strong>, to process payments, under{" "}
          <a href="https://www.paypal.com/legalhub/privacy-full" target="_blank" rel="noreferrer">
            PayPal&rsquo;s privacy policy
          </a>
          .
        </li>
        <li>
          <strong>Service providers</strong> that host and run the Service for us, such as
          cloud hosting, database and file storage providers, and the Apple, Google and Expo push
          notification services. They may only use the data to provide their service to us.
        </li>
        <li>
          <strong>Map providers</strong> (such as OpenStreetMap and Esri), which receive your IP
          address when the app loads map tiles.
        </li>
        <li>
          <strong>Authorities</strong>, when the law requires it, or to protect the rights and
          safety of our users and the Service.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        All data travels between the app and our servers over encrypted (HTTPS) connections.
        Access to personal data is limited to people who need it to run the Service. No system
        is perfectly secure, but we work to protect your information.
      </p>

      <h2>How long we keep information</h2>
      <p>
        We keep your information while your account is open. When you delete your account, we
        delete or anonymise your personal information, except records we must keep by law, such
        as payment, betting, prize and tax records, which we keep only for as long as the law
        requires. Published race results may keep your birds&rsquo; band numbers and times
        without your personal details.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>You can view and update your profile in the app at any time.</li>
        <li>You can turn off location access and notifications in your device settings.</li>
        <li>
          You can ask for a copy of your data, ask us to correct it, or ask us to delete it, by
          emailing <Mail />.
        </li>
        <li>
          You can delete your account. See{" "}
          <Link href="/delete-account">how to delete your account</Link>.
        </li>
      </ul>
      <p>
        Depending on where you live, you may have further rights under local law (for example
        the GDPR in the EU and UK, or state privacy laws in the United States). We will respond
        to any request within the time the law requires.
      </p>

      <h2>Children</h2>
      <p>
        The Service is not intended for anyone under 18, and betting features are only for
        adults of legal age where they live. We do not knowingly collect information from
        children. If you believe a child has given us information, contact us and we will
        delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy. When we do, we will change the date at the top of this page,
        and tell you in the app if the changes are significant.
      </p>

      <h2>Contact us</h2>
      <p>
        {COMPANY}
        <br />
        Email: <Mail />
      </p>
    </LegalPage>
  );
}
