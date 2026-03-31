import {
    TrendingUp, Users, Calendar, Clock, Zap, Battery, AlertCircle,
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
    ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdditionalAnalysis } from '@/hooks/useChargingData'

export function AdditionalAnalysisTab() {
    const { data, isLoading, isError, error } = useAdditionalAnalysis()

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
            </div>
        )
    }

    if (isError || !data) {
        return (
            <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                    <div className="text-center space-y-1">
                        <h3 className="font-semibold text-destructive">Could not load Additional Analysis</h3>
                        <p className="text-sm text-muted-foreground max-w-md">{error instanceof Error ? error.message : 'Failed to load'}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const cr = data.correlationRegression
    const clusters = data.userClustering
    const firstLast = data.firstVsLastCharge

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <div className="rounded-md bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-500">
                    Additional Analysis — Filtered dataset (clean users)
                </div>
            </div>

            {/* 1. Correlation & Regression */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Start Level vs Charge Gained (with Regression)</CardTitle>
                        <CardDescription>
                            Lower start level → more charge gained. r ≈ {cr.startVsCharge.correlation.toFixed(3)} • R² ≈ {cr.startVsCharge.r2.toFixed(4)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="start_percentage" type="number" domain={[0, 100]} name="Start Level" className="text-xs" label={{ value: 'Start Level (%)', position: 'insideBottom', offset: -5 }} />
                                <YAxis dataKey="charge_gained" type="number" name="Charge Gained" className="text-xs" label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft' }} />
                                <ZAxis range={[60, 60]} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Scatter data={cr.startVsCharge.data} fill="#22c55e" fillOpacity={0.4} />
                                <ReferenceLine
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    segment={[
                                        { x: 0, y: cr.startVsCharge.intercept },
                                        { x: 100, y: cr.startVsCharge.slope * 100 + cr.startVsCharge.intercept },
                                    ]}
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-muted-foreground mt-2">Dashed line: linear regression (y = {cr.startVsCharge.slope.toFixed(3)}x + {cr.startVsCharge.intercept.toFixed(1)})</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-amber-500" /> Duration vs Charge Gained (with Regression)</CardTitle>
                        <CardDescription>
                            Longer sessions → more charge. r ≈ {cr.durationVsCharge.correlation.toFixed(3)} • R² ≈ {cr.durationVsCharge.r2.toFixed(4)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="duration_minutes" type="number" domain={[0, 150]} name="Duration" className="text-xs" label={{ value: 'Duration (min)', position: 'insideBottom', offset: -5 }} />
                                <YAxis dataKey="charge_gained" type="number" name="Charge Gained" className="text-xs" label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft' }} />
                                <ZAxis range={[60, 60]} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Scatter data={cr.durationVsCharge.data} fill="#f59e0b" fillOpacity={0.4} />
                                <ReferenceLine
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    segment={[
                                        { x: 0, y: cr.durationVsCharge.intercept },
                                        { x: 150, y: cr.durationVsCharge.slope * 150 + cr.durationVsCharge.intercept },
                                    ]}
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-muted-foreground mt-2">Dashed line: linear regression</p>
                    </CardContent>
                </Card>
            </div>

            {/* 2. User Clustering */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> User Clustering — Charging Personas</CardTitle>
                    <CardDescription>Users grouped by behavior: Deep Discharger (plug in when &lt;30%), Top-off (high start, short session), Moderate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                        {clusters.clusterSummary.map((s) => (
                            <div key={s.cluster} className="flex items-center gap-2 rounded-lg border px-4 py-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                                <span className="font-medium">{s.label}</span>
                                <span className="text-muted-foreground">({s.count} users)</span>
                            </div>
                        ))}
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="avg_start" type="number" domain={[0, 100]} name="Avg Start %" className="text-xs" label={{ value: 'Avg Start Level (%)', position: 'insideBottom', offset: -5 }} />
                            <YAxis dataKey="avg_duration" type="number" name="Avg Duration" className="text-xs" label={{ value: 'Avg Duration (min)', angle: -90, position: 'insideLeft' }} />
                            <ZAxis range={[80, 80]} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                            {['deep', 'topoff', 'moderate'].map((c) => (
                                <Scatter
                                    key={c}
                                    data={clusters.users.filter((u) => u.cluster === c)}
                                    dataKey="avg_duration"
                                    fill={clusters.clusterSummary.find((s) => s.cluster === c)?.color ?? '#888'}
                                    fillOpacity={0.6}
                                    name={clusters.clusterSummary.find((s) => s.cluster === c)?.label}
                                />
                            ))}
                            <Legend />
                        </ScatterChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* 3. Weekday vs Weekend */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-500" /> Weekday vs Weekend — Charging by Hour</CardTitle>
                    <CardDescription>Session count per hour: Mon–Fri vs Sat–Sun</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={data.weekdayVsWeekend}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }} />
                            <YAxis className="text-xs" label={{ value: 'Sessions', angle: -90, position: 'insideLeft' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} labelFormatter={(v) => `${v}:00`} />
                            <Legend />
                            <Bar dataKey="weekday" name="Weekday (Mon-Fri)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="weekend" name="Weekend (Sat-Sun)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* 4. First vs Last Charge of Day */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-cyan-500" /> First vs Last Charge of Day</CardTitle>
                    <CardDescription>Compare first charging session vs last session each day (often overnight vs daytime)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">First — Avg Start</div>
                            <div className="text-lg font-bold">{firstLast.stats.first.avg_start.toFixed(1)}%</div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">First — Avg Duration</div>
                            <div className="text-lg font-bold">{firstLast.stats.first.avg_duration.toFixed(0)} min</div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">First — Avg Charge</div>
                            <div className="text-lg font-bold">{firstLast.stats.first.avg_charge.toFixed(1)}%</div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">Last — Avg Start</div>
                            <div className="text-lg font-bold">{firstLast.stats.last.avg_start.toFixed(1)}%</div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">Last — Avg Duration</div>
                            <div className="text-lg font-bold">{firstLast.stats.last.avg_duration.toFixed(0)} min</div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">Last — Avg Charge</div>
                            <div className="text-lg font-bold">{firstLast.stats.last.avg_charge.toFixed(1)}%</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={firstLast.distribution}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="bucket" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                            <Legend />
                            <Bar dataKey="first" name="First Session" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="last" name="Last Session" fill="#ec4899" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-muted-foreground">Battery level at charge start: first vs last session per user-day</p>
                </CardContent>
            </Card>

            {/* 5. Inter-Charge Interval */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Inter-Charge Interval</CardTitle>
                    <CardDescription>Time gap between consecutive charging sessions (unplug → next plug-in)</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.interChargeInterval} margin={{ bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} />
                            <YAxis className="text-xs" label={{ value: 'Session Pairs', angle: -90, position: 'insideLeft' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                            <Bar dataKey="count" name="Pairs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* 6. Battery Health */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Battery className="h-4 w-4 text-emerald-500" /> Depth of Discharge</CardTitle>
                        <CardDescription>How much battery users drain before plugging in (100% − start level). Deeper cycles can stress the battery.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={data.batteryHealth.depthOfDischarge}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="bucket" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Bar dataKey="count" name="Sessions" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Battery className="h-4 w-4 text-amber-500" /> Time at High SoC (≈90%+)</CardTitle>
                        <CardDescription>Estimated minutes per session spent above 90% battery. Prolonged high SoC can accelerate degradation.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={data.batteryHealth.highSoCTime}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Bar dataKey="count" name="Sessions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
