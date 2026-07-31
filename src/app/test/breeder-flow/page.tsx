"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Search,
  Check,
  ChevronRight,
  Camera,
  Scan,
  AlertTriangle,
  Settings,
  FileText,
  MapPin,
  Clock,
  User,
  Plus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BirdState = "NO_BAND" | "NO_RFID" | "REGISTERED";

interface DemoBet {
  label: string;
  value: number;
  stakePaid: boolean;
  isOwner: boolean;
}

interface DemoInventoryItem {
  eventName: string;
  signInDate: string;
  arrivalDate: string | null;
  departureDate: string | null;
  entryFeeValue: number;
  perchFeeValue: number;
  raceFeeValue: number;
  hotSpotFeeValue: number;
  entryRefund: number;
  hotSpotRefund: number;
  betsRefund: number;
  belgianBets: DemoBet[];
  standardBets: DemoBet[];
  wtaBets: DemoBet[];
  basketLabel: string | null;
  basketPhase: string | null;
  raceItems: { raceName: string; status: string; position: number | null; prize: number | null; arrivalTime: string | null }[];
}

interface DemoBird {
  id: number;
  birdNo: number;
  birdName: string | null;
  band: string | null;
  band1: string | null;
  band2: string | null;
  band3: string | null;
  band4: string | null;
  color: string | null;
  sex: number | null;
  rfid: string | null;
  isActive: number;
  isLost: number;
  lostDate: string | null;
  attention: boolean;
  note: string | null;
  image: string | null;
  state: BirdState;
  loftGroup: { name: string; color: string } | null;
  entryFeeValue: number;
  perchFeeValue: number;
  raceFeeValue: number;
  hotSpotFeeValue: number;
  entryRefund: number;
  arrivalDate: string | null;
  departureDate: string | null;
  isBackup: number;
  inventoryItems: DemoInventoryItem[];
}

