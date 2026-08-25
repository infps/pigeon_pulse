"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ColumnDef } from "@tanstack/react-table";
import { Bird as BirdIcon } from "lucide-react";
import { BirdDetailDialog } from "@/components/bird-detail-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

import { useAdminListBirds, AdminBirdsFilters } from "@/lib/api/admin-birds";
import { useListBreeders } from "@/lib/api/breeders";
import { COLORS, SEX_LABELS } from "@/lib/bird-constants";
import type { Breeder } from "@/lib/types";

interface AdminBirdRow {
  id: number;
  band: string | null;
  birdName: string | null;
  color: string | null;
  rfid: string | null;
  sex: number | null;
  isActive: number | null;
  isLost: number | null;
  image: string | null;
  breeder: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    user: { loftName: string | null } | null;
  } | null;
  inventoryItems: Array<{
    id: number;
    eventInventory: {
      event: { id: number; name: string | null; eventDate: string | null } | null;
    } | null;
  }>;
}

const ALL = "__all__";

const SENTINEL_TO_VALUE = (v: string): string => (v === ALL ? "" : v);

export default function AdminBirdsPage() {
  const [search, setSearch] = useState("");
  const [breederId, setBreederId] = useState("");
  const [color, setColor] = useState("");
  const [sex, setSex] = useState("");
  const [status, setStatus] = useState("active");
  const [selectedBirdId, setSelectedBirdId] = useState<number | null>(null);

  const filters: AdminBirdsFilters = useMemo(
    () => ({ search, breederId, color, sex, status }),
    [search, breederId, color, sex, status]
  );

  const { data, isPending, isError } = useAdminListBirds(filters);
  const { data: breedersData } = useListBreeders();

  const birds: AdminBirdRow[] = data?.birds ?? [];
  const breeders: Breeder[] = breedersData?.breeders ?? [];

  const clearFilters = () => {
    setSearch("");
    setBreederId("");
    setColor("");
    setSex("");
    setStatus("all");
  };

  const columns: ColumnDef<AdminBirdRow>[] = useMemo(
    () => [
      {
        id: "image",
        header: "",
        cell: ({ row }) => {
          const img = row.original.image;
          return img ? (
            <Image
              src={img}
              alt={row.original.band ?? "bird"}
              width={40}
              height={40}
              className="rounded-md object-cover h-10 w-10"
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
              <BirdIcon className="size-4 text-muted-foreground" />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "breeder",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Breeder" />,
        accessorFn: (r) =>
          `${r.breeder?.firstName ?? ""} ${r.breeder?.lastName ?? ""}`.trim(),
        cell: ({ row }) => {
          const b = row.original.breeder;
          if (!b) return <span className="text-muted-foreground">—</span>;
          const name = `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim() || "Unnamed";
          const loft = b.user?.loftName;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{name}</span>
              {loft && <span className="text-xs text-muted-foreground">{loft}</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "band",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Band" />,
        cell: ({ row }) => row.original.band ?? "—",
      },
      {
        id: "birdName",
        accessorKey: "birdName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bird Name" />,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.birdName || `#${row.original.id}`}
          </span>
        ),
      },
      {
        accessorKey: "color",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Color" />,
        cell: ({ row }) => row.original.color ?? "—",
      },
      {
        id: "sex",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sex" />,
        cell: ({ row }) => SEX_LABELS[row.original.sex ?? 0] ?? "Unknown",
      },
      {
        accessorKey: "rfid",
        header: ({ column }) => <DataTableColumnHeader column={column} title="RFID" />,
        cell: ({ row }) =>
          row.original.rfid ? (
            <span className="font-mono text-xs">{row.original.rfid}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "statusBadge",
        header: "Status",
        cell: ({ row }) => {
          if (row.original.isLost === 1) return <Badge variant="destructive">Lost</Badge>;
          if (row.original.isActive === 1) return <Badge>Active</Badge>;
          return <Badge variant="secondary">Inactive</Badge>;
        },
      },
      {
        id: "lastEvent",
        header: "Last Event",
        cell: ({ row }) => {
          const ev = row.original.inventoryItems?.[0]?.eventInventory?.event;
          return ev?.name ? (
            <span className="text-sm">{ev.name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">All Birds</h1>
          <Badge variant="secondary">{birds.length}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4 items-end">
        <div className="md:col-span-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Name, band, RFID, breeder…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Label>Breeder</Label>
          <Select
            value={breederId === "" ? ALL : breederId}
            onValueChange={(v) => setBreederId(SENTINEL_TO_VALUE(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {breeders.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {(b.firstName ?? "") + " " + (b.lastName ?? "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Color</Label>
          <Select
            value={color === "" ? ALL : color}
            onValueChange={(v) => setColor(SENTINEL_TO_VALUE(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {COLORS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sex</Label>
          <Select
            value={sex === "" ? ALL : sex}
            onValueChange={(v) => setSex(SENTINEL_TO_VALUE(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="1">Cock</SelectItem>
              <SelectItem value="2">Hen</SelectItem>
              <SelectItem value="0">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-6">
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-62.5" />
          <Skeleton className="h-100 w-full" />
        </div>
      ) : isError ? (
        <div className="text-red-500">Error loading birds</div>
      ) : (
        <DataTable
          columns={columns}
          data={birds}
          onRowClick={(bird) => setSelectedBirdId(bird.id)}
          rowClickMode="action"
        />
      )}

      <BirdDetailDialog
        open={selectedBirdId !== null}
        onOpenChange={(o) => { if (!o) setSelectedBirdId(null); }}
        birdId={selectedBirdId}
        eventId={null}
      />
    </div>
  );
}
