import React, { useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Papa from "papaparse";

function parseDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function safeString(x) {
  if (x == null) return "";
  return String(x).trim();
}

function parseCategories(x) {
  if (!x) return [];
  return String(x)
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    const list = m.get(k);
    if (list) list.push(item);
    else m.set(k, [item]);
  }
  return m;
}

function download(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = filename;
  a.click();
}

function generateSampleData(days = 14, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

  const creators = [
    "@techdaily",
    "@worldnews",
    "@fitnesslab",
    "@ai_insider",
    "@chefcasey",
    "@sportswire",
    "@filmfocus",
    "@travelbug",
  ];
  const categories = [
    "tech",
    "ai",
    "news",
    "fitness",
    "food",
    "sports",
    "movies",
    "travel",
  ];

  const today = new Date();
  const rows = [];
  let postId = 1;
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dayCount = 30 + Math.floor(rnd() * 20);
    for (let j = 0; j < dayCount; j++) {
      const creator = creators[Math.floor(rnd() * creators.length)];
      const cats = new Set();
      const catCount = 1 + Math.floor(rnd() * 2);
      for (let c = 0; c < catCount; c++) {
        cats.add(categories[Math.floor(rnd() * categories.length)]);
      }
      rows.push({
        date: date.toISOString().slice(0, 10),
        post_id: p${postId++},
        creator,
        categories: [...cats].join(", "),
        platform: rnd() > 0.5 ? "twitter" : "instagram",
      });
    }
  }
  return rows;
}

function KPI({ title, value, hint }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-sm text-gray-600 mt-1">{hint}</p>
    </div>
  );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#48DBFB'];

