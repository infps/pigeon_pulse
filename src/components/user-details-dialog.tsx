"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListBreederBirds } from "@/lib/api/breeders";
import { getCountryName, getStateName } from "@/lib/flag-constants";
import { SEX_LABELS } from "@/lib/bird-constants";
import type { User } from "@/lib/types";

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function UserDetailsDialog({ open, onOpenChange, user }: UserDetailsDialogProps) {
  const { data, isPending } = useListBreederBirds(user?.breederId ?? null);
  const birds = data?.birds || [];

  if (!user) return null;

  const roleVariant =
    user.role === "SUPERADMIN" ? "default" :
    user.role === "ADMIN" ? "secondary" : "outline";

  const statusVariant =
    user.status === "ACTIVE" ? "default" :
    user.status === "INACTIVE" ? "destructive" : "secondary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {user.name}{user.lastName ? ` ${user.lastName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg">
            <InfoField label="Email" value={user.email} />
            <InfoField label="Phone" value={user.phoneNumber} />
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge variant={roleVariant}>{user.role}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={statusVariant}>{user.status}</Badge>
            </div>
            <InfoField label="Username" value={user.username} />
            <InfoField label="Country" value={user.country ? getCountryName(user.country) : null} />
            <InfoField label="State" value={user.state ? getStateName(user.state) : null} />
            <InfoField label="City" value={user.city} />
            <InfoField label="Address" value={user.address} />
            <InfoField label="Postal Code" value={user.postalCode} />
            <InfoField label="Website" value={user.webAddress} />
            <InfoField label="SSN" value={user.ssn} />
            <InfoField label="Tax Number" value={user.taxNumber} />
            {user.note && (
              <div className="col-span-2 md:col-span-4">
                <InfoField label="Note" value={user.note} />
              </div>
            )}
          </div>

          {/* Birds */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Birds ({birds.length})</h3>
            {isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : birds.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                No birds found
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Band</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Sex</TableHead>
                      <TableHead>RFID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {birds.map((bird: any) => (
                      <TableRow key={bird.id}>
                        <TableCell className="text-sm">{bird.band || "-"}</TableCell>
                        <TableCell className="text-sm">{bird.birdName || "-"}</TableCell>
                        <TableCell className="text-sm">{bird.color || "-"}</TableCell>
                        <TableCell className="text-sm">{SEX_LABELS[bird.sex] || "Unknown"}</TableCell>
                        <TableCell className="text-sm">{bird.rfid || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-semibold">{value || "-"}</p>
    </div>
  );
}
