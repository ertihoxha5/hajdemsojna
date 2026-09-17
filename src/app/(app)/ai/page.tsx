"use client";

import { RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Card } from "@/components/ui";
import { AIChat } from "@/components/app/ai-chat";

export default function AssistantPage() {
  const { state, dispatch } = useStore();

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col lg:h-[calc(100vh-9rem)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">Asistenti</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            A mund të ma shpjegosh këtë? — dhe gjithçka tjetër rreth mësimit tënd.
          </p>
        </div>
        {state.aiThread.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "ai/clear" })}>
            <RotateCcw size={13} />
            Bisedë e re
          </Button>
        )}
      </div>

      <Card padded={false} className="flex min-h-0 flex-1 overflow-hidden">
        <AIChat />
      </Card>
    </div>
  );
}
