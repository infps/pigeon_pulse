"use client";

import type { Event, EventInventoryItemDetail } from "@/lib/types";
import { useListEventInventoryItems } from "@/lib/api/event-inventory-items";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { birdsColumns } from "./birds-columns";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useListUsers } from "@/lib/api/users";

interface BirdsTabProps {
  event: Event;
  eventId: string;
}

export function BirdsTab({ event, eventId }: BirdsTabProps) {
  const { data, isPending, error } = useListEventInventoryItems(eventId);
  const { data: usersData } = useListUsers({ params: { role: "BREEDER" } });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  function getNowForDateTimeLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}
  const [formData, setFormData] = useState({
    breederId: "",
    band1: "",
    band2: "",
    band3: "",
    band4: "",
    birdName: "",
    color: "",
    sex: "COCK",
    isActive: true,
    isLost: false,
    lostDate: "",
    lostRaceId: "",
    note: "",
    arrivalTime: getNowForDateTimeLocal(),
    departureTime: "",
    isBackup: false,
    belgianShowBet1: false,
    belgianShowBet2: false,
    belgianShowBet3: false,
    belgianShowBet4: false,
    belgianShowBet5: false,
    belgianShowBet6: false,
    belgianShowBet7: false,
    standardShowBet1: false,
    standardShowBet2: false,
    standardShowBet3: false,
    standardShowBet4: false,
    standardShowBet5: false,
    wtaBet1: false,
    wtaBet2: false,
    wtaBet3: false,
    wtaBet4: false,
    wtaBet5: false,
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error loading birds</p>
      </div>
    );
  }

  const eventInventoryItems: EventInventoryItemDetail[] =
    data?.eventInventoryItems || [];

  const breeders = usersData?.users || [];
  const races = event.races || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Backend implementation will come later
    console.log("Form data:", formData);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Bird
        </Button>
      </div>

      <DataTable columns={birdsColumns} data={eventInventoryItems} />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Bird</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Breeder Selection */}
            <div className="space-y-2">
              <Label htmlFor="breederId">Breeder *</Label>
              <Select
                value={formData.breederId}
                onValueChange={(value) =>
                  setFormData({ ...formData, breederId: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select breeder" />
                </SelectTrigger>
                <SelectContent>
                  {breeders.map((breeder: any) => (
                    <SelectItem key={breeder.id} value={breeder.id}>
                      {breeder.name} {breeder.lastName || ""} ({breeder.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Band Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Band Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="band1">Band 1 *</Label>
                  <Input
                    id="band1"
                    value={formData.band1}
                    onChange={(e) =>
                      setFormData({ ...formData, band1: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="band2">Band 2 *</Label>
                  <Input
                    id="band2"
                    value={formData.band2}
                    onChange={(e) =>
                      setFormData({ ...formData, band2: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="band3">Band 3 *</Label>
                  <Input
                    id="band3"
                    value={formData.band3}
                    onChange={(e) =>
                      setFormData({ ...formData, band3: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="band4">Band 4 *</Label>
                  <Input
                    id="band4"
                    value={formData.band4}
                    onChange={(e) =>
                      setFormData({ ...formData, band4: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* Bird Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Bird Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birdName">Name *</Label>
                  <Input
                    id="birdName"
                    value={formData.birdName}
                    onChange={(e) =>
                      setFormData({ ...formData, birdName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color *</Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sex">Sex *</Label>
                  <Select
                    value={formData.sex}
                    onValueChange={(value) =>
                      setFormData({ ...formData, sex: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COCK">Cock</SelectItem>
                      <SelectItem value="HEN">Hen</SelectItem>
                      <SelectItem value="UNKNOWN">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note</Label>
                  <Input
                    id="note"
                    value={formData.note}
                    onChange={(e) =>
                      setFormData({ ...formData, note: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Status Checkboxes */}
            <div className="space-y-4">
              <h3 className="font-semibold">Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: !!checked })
                    }
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Is Active
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isLost"
                    checked={formData.isLost}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isLost: !!checked })
                    }
                  />
                  <Label htmlFor="isLost" className="cursor-pointer">
                    Is Lost
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isBackup"
                    checked={formData.isBackup}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isBackup: !!checked })
                    }
                  />
                  <Label htmlFor="isBackup" className="cursor-pointer">
                    Is Backup
                  </Label>
                </div>
              </div>
            </div>

            {/* Lost Information */}
            {formData.isLost && (
              <div className="space-y-4">
                <h3 className="font-semibold">Lost Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lostDate">Lost Date</Label>
                    <Input
                      id="lostDate"
                      type="datetime-local"
                      value={formData.lostDate}
                      onChange={(e) =>
                        setFormData({ ...formData, lostDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lostRaceId">Lost Race</Label>
                    <Select
                      value={formData.lostRaceId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, lostRaceId: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select race" />
                      </SelectTrigger>
                      <SelectContent>
                        {races.map((race: any) => (
                          <SelectItem key={race.raceId} value={race.raceId}>
                            {race.location} - {new Date(race.releaseDate).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Arrival/Departure Times */}
            <div className="space-y-4">
              <h3 className="font-semibold">Times</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="arrivalTime">Arrival Time</Label>
                  <Input
                    id="arrivalTime"
                    type="datetime-local"
                    value={formData.arrivalTime}
                    onChange={(e) =>
                      setFormData({ ...formData, arrivalTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departureTime">Departure Time</Label>
                  <Input
                    id="departureTime"
                    type="datetime-local"
                    value={formData.departureTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        departureTime: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Belgian Show Bets */}
            <div className="space-y-4">
              <h3 className="font-semibold">Belgian Show Bets</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <div key={num} className="flex items-center space-x-2">
                    <Checkbox
                      id={`belgianShowBet${num}`}
                      checked={formData[`belgianShowBet${num}` as keyof typeof formData] as boolean}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          [`belgianShowBet${num}`]: !!checked,
                        })
                      }
                    />
                    <Label
                      htmlFor={`belgianShowBet${num}`}
                      className="cursor-pointer"
                    >
                      Bet {num}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Standard Show Bets */}
            <div className="space-y-4">
              <h3 className="font-semibold">Standard Show Bets</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num} className="flex items-center space-x-2">
                    <Checkbox
                      id={`standardShowBet${num}`}
                      checked={formData[`standardShowBet${num}` as keyof typeof formData] as boolean}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          [`standardShowBet${num}`]: !!checked,
                        })
                      }
                    />
                    <Label
                      htmlFor={`standardShowBet${num}`}
                      className="cursor-pointer"
                    >
                      Bet {num}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* WTA Bets */}
            <div className="space-y-4">
              <h3 className="font-semibold">WTA Bets</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num} className="flex items-center space-x-2">
                    <Checkbox
                      id={`wtaBet${num}`}
                      checked={formData[`wtaBet${num}` as keyof typeof formData] as boolean}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          [`wtaBet${num}`]: !!checked,
                        })
                      }
                    />
                    <Label
                      htmlFor={`wtaBet${num}`}
                      className="cursor-pointer"
                    >
                      Bet {num}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Bird</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