interface DemoBreeder {
  id: number;
  firstName: string;
  lastName: string;
  loftName: string;
  country: string;
  state1: string;
  email: string;
  phone: string;
  signInDate: string | null;
  reservedBirds: number;
  note: string | null;
  birds: DemoBird[];
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_INVENTORY: DemoInventoryItem = {
  eventName: "Spring Classic 2024",
  signInDate: "2024-04-01",
  arrivalDate: "2024-04-02",
  departureDate: "2024-04-10",
  entryFeeValue: 50,
  perchFeeValue: 10,
  raceFeeValue: 25,
  hotSpotFeeValue: 15,
  entryRefund: 0,
  hotSpotRefund: 0,
  betsRefund: 0,
  belgianBets: [
    { label: "B1", value: 100, stakePaid: true, isOwner: true },
    { label: "B2", value: 80, stakePaid: false, isOwner: true },
  ],
  standardBets: [
    { label: "S1", value: 200, stakePaid: true, isOwner: false },
  ],
  wtaBets: [
    { label: "W1", value: 500, stakePaid: false, isOwner: false },
  ],
  basketLabel: "LB-SMITH-1",
  basketPhase: "LOFT",
  raceItems: [
    { raceName: "Race 1 - 200km", status: "ARRIVED", position: 3, prize: 150, arrivalTime: "2024-04-05T14:32:00Z" },
    { raceName: "Race 2 - 400km", status: "ARRIVED", position: 1, prize: 500, arrivalTime: "2024-04-08T09:15:00Z" },
  ],
};

const mkBird = (
  id: number, no: number, name: string | null, band: string | null,
  b1: string | null, b2: string | null, b3: string | null, b4: string | null,
  color: string | null, sex: number | null, rfid: string | null,
  state: BirdState, group: { name: string; color: string } | null = null,
  opts: Partial<DemoBird> = {}
): DemoBird => ({
  id, birdNo: no, birdName: name, band,
  band1: b1, band2: b2, band3: b3, band4: b4,
  color, sex, rfid,
  isActive: 1, isLost: 0, lostDate: null, attention: false, note: null, image: null,
  state, loftGroup: group,
  entryFeeValue: 50, perchFeeValue: 10, raceFeeValue: 25, hotSpotFeeValue: 15,
  entryRefund: 0, arrivalDate: "2024-04-02", departureDate: null, isBackup: 0,
  inventoryItems: state === "REGISTERED" ? [DEMO_INVENTORY] : [],
  ...opts,
});

const DEMO_BREEDERS: DemoBreeder[] = [
  {
    id: 1, firstName: "John", lastName: "Smith", loftName: "Smith Loft",
    country: "AU", state1: "NSW", email: "john.smith@example.com", phone: "+61 400 111 222",
    signInDate: "2024-04-01", reservedBirds: 3, note: "Returning champion breeder.",
    birds: [
      mkBird(101, 1, "Blue Thunder", "AU-2024-ABC-1001", "AU", "2024", "ABC", "1001", "Blue Bar", 1, "RF001122334455", "REGISTERED",
        { name: "Group A - Spring 2024", color: "#3B82F6" }, { attention: true, note: "Strong performer in long distance" }),
      mkBird(102, 2, "Silver Arrow", "AU-2024-ABC-1002", "AU", "2024", "ABC", "1002", "Silver", 1, null, "NO_RFID",
        null, { note: "Young bird, first season" }),
      mkBird(103, 3, null, null, null, null, null, null, null, null, null, "NO_BAND"),
    ],
  },
  {
    id: 2, firstName: "Mary", lastName: "Jones", loftName: "Jones Racing",
    country: "AU", state1: "VIC", email: "mary.jones@example.com", phone: "+61 400 333 444",
    signInDate: "2024-04-01", reservedBirds: 2, note: null,
    birds: [
      mkBird(201, 1, "Red Rocket", "AU-2023-XYZ-2001", "AU", "2023", "XYZ", "2001", "Red", 2, "RF002233445566", "REGISTERED",
        { name: "Group B - Winter 2024", color: "#EF4444" }),
      mkBird(202, 2, "Golden Wing", "AU-2023-XYZ-2002", "AU", "2023", "XYZ", "2002", "Yellow", 2, null, "NO_RFID"),
    ],
  },
  {
    id: 3, firstName: "Bob", lastName: "Williams", loftName: "Williams Pigeons",
    country: "AU", state1: "QLD", email: "bob.williams@example.com", phone: "+61 400 555 666",
    signInDate: "2024-04-01", reservedBirds: 2, note: null,
    birds: [
      mkBird(301, 1, null, null, null, null, null, null, null, null, null, "NO_BAND"),
      mkBird(302, 2, null, null, null, null, null, null, null, null, null, "NO_BAND"),
    ],
  },
];

// Active OPEN loft group — auto-assigned on RFID scan (mirrors EventGroup with status=OPEN)
const ACTIVE_LOFT_GROUP = { id: 1, name: "Group A - Spring 2024", color: "#3B82F6", tagColor: "#3B82F6", capacity: 10, memberCount: 6 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString(); } catch { return "-"; }
}
function fmtMoney(v: number) { return `$${v.toFixed(2)}`; }
function sexLabel(sex: number | null) {
  if (sex === 1) return "Cock";
  if (sex === 2) return "Hen";
  return "Unknown";
}
function sexShort(sex: number | null) {
  if (sex === 1) return "M";
  if (sex === 2) return "F";
  return "-";
}
function stateBadge(state: BirdState) {
  if (state === "NO_BAND") return <Badge variant="destructive" className="text-xs">No Band</Badge>;
  if (state === "NO_RFID") return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-xs">Needs RFID</Badge>;
  return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Registered</Badge>;
}

// ─── Registration Stepper ─────────────────────────────────────────────────────

// Steps: rfid-scan → group-result → photo → confirm (same for both NO_BAND and NO_RFID)
type RegStep = "rfid-scan" | "group-result" | "photo" | "confirm";

const STEP_LABELS: Record<RegStep, string> = {
  "rfid-scan": "RFID Scan",
  "group-result": "Group",
  "photo": "Photo",
  "confirm": "Confirm",
};

function stepOrder(_s: BirdState): RegStep[] {
  return ["rfid-scan", "group-result", "photo", "confirm"];
}

interface RegState {
  // bird-info step (only for NO_BAND)
  birdName: string;
  band1: string; band2: string; band3: string; band4: string;
  color: string; sex: string;
  // rfid-scan step
  rfid: string;
  // photo step
  photoUrl: string | null;
}

