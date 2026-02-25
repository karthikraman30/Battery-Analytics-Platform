import { useState } from 'react'
import {
    TrendingUp, TrendingDown,
    AlertTriangle, CheckCircle, CalendarDays, Minus,
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useChargingComparison, useUserDateRanges } from '@/hooks/useChargingData'

// ──────────────────────────────────────────────────────────────────
//  Comparison Tab
// ──────────────────────────────────────────────────────────────────

export function ComparisonTab() {
    const { data: cmp, isLoading: cmpLoading } = useChargingComparison()
    const { data: dateRanges, isLoading: drLoading } = useUserDateRanges()

    if (cmpLoading || drLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-44" />
                <div className="grid gap-6 lg:grid-cols-2">
                    <Skeleton className="h-72" />
                    <Skeleton className="h-72" />
                </div>
                <Skeleton className="h-56" />
            </div>
        )
    }

    const s = cmp?.summary
    if (!s) return null

    const removedUsers = Number(s.all_users) - Number(s.clean_users)
    const durationDelta = Number(s.clean_avg_duration) - Number(s.all_avg_duration)
    const chargeDelta = Number(s.clean_avg_charge) - Number(s.all_avg_charge)
    const connectDelta = Number(s.clean_avg_connect) - Number(s.all_avg_connect)

    // Merge hourly arrays for comparison chart
    const cleanMap = new Map((cmp?.cleanHourly ?? []).map(d => [Number(d.hour), Number(d.count)]))
    const allMap = new Map((cmp?.allHourly ?? []).map(d => [Number(d.hour), Number(d.count)]))
    const hourlyData = Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}:00`,
        all: allMap.get(h) ?? 0,
        clean: cleanMap.get(h) ?? 0,
    }))

    // Duration bucket comparison
    const durationMap = new Map((cmp?.cleanDuration ?? []).map(d => [d.bucket, Number(d.count)]))
    const allDurationMap = new Map((cmp?.allDuration ?? []).map(d => [d.bucket, Number(d.count)]))
    const buckets = ['0-5 min', '5-15 min', '15-30 min', '30-60 min', '1-2 hrs', '2-4 hrs', '4-8 hrs', '8+ hrs']
    const durationData = buckets.map(b => ({
        bucket: b,
        all: allDurationMap.get(b) ?? 0,
        clean: durationMap.get(b) ?? 0,
    }))



    // Conclusion logic
    const maxAbsDelta = Math.max(
        Math.abs(durationDelta / Math.max(Number(s.all_avg_duration), 1)) * 100,
        Math.abs(chargeDelta / Math.max(Number(s.all_avg_charge), 1)) * 100,
    )
    const isHighImpact = maxAbsDelta > 5

    return (
        <div className="space-y-6">

            {/* Side-by-side summary cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* ALL users side */}
                <Card className="border-red-500/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            All Users (including {removedUsers} high-mismatch)
                        </CardTitle>
                        <CardDescription>mismatch can be any value</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                        <StatItem label="Users" value={Number(s.all_users)} />
                        <StatItem label="Sessions" value={Number(s.all_sessions).toLocaleString()} />
                        <StatItem label="Complete Sessions" value={Number(s.all_complete).toLocaleString()} />
                        <StatItem label="Avg Duration" value={`${Number(s.all_avg_duration).toFixed(1)} min`} />
                        <StatItem label="Avg Charge Gained" value={`${Number(s.all_avg_charge).toFixed(1)}%`} />
                        <StatItem label="Median Duration" value={`${Number(s.all_median_duration).toFixed(0)} min`} />
                        <StatItem label="Avg Connect Level" value={`${Number(s.all_avg_connect).toFixed(1)}%`} />
                        <StatItem label="Avg Disconnect Level" value={`${Number(s.all_avg_disconnect).toFixed(1)}%`} />
                    </CardContent>
                </Card>

                {/* CLEAN users side */}
                <Card className="border-green-500/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Clean Users ({Number(s.clean_users)} — mismatch ≤ 10)
                        </CardTitle>
                        <CardDescription>anomalies with small mismatch kept; large mismatch excluded</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                        <StatItem label="Users" value={Number(s.clean_users)} />
                        <StatItem label="Sessions" value={Number(s.clean_sessions).toLocaleString()} />
                        <StatItem label="Complete Sessions" value={Number(s.clean_complete).toLocaleString()} />
                        <StatItem label="Avg Duration" delta={durationDelta} value={`${Number(s.clean_avg_duration).toFixed(1)} min`} />
                        <StatItem label="Avg Charge Gained" delta={chargeDelta} value={`${Number(s.clean_avg_charge).toFixed(1)}%`} />
                        <StatItem label="Median Duration" value={`${Number(s.clean_median_duration).toFixed(0)} min`} />
                        <StatItem label="Avg Connect Level" delta={connectDelta} value={`${Number(s.clean_avg_connect).toFixed(1)}%`} />
                        <StatItem label="Avg Disconnect Level" value={`${Number(s.clean_avg_disconnect).toFixed(1)}%`} />
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Charging Sessions by Hour</CardTitle>
                        <CardDescription>All users vs clean users — session count per hour of day</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="hour" className="text-xs" interval={2} />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Legend />
                                <Bar dataKey="all" name="All Users" fill="#ef4444" opacity={0.7} radius={[2, 2, 0, 0]} />
                                <Bar dataKey="clean" name="Clean Users" fill="#22c55e" opacity={0.9} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Duration Distribution Comparison</CardTitle>
                        <CardDescription>Session duration buckets — all vs clean</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={durationData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={48} />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Legend />
                                <Bar dataKey="all" name="All Users" fill="#ef4444" opacity={0.7} radius={[2, 2, 0, 0]} />
                                <Bar dataKey="clean" name="Clean Users" fill="#22c55e" opacity={0.9} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>



            {/* Date range section */}
            {dateRanges && <DateRangeSection data={dateRanges} />}

            {/* Conclusion */}
            <Card className={`border-${isHighImpact ? 'amber' : 'green'}-500/30 bg-${isHighImpact ? 'amber' : 'green'}-500/5`}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {isHighImpact
                            ? <AlertTriangle className="h-5 w-5 text-amber-500" />
                            : <CheckCircle className="h-5 w-5 text-green-500" />}
                        Conclusion — Should you remove the {removedUsers} high-mismatch users?
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-3 gap-3">
                        <MetricDelta label="Duration shift" delta={durationDelta} unit="min" />
                        <MetricDelta label="Charge shift" delta={chargeDelta} unit="%" />
                        <MetricDelta label="Connect level shift" delta={connectDelta} unit="%" />
                    </div>
                    <div className="mt-3 rounded-lg border p-4 space-y-2 text-muted-foreground">
                        {isHighImpact ? (
                            <>
                                <p className="font-semibold text-amber-600 dark:text-amber-400">⚠️ Moderate impact detected</p>
                                <p>Removing the {removedUsers} high-mismatch users shifts your averages by more than 5%. This means those users' charging patterns are <strong>meaningfully different</strong> from the clean population. For any published analysis, you should run results both ways and report the difference.</p>
                            </>
                        ) : (
                            <>
                                <p className="font-semibold text-green-600 dark:text-green-400">✅ Low impact — safe to keep both groups</p>
                                <p>The {removedUsers} high-mismatch users shift your key averages by less than 5%. Their presence does <strong>not materially affect</strong> your conclusions. You can safely include them — just flag them in your data notes.</p>
                            </>
                        )}
                        <p><strong>Recommended approach:</strong> Use the <em>clean users</em> dataset (mismatch ≤ 10) for the Deep Analysis tab. Keep all users in Overview for full picture reporting. The <code className="rounded bg-muted px-1">is_anomalous</code> flag in the database makes filtering trivial at query time.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// ──────────────────────────────────────────────────────────────────
//  Date Range Section (how long each user was observed)
// ──────────────────────────────────────────────────────────────────

function DateRangeSection({ data }: { data: NonNullable<ReturnType<typeof useUserDateRanges>['data']> }) {
    const [showTable, setShowTable] = useState(false)
    const st = data.stats

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    User Observation Period
                </CardTitle>
                <CardDescription>
                    How many days of data is available for each user •
                    Avg: <strong>{Number(st.avg_days).toFixed(1)} days</strong> •
                    Median: <strong>{Number(st.median_days).toFixed(0)} days</strong> •
                    Range: {Number(st.min_days)}–{Number(st.max_days)} days
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {data.buckets.map(b => (
                        <div key={b.bucket} className="rounded-lg border p-3 text-center">
                            <div className="text-2xl font-bold">{Number(b.user_count)}</div>
                            <div className="text-xs text-muted-foreground">{b.bucket}</div>
                            <div className="text-xs text-muted-foreground">avg {Number(b.avg_days).toFixed(1)}d</div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>{Number(st.short_users)} users have ≤ 5 days of data — their averages may not be representative</span>
                </div>

                <button
                    onClick={() => setShowTable(t => !t)}
                    className="text-xs text-primary hover:underline"
                >
                    {showTable ? 'Hide' : 'Show'} per-user breakdown ({data.perUser.length} users)
                </button>

                {showTable && (
                    <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-card">
                                <tr className="border-b">
                                    <th className="px-2 py-1.5 text-left">User</th>
                                    <th className="px-2 py-1.5 text-right">Days</th>
                                    <th className="px-2 py-1.5 text-right">Sessions</th>
                                    <th className="px-2 py-1.5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.perUser.map((u, i) => (
                                    <tr key={u.user_id} className={`border-b hover:bg-muted/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                                        <td className="px-2 py-1">User {u.user_id}</td>
                                        <td className="px-2 py-1 text-right">{u.days_of_data}</td>
                                        <td className="px-2 py-1 text-right">{Number(u.total_sessions)}</td>
                                        <td className="px-2 py-1 text-right">
                                            {u.is_anomalous
                                                ? <span className="text-red-500">Anomalous</span>
                                                : <span className="text-green-600">Clean</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ──────────────────────────────────────────────────────────────────
//  Small helpers
// ──────────────────────────────────────────────────────────────────

function StatItem({ label, value, delta }: { label: string; value: string | number; delta?: number }) {
    return (
        <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="flex items-center gap-1">
                <span className="font-semibold">{value}</span>
                {delta !== undefined && Math.abs(delta) > 0.05 && (
                    <span className={`text-xs ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {delta > 0 ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                    </span>
                )}
                {delta !== undefined && Math.abs(delta) <= 0.05 && (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                )}
            </div>
        </div>
    )
}

function MetricDelta({ label, delta, unit }: { label: string; delta: number; unit: string }) {
    const abs = Math.abs(delta)
    const pct = abs.toFixed(1)
    const color = abs < 1 ? 'text-green-600' : abs < 3 ? 'text-amber-600' : 'text-red-600'
    return (
        <div className="rounded-lg border p-3 text-center">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-lg font-bold ${color}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit}
            </div>
            <div className="text-xs text-muted-foreground">{pct}{unit} shift</div>
        </div>
    )
}
