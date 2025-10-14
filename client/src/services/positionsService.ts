import { supabase } from "../lib/supabaseClient";

export type PositionRow = {
  id: string;
  user_id: string;
  symbol: string;
  qty: number;
  entry_price: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export async function listPositions(): Promise<PositionRow[]> {
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addOrReplacePosition(
  userId: string,
  symbol: string,
  qty: number,
  entry: number,
  note?: string,
) {
  const { error } = await supabase
    .from("positions")
    .upsert(
      [{ user_id: userId, symbol, qty, entry_price: entry, note: note ?? null }],
      { onConflict: "user_id,symbol" },
    );
  if (error) throw new Error(error.message);
}

export async function updatePosition(
  id: string,
  patch: Partial<Pick<PositionRow, "qty" | "entry_price" | "note">>,
) {
  const { error } = await supabase.from("positions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePosition(id: string) {
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