function RegistrationStepper({
  bird, onComplete, onCancel, onAddNew,
}: {
  bird: DemoBird;
  onComplete: (updates: Partial<DemoBird>) => void;
  onCancel: () => void;
  onAddNew: () => void;
}) {
  const steps = stepOrder(bird.state);
  const [idx, setIdx] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [reg, setReg] = useState<RegState>({
    birdName: bird.birdName ?? "",
    band1: bird.band1 ?? "", band2: bird.band2 ?? String(new Date().getFullYear()),
    band3: bird.band3 ?? "", band4: bird.band4 ?? "",
    color: bird.color ?? "", sex: bird.sex ? String(bird.sex) : "",
    rfid: bird.rfid ?? "",
    photoUrl: null,
  });

  const step = steps[idx];
  const set = (k: keyof RegState, v: string | null) => setReg(p => ({ ...p, [k]: v ?? "" }));

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      set("rfid", "RF" + Math.random().toString().slice(2, 14).padEnd(12, "0"));
      setScanning(false);
    }, 1800);
  };

  // After scan completes auto-advance to group-result
  const handleRfidConfirm = () => {
    if (!reg.rfid) return;
    setIdx(i => i + 1); // → group-result
  };

  const canNext = () => {
    if (step === "rfid-scan") return reg.rfid.length > 0;
    return true;
  };

  const buildUpdates = (): Partial<DemoBird> => {
    const newBand = [reg.band1, reg.band2, reg.band3.toUpperCase(), reg.band4].filter(Boolean).join("-");
    return {
      band: newBand || bird.band,
      band1: reg.band1 || bird.band1, band2: reg.band2 || bird.band2,
      band3: reg.band3.toUpperCase() || bird.band3, band4: reg.band4 || bird.band4,
      birdName: reg.birdName || bird.birdName,
      color: reg.color || bird.color,
      sex: reg.sex ? Number(reg.sex) : bird.sex,
      rfid: reg.rfid || null,
      image: reg.photoUrl,
      state: "REGISTERED" as BirdState,
      loftGroup: { name: ACTIVE_LOFT_GROUP.name, color: ACTIVE_LOFT_GROUP.color },
      inventoryItems: [DEMO_INVENTORY],
    };
  };

  // Step bar
  const StepBar = () => (
    <div className="flex items-center gap-1 flex-wrap mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            i < idx ? "bg-green-100 text-green-700" :
            i === idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {i < idx ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
            {STEP_LABELS[s]}
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
      ))}
    </div>
  );

  // ── Step: RFID Scan ────────────────────────────────────────────────────────
  if (step === "rfid-scan") return (
    <div className="space-y-5">
      <StepBar />
      <div>
        <h3 className="font-semibold mb-1">Scan RFID Tag</h3>
        <p className="text-sm text-muted-foreground">Hold the bird&apos;s leg tag near the scanner. The bird will be auto-assigned to the active loft group on successful scan.</p>
      </div>

      {/* Active group info */}
      <div className="flex items-center gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: ACTIVE_LOFT_GROUP.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{ACTIVE_LOFT_GROUP.name}</p>
          <p className="text-xs text-muted-foreground">Active group · {ACTIVE_LOFT_GROUP.memberCount}/{ACTIVE_LOFT_GROUP.capacity} birds</p>
        </div>
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">OPEN</Badge>
      </div>

      {/* Scanner area */}
      <div className={`border-2 rounded-xl p-8 flex flex-col items-center gap-4 text-center transition-colors ${
        scanning ? "border-primary bg-primary/5" :
        reg.rfid ? "border-green-400 bg-green-50" :
        "border-dashed border-muted-foreground/30"
      }`}>
        {scanning ? (
          <>
            {/* Animated scan rings */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full border-2 border-primary/30 animate-ping" />
              <div className="absolute w-14 h-14 rounded-full border-2 border-primary/50 animate-ping" style={{ animationDelay: "0.2s" }} />
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-semibold text-primary">Scanning...</p>
            <p className="text-xs text-muted-foreground">Hold tag steady near scanner</p>
          </>
        ) : reg.rfid ? (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700">Tag Detected</p>
              <code className="text-xs bg-white border rounded px-2 py-0.5 font-mono mt-1 inline-block">{reg.rfid}</code>
            </div>
            <Button variant="ghost" size="sm" onClick={() => set("rfid", "")}>
              <Scan className="h-3.5 w-3.5 mr-1" />Re-scan
            </Button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Scan className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Waiting for tag...</p>
            <Button onClick={simulateScan} size="sm">
              <Scan className="h-4 w-4 mr-2" />Simulate Scan
            </Button>
          </>
        )}
      </div>

      {/* Manual fallback */}
      {!scanning && !reg.rfid && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or enter manually</span></div>
          </div>
          <Input value={reg.rfid} onChange={e => set("rfid", e.target.value)} placeholder="RF001122334455" className="font-mono" />
        </>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" onClick={() => idx === 0 ? onCancel() : setIdx(i => i - 1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />{idx === 0 ? "Cancel" : "Back"}
        </Button>
        <Button onClick={handleRfidConfirm} disabled={!reg.rfid || scanning}>
          Confirm Scan <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  // ── Step: Group Result (auto-assigned, not a form) ─────────────────────────
  if (step === "group-result") return (
    <div className="space-y-5">
      <StepBar />

      {/* Big success state */}
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: ACTIVE_LOFT_GROUP.color + "20", border: `3px solid ${ACTIVE_LOFT_GROUP.color}` }}>
            <Check className="h-9 w-9" style={{ color: ACTIVE_LOFT_GROUP.color }} />
          </div>
        </div>
        <div>
          <p className="text-lg font-bold">Added to Group</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: ACTIVE_LOFT_GROUP.color }}>{ACTIVE_LOFT_GROUP.name}</p>
        </div>
      </div>

      {/* Group + tag color summary */}
      <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Loft Group</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ACTIVE_LOFT_GROUP.color }} />
            <span className="font-medium">{ACTIVE_LOFT_GROUP.name}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tag Color</span>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border shadow-sm" style={{ backgroundColor: ACTIVE_LOFT_GROUP.tagColor }} />
            <span className="font-medium font-mono text-xs">{ACTIVE_LOFT_GROUP.tagColor}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">RFID</span>
          <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{reg.rfid}</code>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Capacity</span>
          <span className="font-medium">{ACTIVE_LOFT_GROUP.memberCount + 1}/{ACTIVE_LOFT_GROUP.capacity} birds</span>
        </div>
      </div>

      {/* Two choices */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button variant="outline" onClick={onAddNew} className="h-14 flex flex-col gap-0.5">
          <span className="font-semibold">Add New Bird</span>
          <span className="text-xs text-muted-foreground font-normal">Start another registration</span>
        </Button>
        <Button onClick={() => setIdx(i => i + 1)} className="h-14 flex flex-col gap-0.5">
          <span className="font-semibold">Continue</span>
          <span className="text-xs font-normal opacity-80">Add photo & confirm</span>
        </Button>
      </div>
    </div>
  );

  // ── Step: Photo ────────────────────────────────────────────────────────────
  if (step === "photo") return (
    <div className="space-y-5">
      <StepBar />
      <div>
        <h3 className="font-semibold mb-1">Bird Photo</h3>
        <p className="text-sm text-muted-foreground">Take a photo now or skip — it can be added later from the bird detail page.</p>
      </div>

      {reg.photoUrl ? (
        <div className="relative rounded-xl overflow-hidden border aspect-square max-w-xs mx-auto">
          {/* ponytail: plain img for demo only */}
          <img src={reg.photoUrl} alt="Bird" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
          <Button variant="secondary" size="sm" className="absolute bottom-3 right-3 shadow" onClick={() => set("photoUrl", null)}>
            Retake
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 text-center bg-muted/10">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No photo yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Camera will open on device</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => set("photoUrl", "https://placehold.co/400x400/e2e8f0/475569?text=🕊️")}>
              <Camera className="h-4 w-4 mr-2" />Open Camera
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" onClick={() => setIdx(i => i - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <div className="flex gap-2">
          {!reg.photoUrl && (
            <Button variant="outline" onClick={() => setIdx(i => i + 1)}>Skip for now</Button>
          )}
          {reg.photoUrl && (
            <Button onClick={() => setIdx(i => i + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Step: Confirm ──────────────────────────────────────────────────────────
  const finalBand = [reg.band1, reg.band2, reg.band3.toUpperCase(), reg.band4].filter(Boolean).join("-") || bird.band || "—";
  return (
    <div className="space-y-5">
      <StepBar />
      <div>
        <h3 className="font-semibold mb-1">Confirm Registration</h3>
        <p className="text-sm text-muted-foreground">Review all details before completing.</p>
      </div>

      <div className="flex gap-4">
        {reg.photoUrl && (
          <div className="w-24 h-24 rounded-lg overflow-hidden border shrink-0">
            <img src={reg.photoUrl} alt="Bird" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 border rounded-xl p-4 space-y-2.5 text-sm">
          {([
            ["Bird Name", reg.birdName || bird.birdName || "—"],
            ["Band", finalBand],
            ["Color", reg.color || bird.color || "—"],
            ["Sex", sexLabel(reg.sex ? Number(reg.sex) : bird.sex)],
            ["RFID", reg.rfid || "—"],
            ["Group", ACTIVE_LOFT_GROUP.name],
            ["Tag Color", ACTIVE_LOFT_GROUP.tagColor],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">{label}</span>
              {label === "Tag Color"
                ? <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border" style={{ backgroundColor: value }} /><span className="font-mono text-xs">{value}</span></div>
                : <span className="font-medium text-right">{value}</span>
              }
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" onClick={() => setIdx(i => i - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button onClick={() => onComplete(buildUpdates())}>
          <Check className="h-4 w-4 mr-1" />Complete Registration
        </Button>
      </div>
    </div>
  );
}

// ─── Bird Detail Dialog (clones /test/admin) ──────────────────────────────────

function BirdDetailDialog({
  bird, breeder, open, onOpenChange, onStartRegistration,
}: {
  bird: DemoBird | null;
  breeder: DemoBreeder | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onStartRegistration: () => void;
}) {
  if (!bird || !breeder) return null;
  const band = bird.band || [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-");
  const chipA = [bird.band1, bird.band2].filter(Boolean).join("-");
  const chipB = [bird.band3, bird.band4].filter(Boolean).join("-");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {bird.birdName || band || "Unregistered Bird"}
            {stateBadge(bird.state)}
          </DialogTitle>
        </DialogHeader>

        {bird.state !== "REGISTERED" && (
          <div className="flex items-start gap-3 border border-orange-200 bg-orange-50 rounded-lg p-4">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">
                {bird.state === "NO_BAND" ? "No band assigned" : "RFID not scanned"}
              </p>
              <p className="text-xs text-orange-700 mt-0.5">
                {bird.state === "NO_BAND"
                  ? "Assign band, scan RFID, add to group and photo to complete registration."
                  : "Band assigned. Scan RFID chip and assign to a group to complete registration."}
              </p>
            </div>
            <Button size="sm" onClick={onStartRegistration}>Start Registration</Button>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:row-span-2">
              <CardContent className="pt-6 space-y-4">
                <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {bird.image ? <img src={bird.image} alt="Bird" className="w-full h-full object-cover" /> : <span className="text-5xl">🕊️</span>}
                </div>
                {(chipA || chipB) && (
                  <div className="flex gap-2 flex-wrap">
                    {chipA && <Badge variant="outline" className="font-mono">{chipA}</Badge>}
                    {chipB && <Badge variant="outline" className="font-mono">{chipB}</Badge>}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold">{bird.birdName || "Unnamed"}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-muted-foreground font-mono text-xs">{band || "No band"}</span>
                    {bird.color && <Badge variant="outline" className="text-xs">{bird.color}</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">Edit</Button>
                </div>
                {bird.attention && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Pay attention</span>
                    <div className="w-10 h-5 rounded-full bg-primary flex items-center"><div className="w-4 h-4 bg-white rounded-full shadow mx-0.5 translate-x-5" /></div>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner</span>
                  <span className="ml-auto font-medium">{breeder.firstName} {breeder.lastName}</span>
                </div>
                {bird.loftGroup && (
                  <div className="flex items-center gap-2 pt-2 border-t text-sm">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bird.loftGroup.color }} />
                    <span className="text-muted-foreground">Group</span>
                    <span className="ml-auto font-medium text-right">{bird.loftGroup.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" />Properties</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {([["Band", band || "-"], ["Gender", sexLabel(bird.sex)], ["Color", bird.color || "-"], ["RFID", bird.rfid || "Not set"], ["Fancier", `${breeder.firstName} ${breeder.lastName} - ${breeder.loftName}`]] as [string, string][]).map(([l, v]) => (
                    <div key={l} className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground shrink-0">{l}</dt>
                      <dd className="text-right font-mono text-xs">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{bird.isActive === 1 ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />Current Location</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">No active location</p></CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Notes</CardTitle></CardHeader>
              <CardContent>{bird.note ? <p className="text-sm">{bird.note}</p> : <p className="text-sm text-muted-foreground">No notes.</p>}</CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="races">
                <TabsList className="mb-4">
                  <TabsTrigger value="races">
                    Races
                    {bird.inventoryItems.flatMap(i => i.raceItems).length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-xs">{bird.inventoryItems.flatMap(i => i.raceItems).length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="grouping">Grouping</TabsTrigger>
                  <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
                  <TabsTrigger value="audit">Audit Log <Badge variant="secondary" className="ml-1.5 text-xs">{bird.state === "REGISTERED" ? 1 : 0}</Badge></TabsTrigger>
                </TabsList>
                <TabsContent value="races">
                  {bird.inventoryItems.flatMap(i => i.raceItems).length === 0
                    ? <p className="text-sm text-muted-foreground">No race results.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b">
                            <th className="text-left pb-2">Event</th>
                            <th className="text-left pb-2">Race</th>
                            <th className="text-left pb-2">Status</th>
                            <th className="text-left pb-2">Pos</th>
                            <th className="text-left pb-2">Prize</th>
                            <th className="text-left pb-2">Arrival</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bird.inventoryItems.flatMap(inv => inv.raceItems.map(ri => ({ ri, eventName: inv.eventName }))).map(({ ri, eventName }, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 text-xs text-muted-foreground">{eventName}</td>
                              <td className="py-2">{ri.raceName}</td>
                              <td className="py-2"><Badge variant="outline" className="text-xs">{ri.status}</Badge></td>
                              <td className="py-2">{ri.position != null ? `#${ri.position}` : "-"}</td>
                              <td className="py-2">{ri.prize != null ? fmtMoney(ri.prize) : "-"}</td>
                              <td className="py-2 text-xs">{ri.arrivalTime ? new Date(ri.arrivalTime).toLocaleString() : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </TabsContent>
                <TabsContent value="grouping">
                  {bird.loftGroup ? (
                    <div className="border rounded-md p-3 text-sm">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Current Group</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: bird.loftGroup.color }} /><span className="font-medium">{bird.loftGroup.name}</span></div>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No group history.</p>}
                </TabsContent>
                <TabsContent value="vaccinations"><p className="text-sm text-muted-foreground">No vaccination records.</p></TabsContent>
                <TabsContent value="audit">
                  {bird.state === "REGISTERED" ? (
                    <div className="flex items-start gap-3 border-b pb-2 text-sm">
                      <Badge variant="outline" className="text-xs shrink-0"><Clock className="h-3 w-3 mr-1 inline" />REGISTERED</Badge>
                      <div><p>Bird registered with RFID {bird.rfid}</p><p className="text-xs text-muted-foreground">System · {new Date().toLocaleString()}</p></div>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No audit entries yet.</p>}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Event registration sections — Fees + Bets + Basketing per event */}
          {bird.inventoryItems.map((inv, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-2 pt-2">
                <h2 className="text-base font-semibold">{inv.eventName}</h2>
                <span className="text-xs text-muted-foreground">Sign-in: {fmtDate(inv.signInDate)}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Fees */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><span>💰</span> Fees</CardTitle>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>Arrival: {fmtDate(inv.arrivalDate)}</span>
                      <span>·</span>
                      <span>Departure: {fmtDate(inv.departureDate)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2 text-sm">
                      {([
                        ["Perch Fee", inv.entryFeeValue],
                        ["Bird Fee", inv.perchFeeValue],
                        ["Race Fee", inv.raceFeeValue],
                        ["Hot Spot", inv.hotSpotFeeValue],
                      ] as [string, number][]).map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono">{fmtMoney(value)}</span>
                        </div>
                      ))}
                      {(inv.entryRefund + inv.hotSpotRefund + inv.betsRefund) > 0 && (
                        <>
                          <div className="border-t pt-2 mt-2 text-xs text-muted-foreground font-medium">Refunds</div>
                          {([["Entry Refund", inv.entryRefund], ["HS Refund", inv.hotSpotRefund], ["Bets Refund", inv.betsRefund]] as [string, number][])
                            .filter(([, v]) => v > 0)
                            .map(([label, value]) => (
                              <div key={label} className="flex justify-between text-muted-foreground">
                                <span>{label}</span>
                                <span className="font-mono text-red-600">-{fmtMoney(value)}</span>
                              </div>
                            ))}
                        </>
                      )}
                      <div className="border-t pt-2 mt-1 flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="font-mono">{fmtMoney(inv.entryFeeValue + inv.perchFeeValue + inv.raceFeeValue + inv.hotSpotFeeValue - inv.entryRefund - inv.hotSpotRefund - inv.betsRefund)}</span>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Bets */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><span>🎲</span> Bets</CardTitle>
                    <div className="flex gap-2 flex-wrap text-xs">
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-green-100 border border-green-300" /> Owner paid</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-green-50 border border-green-200" /> Owner unpaid</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-pink-100 border border-pink-300" /> Bettor paid</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-pink-50 border border-pink-200" /> Bettor unpaid</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {[{ title: "Belgian Show", bets: inv.belgianBets }, { title: "Standard Show", bets: inv.standardBets }, { title: "WTA", bets: inv.wtaBets }]
                      .filter(g => g.bets.length > 0)
                      .map(({ title, bets }) => (
                        <div key={title} className="mb-3">
                          <div className="text-xs text-muted-foreground mb-1.5">{title}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {bets.map(b => {
                              const bg = b.isOwner
                                ? b.stakePaid ? "bg-green-100 border-green-300" : "bg-green-50 border-green-200"
                                : b.stakePaid ? "bg-pink-100 border-pink-300" : "bg-pink-50 border-pink-200";
                              return (
                                <div key={b.label} className={`border rounded px-2 py-1 text-xs flex flex-col gap-0.5 ${bg}`}>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-semibold">{b.label}</span>
                                    <span>{fmtMoney(b.value)}</span>
                                  </div>
                                  <span className={`text-xs ${b.isOwner ? "text-green-700" : "text-pink-700"}`}>
                                    {b.isOwner ? "Owner" : "Bettor"}{!b.stakePaid && " (unpaid)"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    {inv.belgianBets.length === 0 && inv.standardBets.length === 0 && inv.wtaBets.length === 0 && (
                      <p className="text-sm text-muted-foreground">No bets placed.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Basketing */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><span>🧺</span> Basketing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {inv.basketLabel ? (
                      <div className="flex items-start gap-2 text-sm border rounded p-2">
                        <Badge variant="outline" className="font-mono shrink-0 mt-0.5">{inv.basketLabel}</Badge>
                        <Badge variant={inv.basketPhase === "LOFT" ? "secondary" : "default"} className="text-xs">{inv.basketPhase}</Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not basketed.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Breeder Detail Dialog — clones BreederDetailsDialog exactly ──────────────

type BreederView = "list" | "register";

function BreederDetailDialog({
  breeder, open, onOpenChange, onBirdsUpdated,
}: {
  breeder: DemoBreeder | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBirdsUpdated: (breederId: number, birds: DemoBird[]) => void;
}) {
  const [view, setView] = useState<BreederView>("list");
  const [selectedBird, setSelectedBird] = useState<DemoBird | null>(null);
  const [birdDetailOpen, setBirdDetailOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [localBreeder, setLocalBreeder] = useState<DemoBreeder | null>(null);

  // Sync local copy when breeder changes
  const b = localBreeder ?? breeder;

  const handleOpenChange = (o: boolean) => {
    if (!o) { setView("list"); setLocalBreeder(null); }
    onOpenChange(o);
  };

  const handleBirdClick = (bird: DemoBird) => {
    setSelectedBird(bird);
    setBirdDetailOpen(true);
  };

  const handleRegistered = (birdId: number, updates: Partial<DemoBird>) => {
    if (!b) return;
    const updated = { ...b, birds: b.birds.map(bird => bird.id === birdId ? { ...bird, ...updates } : bird) };
    setLocalBreeder(updated);
    onBirdsUpdated(b.id, updated.birds);
    setSelectedBird(prev => prev?.id === birdId ? { ...prev, ...updates } as DemoBird : prev);
  };

  if (!b) return null;

  const totalPerchFee = b.birds.reduce((s, i) => s + i.entryFeeValue, 0);
  const totalBirdFee = b.birds.reduce((s, i) => s + i.perchFeeValue, 0);
  const totalRaceFee = b.birds.reduce((s, i) => s + i.raceFeeValue, 0);
  const totalHotSpot = b.birds.reduce((s, i) => s + i.hotSpotFeeValue, 0);
  const totalFees = totalPerchFee + totalBirdFee + totalRaceFee + totalHotSpot;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Breeder Details</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Breeder info + Partners — exact clone of BreederDetailsDialog */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 border border-border rounded-lg p-4 space-y-2">
                {([
                  ["Name", `${b.firstName} ${b.lastName}`],
                  ["Loft", b.loftName],
                  ["Sign-in Date", fmtDate(b.signInDate)],
                  ["Reserved Birds", String(b.reservedBirds)],
                  ["Email", b.email],
                  ["Phone", b.phone],
                  ["Country", b.country],
                  ["State", b.state1],
                  ...(b.note ? [["Note", b.note]] : []),
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="col-span-1 border border-border rounded-lg p-4 flex flex-col gap-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Partners</h3>
                <p className="text-xs text-muted-foreground">No partners</p>
              </div>
            </div>

            {/* Payments + Fee Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Payments</h3>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Payment</Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-primary">
                      <tr>
                        {["Date", "Type", "Method", "Description", "Amount", "Actions"].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-sm font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No payments found</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Fee Summary</h3>
                <div className="border rounded-lg p-4 space-y-1 text-sm">
                  <p className="font-medium text-muted-foreground uppercase text-xs tracking-wide mb-2">Fees</p>
                  {([["Perch Fee", totalPerchFee], ["Per Bird Fee", totalBirdFee], ["Race Fee", totalRaceFee], ["Hot Spot Fee", totalHotSpot]] as [string, number][]).map(([l, v]) => (
                    <div key={l} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span>{fmtMoney(v)}</span></div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total</span><span>{fmtMoney(totalFees)}</span></div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                    <span>Balance</span>
                    <span className="text-red-600">{fmtMoney(totalFees)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Birds Table — exact clone */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Birds ({b.birds.length})</h3>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Bird</Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary">
                    <tr>
                      {["#", "Band", "Name", "Color", "Sex", "Active", "Lost", "Lost Date", "Perch Fee", "Bird Fee", "Race Fee", "Hotspot Fee", "Entry Refund", "Arrival", "Departure", "Backup", "Status"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-sm font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {b.birds.length === 0 ? (
                      <tr><td colSpan={17} className="px-4 py-8 text-center text-muted-foreground">No birds found</td></tr>
                    ) : b.birds.map(bird => (
                      <tr key={bird.id} className="hover:bg-primary/10 cursor-pointer" onClick={() => handleBirdClick(bird)}>
                        <td className="px-3 py-2 text-sm">{bird.birdNo}</td>
                        <td className="px-3 py-2 text-sm font-mono">{bird.band || "-"}</td>
                        <td className="px-3 py-2 text-sm">{bird.birdName || "-"}</td>
                        <td className="px-3 py-2 text-sm">{bird.color || "-"}</td>
                        <td className="px-3 py-2 text-sm">{sexShort(bird.sex)}</td>
                        <td className="px-3 py-2 text-sm text-center">{bird.isActive ? "✓" : "✗"}</td>
                        <td className="px-3 py-2 text-sm text-center">{bird.isLost ? "✓" : "-"}</td>
                        <td className="px-3 py-2 text-sm">{fmtDate(bird.lostDate)}</td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMoney(bird.entryFeeValue)}</td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMoney(bird.perchFeeValue)}</td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMoney(bird.raceFeeValue)}</td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMoney(bird.hotSpotFeeValue)}</td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMoney(bird.entryRefund)}</td>
                        <td className="px-3 py-2 text-sm">{fmtDate(bird.arrivalDate)}</td>
                        <td className="px-3 py-2 text-sm">{fmtDate(bird.departureDate)}</td>
                        <td className="px-3 py-2 text-sm text-center">{bird.isBackup ? "✓" : "-"}</td>
                        <td className="px-3 py-2">{stateBadge(bird.state)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bird detail (opens on top of breeder dialog) */}
      <BirdDetailDialog
        bird={selectedBird}
        breeder={b}
        open={birdDetailOpen}
        onOpenChange={setBirdDetailOpen}
        onStartRegistration={() => {
          setBirdDetailOpen(false);
          setRegistrationOpen(true);
        }}
      />

      {/* Registration stepper */}
      <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBird?.state === "NO_BAND" ? "Register Bird" : "Complete Registration"}</DialogTitle>
          </DialogHeader>
          {selectedBird && (
            <RegistrationStepper
              bird={selectedBird}
              onComplete={updates => {
                handleRegistered(selectedBird.id, updates);
                setRegistrationOpen(false);
                setBirdDetailOpen(true);
              }}
              onCancel={() => { setRegistrationOpen(false); setBirdDetailOpen(true); }}
              onAddNew={() => {
                // Close registration, go back to breeder list to pick another bird
                setRegistrationOpen(false);
                setSelectedBird(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page (clones admin/users/page.tsx layout) ───────────────────────────

export default function BreederFlowPage() {
  const [breeders, setBreeders] = useState<DemoBreeder[]>(DEMO_BREEDERS);
  const [search, setSearch] = useState("");
  const [selectedBreeder, setSelectedBreeder] = useState<DemoBreeder | null>(null);
  const [breederOpen, setBreederOpen] = useState(false);

  const filtered = breeders.filter(b =>
    `${b.firstName} ${b.lastName} ${b.loftName}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleRowClick = (breeder: DemoBreeder) => {
    setSelectedBreeder(breeder);
    setBreederOpen(true);
  };

  const handleBirdsUpdated = (breederId: number, birds: DemoBird[]) => {
    setBreeders(prev => prev.map(b => b.id === breederId ? { ...b, birds } : b));
    setSelectedBreeder(prev => prev?.id === breederId ? { ...prev, birds } : prev);
  };

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/test"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <h1 className="text-2xl font-semibold">Breeders — Registration Flow Demo</h1>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search breeders..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Breeder table — mirrors DataTable style from admin/users */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-primary">
            <tr>
              {["Name", "Loft", "Email", "Phone", "Country", "Reserved Birds", "Bird Status"].map(h => (
                <th key={h} className="px-4 py-2 text-left text-sm font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No breeders found.</td></tr>
            ) : filtered.map(breeder => {
              const noBand = breeder.birds.filter(b => b.state === "NO_BAND").length;
              const noRfid = breeder.birds.filter(b => b.state === "NO_RFID").length;
              return (
                <tr key={breeder.id} className="hover:bg-primary/10 cursor-pointer" onClick={() => handleRowClick(breeder)}>
                  <td className="px-4 py-2 text-sm font-medium">{breeder.firstName} {breeder.lastName}</td>
                  <td className="px-4 py-2 text-sm">{breeder.loftName}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{breeder.email}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{breeder.phone}</td>
                  <td className="px-4 py-2 text-sm">{breeder.country}</td>
                  <td className="px-4 py-2 text-sm">{breeder.reservedBirds}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{breeder.birds.length} total</span>
                      {noBand > 0 && <Badge variant="destructive" className="text-xs">{noBand} no band</Badge>}
                      {noRfid > 0 && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-xs">{noRfid} no RFID</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BreederDetailDialog
        breeder={selectedBreeder}
        open={breederOpen}
        onOpenChange={setBreederOpen}
        onBirdsUpdated={handleBirdsUpdated}
      />
    </div>
  );
}
