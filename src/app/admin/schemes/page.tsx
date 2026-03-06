"use client";

import FeeSchemeComponent from "@/components/fee-scheme-component";
import PrizeSchemeComponent from "@/components/prize-scheme-component";
import BettingSchemeComponent from "@/components/betting-scheme-component";

export default function SchemesPage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-3xl font-bold mb-8">Schemes Management</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border rounded-lg p-4 bg-transparent">
          <FeeSchemeComponent />
        </div>
        
        <div className="border rounded-lg p-4 bg-transparent">
          <PrizeSchemeComponent />
        </div>
        
        <div className="border rounded-lg p-4 bg-transparent">
          <BettingSchemeComponent />
        </div>
      </div>
    </div>
  );
}
