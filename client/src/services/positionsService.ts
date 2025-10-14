import { supabase } from "../lib/supabaseClient";

export type Position = {
  id: string;
  symbol: string;
  qty: number;
  entry_price: number;
  note: string | null;
  created_at: string;
};

export async function listPositions(): Promise<Position[]> {
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addPosition(p: Omit<Position, "id" | "created_at">) {
  const { error } = await supabase.from("positions").insert([p]);
  if (error) throw new Error(error.message);
}

export async function updatePosition(
  id: string,
  patch: Partial<Omit<Position, "id" | "created_at">>,
) {
  const { error } = await supabase.from("positions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePosition(id: string) {
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
