import { Battery, Clock, Moon, Zap, BarChart3, Gauge } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeepAnalysis } from '@/hooks/useChargingData'

const HOUR_LABELS = [
    '12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
    '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm',
]

function n(v: unknown) { return Number(v) }

export function DeepAnalysisTab() {
    const { data, isLoading } = useDeepAnalysis()

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}
                </div>
                <Skeleton className="h-72" />
            </div>
        )
    }

    if (!data) return null

    const d = data
    const dr = d.drainRate
    const ct = d.chargeTargetStat
    const ov = d.overnight

    // Peak plug-in hour
    const peakPlugIn = d.plugInByHour.reduce((a, b) => n(b.count) > n(a.count) ? b : a, d.plugInByHour[0])
    const peakPlugOut = d.plugOutByHour.reduce((a, b) => n(b.count) > n(a.count) ? b : a, d.plugOutByHour[0])

    // Usage gap stat
    const avgGapHours = n(d.usageGapStat?.avg_gap_hours ?? 0)
    const medianGapHours = n(d.usageGapStat?.median_gap_hours ?? 0)

    // Build full 24h arrays (0 for missing hours)
    const plugInMap = new Map(d.plugInByHour.map(r => [n(r.hour), n(r.count)]))
    const plugOutMap = new Map(d.plugOutByHour.map(r => [n(r.hour), n(r.count)]))
    const hourlyPlugData = Array.from({ length: 24 }, (_, h) => ({
        label: HOUR_LABELS[h],
        plugIn: plugInMap.get(h) ?? 0,
        plugOut: plugOutMap.get(h) ?? 0,
    }))

    // Charge target distribution (level buckets)
    const chargeTargetData = d.chargeTargetDist.map(r => ({
        pct: `${n(r.level_bucket)}%`,
        count: n(r.count),
    }))

    // Usage between charges
    const gapData = d.usageBetweenCharges.map(r => ({
        bucket: r.bucket,
        count: n(r.count),
    }))

    // Drain rate by hour
    const drainHourData = d.drainByHour.map(r => ({
        label: HOUR_LABELS[n(r.hour)],
        drain: n(r.avg_drain_pct_per_hour),
        samples: n(r.samples),
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    Clean data only — mismatch ≤ 10 • {Number(d.overnight?.total_users ?? 0)} users
                </div>
            </div>

            {/* KPI bar */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                    icon={<Clock className="h-4 w-4" />}
                    label="Peak Plug-In"
                    value={HOUR_LABELS[n(peakPlugIn?.hour ?? 0)]}
                    sub={`${n(peakPlugIn?.count ?? 0).toLocaleString()} events`}
                    color="text-primary"
                />
                <KpiCard
                    icon={<Zap className="h-4 w-4" />}
                    label="Peak Unplug"
                    value={HOUR_LABELS[n(peakPlugOut?.hour ?? 0)]}
                    sub={`${n(peakPlugOut?.count ?? 0).toLocaleString()} events`}
                    color="text-amber-500"
                />
                <KpiCard
                    icon={<Battery className="h-4 w-4" />}
                    label="Avg Charge Target"
                    value={`${n(ct?.avg_charge_target ?? 0).toFixed(0)}%`}
                    sub={`Median ${n(ct?.median_charge_target ?? 0)}% • ${Math.round((n(ct?.full_charge_sessions) / n(ct?.total_sessions)) * 100)}% charged to 90%+`}
                    color="text-green-500"
                />
                <KpiCard
                    icon={<Moon className="h-4 w-4" />}
                    label="Overnight Chargers"
                    value={`${n(ov?.overnight_users ?? 0)} users`}
                    sub={`${n(ov?.overnight_sessions ?? 0).toLocaleString()} night sessions`}
                    color="text-blue-500"
                />
            </div>

            {/* 1 & 2: Plug-in and Plug-out times */}
            <Card>
                <CardHeader>
                    <CardTitle>When Do Users Plug In vs Unplug? (Hours)</CardTitle>
                    <CardDescription>
                        Power connected events (when user plugs in charger) vs power disconnected (when user unplugs)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={hourlyPlugData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="label" className="text-xs" interval={1} angle={-40} textAnchor="end" height={52} />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                            <Bar dataKey="plugIn" name="Plug In" fill="#22c55e" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="plugOut" name="Unplug" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">🔌 Most common plug-in times</div>
                            <div className="mt-1 font-semibold">
                                {d.plugInByHour
                                    .sort((a, b) => n(b.count) - n(a.count))
                                    .slice(0, 3)
                                    .map(r => HOUR_LABELS[n(r.hour)])
                                    .join(', ')}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">🔋 Most common unplug times</div>
                            <div className="mt-1 font-semibold">
                                {d.plugOutByHour
                                    .sort((a, b) => n(b.count) - n(a.count))
                                    .slice(0, 3)
                                    .map(r => HOUR_LABELS[n(r.hour)])
                                    .join(', ')}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* 3: Charge target distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Battery className="h-4 w-4 text-primary" />
                            Average Charge Target (%)
                        </CardTitle>
                        <CardDescription>
                            Battery level when users unplug — Avg: <strong>{n(ct?.avg_charge_target ?? 0).toFixed(1)}%</strong> •
                            {Math.round((n(ct?.full_charge_sessions) / Math.max(n(ct?.total_sessions), 1)) * 100)}% sessions charge to 90%+
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={chargeTargetData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="pct" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <ReferenceLine
                                    x={`${Math.round(n(ct?.avg_charge_target ?? 0) / 10) * 10}%`}
                                    stroke="var(--primary)"
                                    strokeDasharray="4 4"
                                    label={{ value: 'avg', fill: 'var(--primary)', fontSize: 10 }}
                                />
                                <Bar dataKey="count" name="Sessions" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 5: Usage between charges */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Phone Usage Between Charges
                        </CardTitle>
                        <CardDescription>
                            Time from unplug → next plug-in event •
                            Avg: <strong>{avgGapHours.toFixed(1)} hrs</strong> •
                            Median: <strong>{medianGapHours.toFixed(1)} hrs</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={gapData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="bucket" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Bar dataKey="count" name="Gaps" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* 4: Overnight charging stat */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Moon className="h-5 w-5 text-blue-500" />
                        Overnight Charging (Plug-in after 9pm, Unplug before 8am)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="rounded-lg border p-4 text-center">
                            <div className="text-3xl font-bold text-blue-500">{n(ov?.overnight_users ?? 0)}</div>
                            <div className="text-xs text-muted-foreground mt-1">Users who charge overnight</div>
                            <div className="text-xs text-muted-foreground">{Math.round(n(ov?.overnight_users ?? 0) / Math.max(n(ov?.total_users ?? 1), 1) * 100)}% of users</div>
                        </div>
                        <div className="rounded-lg border p-4 text-center">
                            <div className="text-3xl font-bold">{n(ov?.overnight_sessions ?? 0).toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground mt-1">Overnight sessions</div>
                            <div className="text-xs text-muted-foreground">{Math.round(n(ov?.overnight_sessions ?? 0) / Math.max(n(ov?.total_complete ?? 1), 1) * 100)}% of all sessions</div>
                        </div>
                        <div className="rounded-lg border p-4 text-center col-span-2">
                            <div className="text-sm font-medium mb-1">What this means</div>
                            <div className="text-xs text-muted-foreground text-left space-y-1">
                                <p>• Users who charge overnight tend to <strong>always reach 90–100%</strong> (phone sits on charger all night)</p>
                                <p>• This inflates the "full charge" percentage — real-world charging behaviour during the day is more conservative</p>
                                <p>• Overnight sessions are still valid data; they represent a real user behaviour pattern</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 6: Battery drain rate */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-primary" />
                        Battery Drain Rate
                    </CardTitle>
                    <CardDescription>
                        % battery dropped per hour of phone usage (calculated from unplug→replug gaps)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                        <div className="rounded-lg border p-3 text-center">
                            <div className="text-2xl font-bold text-primary">{n(dr?.avg_drain_pct_per_hour ?? 0).toFixed(1)}%<span className="text-sm font-normal">/hr</span></div>
                            <div className="text-xs text-muted-foreground">Avg drain rate</div>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                            <div className="text-2xl font-bold">{n(dr?.median_drain_pct_per_hour ?? 0).toFixed(1)}%<span className="text-sm font-normal">/hr</span></div>
                            <div className="text-xs text-muted-foreground">Median drain rate</div>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                            <div className="text-2xl font-bold text-green-500">{n(dr?.avg_hours_per_pct ?? 0).toFixed(2)}<span className="text-sm font-normal"> hrs/%</span></div>
                            <div className="text-xs text-muted-foreground">Hours per 1% battery</div>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                            <div className="text-sm font-semibold">{n(dr?.p25_drain ?? 0).toFixed(1)}% – {n(dr?.p75_drain ?? 0).toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground mt-1">Middle 50% range (IQR)</div>
                            <div className="text-xs text-muted-foreground">{n(dr?.data_points ?? 0).toLocaleString()} data points</div>
                        </div>
                    </div>

                    {drainHourData.length > 0 && (
                        <>
                            <div className="text-sm text-muted-foreground">Drain rate by time of day (when usage period started)</div>
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={drainHourData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="label" className="text-xs" interval={1} angle={-40} textAnchor="end" height={52} />
                                    <YAxis className="text-xs" tickFormatter={(v: number | string) => `${v}%`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        formatter={(v: number | string) => [`${Number(v).toFixed(2)}%/hr`, 'Drain Rate']}
                                    />
                                    <ReferenceLine y={n(dr?.avg_drain_pct_per_hour ?? 0)} stroke="var(--primary)" strokeDasharray="4 4" />
                                    <Line type="monotone" dataKey="drain" name="Drain %/hr" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                            <div className="text-xs text-muted-foreground">
                                Dashed line = average • Higher drain at certain hours may indicate heavy usage periods (e.g. commute)
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// ──────────────────────────────────────────────────────────────────
//  KPI card helper
// ──────────────────────────────────────────────────────────────────

function KpiCard({
    icon, label, value, sub, color,
}: {
    icon: React.ReactNode
    label: string
    value: string
    sub: string
    color: string
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <span className={color}>{icon}</span>
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
        </Card>
    )
}
