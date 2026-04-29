"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { Plus, Bird as BirdIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { createBirdColumns } from "./columns";
import { BirdDialog } from "./bird-dialog";

interface Bird {
  id: number;
  band: string;
  band1?: string;
  band2?: string;
  band3?: string;
  band4?: string;
  birdName: string;
  color: string;
  sex: number;
}

export default function BirdsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBird, setEditingBird] = useState<Bird | null>(null);

  const { data, isPending, refetch } = useApiQuery({
    endpoint: apiEndpoints.breeder.birds,
    queryKey: ["breeder", "birds"],
    enabled: !!session?.user,
  });

  const birds: Bird[] = data?.birds || [];

  const handleEdit = (bird: Bird) => {
    setEditingBird(bird);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingBird(null);
    setDialogOpen(true);
  };

  const columns = useMemo(() => createBirdColumns(handleEdit), []);

  if (sessionLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Not Logged In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please log in to manage your birds.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Birds</h1>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bird
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : birds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BirdIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No birds yet. Add your first bird.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={birds}
              filterableColumns={[
                { id: "band", title: "Band" },
                { id: "birdName", title: "Bird Name" },
              ]}
              onRowClick={(bird) => handleEdit(bird)}
            />
          </CardContent>
        </Card>
      )}

      <BirdDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bird={editingBird}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
