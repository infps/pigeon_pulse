"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, X, Bird as BirdIcon } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import type { Bird } from "@/lib/types";
import { getSexLabel } from "@/lib/bird-constants";
import { useSettings } from "@/lib/settings-context";
import { BirdDetailDialog } from "@/components/bird-detail-dialog";

interface PedigreePanelProps {
  bird: Bird;
  isOwner: boolean;
  onUpdate: () => void;
}

function BirdCard({
  bird,
  label,
  onRemove,
  isOwner,
  onOpen,
}: {
  bird: Bird;
  label: string;
  onRemove?: () => void;
  isOwner: boolean;
  onOpen: (id: number) => void;
}) {
  const { sexTerminology } = useSettings();
  return (
    <div
      className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onOpen(bird.id)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {isOwner && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className="font-mono text-sm font-medium">{bird.band || "No band"}</p>
      <p className="text-sm text-muted-foreground">{bird.birdName || "Unnamed"}</p>
      <div className="flex gap-2 mt-1">
        {bird.color && <Badge variant="outline" className="text-xs">{bird.color}</Badge>}
        <span className="text-xs text-muted-foreground">{getSexLabel(bird.sex, sexTerminology)}</span>
      </div>
    </div>
  );
}

function BirdListItem({ bird, onOpen }: { bird: Bird; onOpen: (id: number) => void }) {
  const { sexTerminology } = useSettings();
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onOpen(bird.id)}
    >
      <div>
        <p className="font-mono text-sm">{bird.band || "No band"}</p>
        <p className="text-xs text-muted-foreground">{bird.birdName || "Unnamed"}</p>
      </div>
      <div className="flex gap-2 items-center">
        {bird.color && <Badge variant="outline" className="text-xs">{bird.color}</Badge>}
        <span className="text-xs text-muted-foreground">{getSexLabel(bird.sex, sexTerminology)}</span>
      </div>
    </div>
  );
}

function AssignParentDialog({
  open,
  onOpenChange,
  parentType,
  birdId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentType: "father" | "mother";
  birdId: number;
  onSuccess: () => void;
}) {
  const [bandSearch, setBandSearch] = useState("");
  const [results, setResults] = useState<Bird[]>([]);
  const [searching, setSearching] = useState(false);

  const updateMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birdById(birdId),
    method: "PATCH",
    queryKey: ["breeder", "birds"],
    onSuccess: () => {
      toast.success(`${parentType === "father" ? "Father" : "Mother"} assigned`);
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to assign parent"),
  });

  const handleSearch = async () => {
    if (!bandSearch.trim()) return;
    setSearching(true);
    try {
      const sexFilter = parentType === "father" ? 1 : 2;
      const res = await fetch(
        `/api/breeder/birds?search=${encodeURIComponent(bandSearch)}&sex=${sexFilter}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults((data.birds || []).filter((b: Bird) => b.id !== birdId));
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async (parentBird: Bird) => {
    await updateMutation.mutateAsync({
      [parentType === "father" ? "fatherId" : "motherId"]: parentBird.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assign {parentType === "father" ? "Father" : "Mother"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={bandSearch}
              onChange={(e) => setBandSearch(e.target.value)}
              placeholder="Search by band or name..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={handleSearch}
              disabled={searching}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {results.length === 0 && !searching && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Search for a bird to assign as {parentType}
              </p>
            )}
            {results.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => handleAssign(b)}
              >
                <div>
                  <p className="font-mono text-sm">{b.band}</p>
                  <p className="text-xs text-muted-foreground">{b.birdName}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {b.color}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PedigreePanel({ bird, isOwner, onUpdate }: PedigreePanelProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignType, setAssignType] = useState<"father" | "mother">("father");
  const [detailBirdId, setDetailBirdId] = useState<number | null>(null);

  const updateMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birdById(bird.id),
    method: "PATCH",
    queryKey: ["breeder", "birds"],
    onSuccess: () => {
      toast.success("Parent removed");
      onUpdate();
    },
    onError: () => toast.error("Failed to remove parent"),
  });

  const handleRemoveParent = async (type: "father" | "mother") => {
    await updateMutation.mutateAsync({
      [type === "father" ? "fatherId" : "motherId"]: null,
    });
  };

  const offspring = [
    ...(bird.childrenAsFather || []),
    ...(bird.childrenAsMother || []),
  ];
  // Deduplicate by id
  const uniqueOffspring = offspring.filter(
    (b, i, arr) => arr.findIndex((x) => x.id === b.id) === i
  );

  const siblings = bird.siblings || [];

  return (
    <>
      <Tabs defaultValue="parents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="parents">Parents</TabsTrigger>
          <TabsTrigger value="siblings">
            Siblings {siblings.length > 0 && `(${siblings.length})`}
          </TabsTrigger>
          <TabsTrigger value="offspring">
            Offspring {uniqueOffspring.length > 0 && `(${uniqueOffspring.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parents" className="mt-4 space-y-3">
          {bird.father ? (
            <BirdCard
              bird={bird.father}
              label="Father"
              isOwner={isOwner}
              onRemove={() => handleRemoveParent("father")}
              onOpen={setDetailBirdId}
            />
          ) : (
            <div className="border rounded-lg p-3 border-dashed">
              <p className="text-xs text-muted-foreground mb-2">Father</p>
              <p className="text-sm text-muted-foreground mb-2">Not assigned</p>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAssignType("father");
                    setAssignOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Assign Father
                </Button>
              )}
            </div>
          )}

          {bird.mother ? (
            <BirdCard
              bird={bird.mother}
              label="Mother"
              isOwner={isOwner}
              onRemove={() => handleRemoveParent("mother")}
              onOpen={setDetailBirdId}
            />
          ) : (
            <div className="border rounded-lg p-3 border-dashed">
              <p className="text-xs text-muted-foreground mb-2">Mother</p>
              <p className="text-sm text-muted-foreground mb-2">Not assigned</p>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAssignType("mother");
                    setAssignOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Assign Mother
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="siblings" className="mt-4">
          {siblings.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <BirdIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No siblings found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {siblings.map((s) => (
                <BirdListItem key={s.id} bird={s} onOpen={setDetailBirdId} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="offspring" className="mt-4">
          {uniqueOffspring.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <BirdIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No offspring found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {uniqueOffspring.map((o) => (
                <BirdListItem key={o.id} bird={o} onOpen={setDetailBirdId} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AssignParentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        parentType={assignType}
        birdId={bird.id}
        onSuccess={onUpdate}
      />

      <BirdDetailDialog
        open={detailBirdId !== null}
        onOpenChange={(o) => { if (!o) setDetailBirdId(null); }}
        birdId={detailBirdId}
        eventId={null}
      />
    </>
  );
}