export default function FeedPatternAnalysisTool() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const fileInputRef = useRef(null);

  const platforms = useMemo(() => {
    const set = new Set(rows.map((r) => safeString(r.platform).toLowerCase()).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    if (platformFilter === "all") return rows;
    const pf = platformFilter.toLowerCase();
    return rows.filter((r) => safeString(r.platform).toLowerCase() === pf);
  }, [rows, platformFilter]);

  const normalized = useMemo(() => {
    return filtered
      .map((r) => ({
        date: parseDate(r.date),
        post_id: safeString(r.post_id),
        creator: safeString(r.creator).toLowerCase(),
        categories: parseCategories(r.categories),
        platform: safeString(r.platform).toLowerCase(),
      }))
      .filter((r) => r.date && r.post_id && r.creator);
  }, [filtered]);

  const byDay = useMemo(() => groupBy(normalized, (r) => r.date), [normalized]);

  const diversityOverTime = useMemo(() => {
    const out = [];
    for (const [date, list] of Array.from(byDay.entries()).sort()) {
      const creators = new Set(list.map((x) => x.creator));
      out.push({
        date,
        diversity: Number(((creators.size / list.length) * 100).toFixed(2)),
        total_posts: list.length,
        unique_creators: creators.size,
      });
    }
    return out;
  }, [byDay]);

  const topCreators = useMemo(() => {
    const counts = new Map();
    for (const r of normalized) {
      counts.set(r.creator, (counts.get(r.creator) || 0) + 1);
    }
    const total = normalized.length || 1;
    const arr = Array.from(counts.entries())
      .map(([creator, count]) => ({ creator, count, share: Number(((count / total) * 100).toFixed(2)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    const repetitionRate = arr.length ? Number(arr[0].share.toFixed?.(2) || arr[0].share) : 0;
    return { list: arr, repetitionRate };
  }, [normalized]);

  const categoryDistribution = useMemo(() => {
    const counts = new Map();
    for (const r of normalized) {
      for (const c of r.categories) counts.set(c, (counts.get(c) || 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    const arr = Array.from(counts.entries())
      .map(([category, count]) => ({ category, count, share: Number(((count / total) * 100).toFixed(2)) }))
      .sort((a, b) => b.count - a.count);
    return arr;
  }, [normalized]);

  const categoryOverTime = useMemo(() => {
    const days = Array.from(byDay.keys()).sort();
    const cats = new Set();
    for (const list of byDay.values()) for (const r of list) for (const c of r.categories) cats.add(c);
    const catList = Array.from(cats);

    const table = days.map((date) => {
      const row = { date };
      const list = byDay.get(date) || [];
      const denom = list.length || 1;
      for (const c of catList) row[c] = 0;
      for (const r of list) for (const c of r.categories) row[c] += 1;
      for (const c of catList) row[c] = Number(((row[c] / denom) * 100).toFixed(2));
      return row;
    });
    return { days, catList, table };
  }, [byDay]);

  const overallDiversity = useMemo(() => {
    const creators = new Set(normalized.map((x) => x.creator));
    const score = normalized.length ? (creators.size / normalized.length) * 100 : 0;
    return Number(score.toFixed(2));
  }, [normalized]);

  function handleCSV(file) {
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRows(results.data);
      },
      error: (err) => setError(String(err)),
    });
  }

  function handleJSON(file) {
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("JSON must be an array of objects");
        setRows(data);
      } catch (e) {
        setError(String(e));
      }
    };
    reader.onerror = () => setError("Failed to read JSON file");
    reader.readAsText(file);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".csv")) handleCSV(file);
    else if (file.name.toLowerCase().endsWith(".json")) handleJSON(file);
    else setError("Please upload a .csv or .json file");
    e.target.value = "";
  }

  function exportMetrics() {
    const lines = [
      ["metric", "value"].join(","),
      ["overall_diversity_percent", overallDiversity].join(","),
      ["top_creator_share_percent", topCreators.repetitionRate].join(","),
      ["total_posts", normalized.length].join(","),
      ["unique_creators", new Set(normalized.map((x) => x.creator)).size].join(","),
    ];
    download("feed_metrics.csv", lines.join("\n"));
  }

  function exportSample() {
    const sample = generateSampleData(10, 42);
    const csv = Papa.unparse(sample);
    download("sample_feed.csv", csv);
  }

  function loadSample() {
    setRows(generateSampleData(14, 99));
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Explain My Feed — Pattern Analysis</h1>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-2xl bg-gray-900 text-white hover:bg-black transition shadow"
            >
              Upload CSV/JSON
            </button>
            <input
              type="file"
              accept=".csv,.json"
              ref={fileInputRef}
              className="hidden"
              onChange={onFile}
            />
            <button onClick={loadSample} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white shadow hover:brightness-110">Load Sample</button>
            <button onClick={exportSample} className="px-4 py-2 rounded-2xl bg-indigo-100 text-indigo-800 hover:bg-indigo-200">Download Sample CSV</button>
            <button onClick={exportMetrics} className="px-4 py-2 rounded-2xl bg-emerald-600 text-white shadow hover:brightness-110">Export Metrics</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-8">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-red-800">{error}</div>
        )}

        <section className="bg-white rounded-2xl shadow p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Dataset</h2>
              <p className="text-sm text-gray-600">
                {normalized.length ? (
                  <>
                    Loaded <strong>{normalized.length}</strong> posts, from <strong>{byDay.size}</strong> days, with <strong>{new Set(normalized.map((x) => x.creator)).size}</strong> unique creators.
                  </>
                ) : (
                  <>Upload a CSV/JSON or load the sample data to get started.</>
                )}
              </p>
            </div>
            {platforms.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Platform</label>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border bg-white"
                >
                  {platforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {normalized.length > 0 && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPI title="Overall Diversity" value={${overallDiversity.toFixed(2)}%} hint="Unique creators / total posts" />
              <KPI title="Top Creator Share" value={${topCreators.repetitionRate.toFixed(2)}%} hint="% of posts from your most frequent creator" />
              <KPI title="Total Days Tracked" value={${byDay.size}} hint="Number of days with posts" />
            </section>

            <section className="bg-white rounded-2xl shadow p-5">
              <h3 className="text-lg font-semibold mb-2">Diversity Score Over Time</h3>
              <p className="text-sm text-gray-600 mb-4">Diversity = unique creators / total posts (per day)</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={diversityOverTime} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="diversity" strokeWidth={2} dot={false} stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow p-5">
              <h3 className="text-lg font-semibold mb-2">Top Creators (by share)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCreators.list} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="creator" angle={-30} textAnchor="end" interval={0} height={60} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="share" name="Share %" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Category Distribution</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={categoryDistribution} 
                        dataKey="share" 
                        nameKey="category" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={120} 
                        label={({ category, share }) => ${category}: ${share}%}
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={cell-${index}} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Category Mix Over Time (% of daily posts)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={categoryOverTime.table} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      {categoryOverTime.catList.slice(0, 5).map((category, index) => (
                        <Line 
                          key={category}
                          type="monotone" 
                          dataKey={category} 
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          name={category}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow p-5">
              <h3 className="text-lg font-semibold mb-4">Raw Data Preview ({normalized.length} posts)</h3>
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Creator</th>
                      <th className="text-left p-2">Categories</th>
                      <th className="text-left p-2">Platform</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalized.slice(0, 20).map((row, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2">{row.date}</td>
                        <td className="p-2">{row.creator}</td>
                        <td className="p-2">{row.categories.join(", ")}</td>
                        <td className="p-2">{row.platform}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {normalized.length > 20 && (
                <p className="text-sm text-gray-600 mt-2">Showing first 20 of {normalized.length} posts</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}