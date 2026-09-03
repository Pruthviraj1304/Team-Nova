import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { makeBay, type Bay, type BayState } from "./mockData";

const FALLBACK_BAYS: Bay[] = [makeBay(0)];

interface BayRow {
  id: string;
  state: BayState;
  charge: number;
  device_id: string | null;
}

function rowToBay(row: BayRow): Bay {
  return { id: row.id, state: row.state, charge: row.charge, deviceId: row.device_id };
}

export function useBays() {
  const [bays, setBays] = useState<Bay[]>(FALLBACK_BAYS);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let cancelled = false;

    client
      .from("bays")
      .select("id, state, charge, device_id")
      .order("id")
      .then(({ data, error }) => {
        if (cancelled || error || !data || data.length === 0) return;
        setBays(data.map(rowToBay));
        setLive(true);
      });

    const channel = client
      .channel("bays-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bays" }, (payload) => {
        setLive(true);
        setBays((prev) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as BayRow;
            return prev.filter((b) => b.id !== oldRow.id);
          }
          const updated = rowToBay(payload.new as BayRow);
          const exists = prev.some((b) => b.id === updated.id);
          const next = exists ? prev.map((b) => (b.id === updated.id ? updated : b)) : [...prev, updated];
          return [...next].sort((a, b) => a.id.localeCompare(b.id));
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, []);

  return { bays, live };
}
