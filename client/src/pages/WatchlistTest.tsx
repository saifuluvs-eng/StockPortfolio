import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Row = {
  id: string;
  user_id: string | null;
  symbol: string;
  note: string | null;
  created_at: string;
};

export default function WatchlistTest() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;
    const { error } = await supabase
      .from('watchlists')
      .insert([{ user_id: null, symbol: trimmed, note: note || null }]);
    if (error) setError(error.message);
    setSymbol('');
    setNote('');
    load();
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h2>Watchlist Test</h2>
      <p>Reading and inserting into <code>public.watchlists</code> (no auth/RLS).</p>

      <form onSubmit={addSymbol} style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <input
          placeholder="e.g. INJUSDT"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 8 }}
        />
        <input
          placeholder="note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 8 }}
        />
        <button type="submit" style={{ padding: '8px 12px', borderRadius: 8 }}>Add</button>
      </form>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}

      <ul style={{ padding: 0, listStyle: 'none', marginTop: 12 }}>
        {rows.map((r) => (
          <li key={r.id} style={{
            padding: 10, border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, marginBottom: 8
          }}>
            <div style={{ fontWeight: 600 }}>{r.symbol}</div>
            {r.note && <div style={{ opacity: 0.8 }}>{r.note}</div>}
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {new Date(r.created_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
