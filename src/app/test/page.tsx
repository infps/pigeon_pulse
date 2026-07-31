"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VIEWS = [
  {
    href: "/test/breeder-flow",
    label: "Breeder & Bird Registration Flow",
    badge: "NEW",
    badgeClass: "bg-purple-100 text-purple-800",
    description: "Admin opens breeder list → selects breeder → picks bird → sheet modal handles all 3 states: No Band (full stepper), Needs RFID (partial stepper), Registered (detail view + edit).",
  },
  {
    href: "/test/admin",
    label: "Admin View",
    badge: "ADMIN / SUPERADMIN",
    badgeClass: "bg-red-100 text-red-800",
    description: "Full bird detail: identity, properties, RFID, status, vaccinations, group/color, basket assignments, fees, bet classes, race history, event audit log, notes, pedigree.",
  },
  {
    href: "/test/owner",
    label: "Breeder Owner View",
    badge: "BREEDER + isOwner",
    badgeClass: "bg-blue-100 text-blue-800",
    description: "Image (editable), name, band, color, status badge, attention flag (read-only), race results for the event context.",
  },
  {
    href: "/test/nonowner",
    label: "Breeder Non-Owner View",
    badge: "BREEDER + !isOwner",
    badgeClass: "bg-gray-100 text-gray-700",
    description: "Name and band only + race results for the event context (position, race name, status). No image, no fees, no bets.",
  },
];

export default function TestIndexPage() {
  return (
    <div className="container mx-auto p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bird Detail — View Previews</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Demo data from <code className="font-mono text-xs bg-muted px-1 rounded">/test/demo</code>. Pick a view to preview.
        </p>
      </div>

      <div className="space-y-4">
        {VIEWS.map((v) => (
          <Link key={v.href} href={`${v.href}?bird=0`}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  {v.label}
                  <Badge className={v.badgeClass}>{v.badge}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{v.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Each view page has a bird picker (0–9) to cycle through all 10 demo birds.
      </p>
    </div>
  );
}
