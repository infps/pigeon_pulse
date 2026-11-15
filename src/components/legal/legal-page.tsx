import type { ReactNode } from "react";

export const CONTACT_EMAIL = "jdsuperfarm@gmail.com";
export const COMPANY = "Pigeon Pulse";

/**
 * Plain, readable shell for the public legal pages.
 *
 * These pages are linked from the Google Play and App Store listings, so they
 * must load without signing in and stay readable on a phone.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      <div className="mt-8 space-y-6 leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}

export function Mail({ subject }: { subject?: string }) {
  const href = subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`;
  return <a href={href}>{CONTACT_EMAIL}</a>;
}
