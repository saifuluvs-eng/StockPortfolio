import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiSummaryCard() {
  return (
    <Card className="max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/30 backdrop-blur">
      <CardHeader className="border-b border-white/10 px-4 py-3 md:px-5">
        <CardTitle className="text-lg font-semibold text-white">AI Summary</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4 text-sm text-white/60 md:px-5">
        Insights will appear here after a scan. (Placeholder content only)
      </CardContent>
    </Card>
  );
}
