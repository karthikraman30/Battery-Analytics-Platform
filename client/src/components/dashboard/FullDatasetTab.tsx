import {
    Battery, Clock, Users, Zap, TrendingUp, BarChart3, AlertCircle,
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, Legend,
    ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFullDatasetAnalysis } from '@/hooks/useChargingData'
import type { BoxPlotData } from '@/lib/api'

function n(v: unknown) { return Number(v ?? 0) }

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ──────────────────────────────────────────────────────────────────
//  SVG Box Plot (reusable)
// ──────────────────────────────────────────────────────────────────

function CombinedBoxPlot({
    connectData, disconnectData,
}: { connectData: BoxPlotData; disconnectData: BoxPlotData }) {
    const width = 800, height = 280
    const marginLeft = 120, marginRight = 40, marginTop = 50, marginBottom = 60
    const plotWidth = width - marginLeft - marginRight
    const plotHeight = height - marginTop - marginBottom
    const rowHeight = plotHeight / 2
    const boxHeight = 40

    const scale = (value: number) => marginLeft + (value / 100) * plotWidth

    const renderBoxPlot = (data: BoxPlotData, rowIndex: number, color: string) => {
        const centerY = marginTop + rowIndex * rowHeight + rowHeight / 2
        const boxTop = centerY - boxHeight / 2
        const boxBottom = centerY + boxHeight / 2
        return (
            <g key={rowIndex}>
                <line x1={scale(data.whiskerLow)} y1={centerY} x2={scale(data.whiskerHigh)} y2={centerY} stroke={color} strokeWidth={2} />
                <line x1={scale(data.whiskerLow)} y1={boxTop} x2={scale(data.whiskerLow)} y2={boxBottom} stroke={color} strokeWidth={2} />
                <line x1={scale(data.whiskerHigh)} y1={boxTop} x2={scale(data.whiskerHigh)} y2={boxBottom} stroke={color} strokeWidth={2} />
                <rect x={scale(data.q1)} y={boxTop} width={scale(data.q3) - scale(data.q1)} height={boxHeight} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} rx={4} />
                <line x1={scale(data.median)} y1={boxTop} x2={scale(data.median)} y2={boxBottom} stroke={color} strokeWidth={3} />
                <line x1={scale(data.mean)} y1={boxTop} x2={scale(data.mean)} y2={boxBottom} stroke={color} strokeWidth={2} strokeDasharray="4,4" opacity={0.8} />
                <circle cx={scale(data.mean)} cy={centerY} r={5} fill="white" stroke={color} strokeWidth={2} />
            </g>
        )
    }

    const xTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    return (
        <div className="space-y-4">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
                <text x={width / 2} y={25} textAnchor="middle" className="text-base font-semibold fill-foreground" style={{ fontSize: 16 }}>Battery Level Distribution: Connect vs Disconnect (Full Dataset)</text>
                <text x={marginLeft - 15} y={marginTop + rowHeight / 2} textAnchor="end" dominantBaseline="middle" className="text-sm font-medium fill-foreground" style={{ fontSize: 14 }}>Connect</text>
                <text x={marginLeft - 15} y={marginTop + rowHeight * 1.5} textAnchor="end" dominantBaseline="middle" className="text-sm font-medium fill-foreground" style={{ fontSize: 14 }}>Disconnect</text>
                <line x1={marginLeft} y1={height - marginBottom} x2={width - marginRight} y2={height - marginBottom} stroke="currentColor" strokeWidth={1} className="stroke-border" />
                {xTicks.map((tick) => (
                    <g key={tick}>
                        <line x1={scale(tick)} y1={height - marginBottom} x2={scale(tick)} y2={height - marginBottom + 6} stroke="currentColor" strokeWidth={1} className="stroke-border" />
                        <text x={scale(tick)} y={height - marginBottom + 20} textAnchor="middle" className="text-xs fill-muted-foreground" style={{ fontSize: 11 }}>{tick}</text>
                        <line x1={scale(tick)} y1={marginTop} x2={scale(tick)} y2={height - marginBottom} stroke="currentColor" strokeWidth={1} className="stroke-border" opacity={0.1} />
                    </g>
                ))}
                <text x={width / 2} y={height - 10} textAnchor="middle" className="text-sm font-medium fill-foreground" style={{ fontSize: 13 }}>Battery Percentage (%)</text>
                {renderBoxPlot(connectData, 0, '#22c55e')}
                {renderBoxPlot(disconnectData, 1, '#f59e0b')}
            </svg>
            <div className="grid gap-6 lg:grid-cols-2">
                <BoxStats data={connectData} label="Connect Level" color="#22c55e" />
                <BoxStats data={disconnectData} label="Disconnect Level" color="#f59e0b" />
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><div className="h-3 w-3 border-2 border-current" /><span>Box (Q1-Q3)</span></div>
                <div className="flex items-center gap-2"><div className="h-px w-6 bg-current" style={{ height: 3 }} /><span>Median (solid)</span></div>
                <div className="flex items-center gap-2"><div className="h-px w-6 border-t-2 border-dashed border-current" /><span>Mean (dashed)</span></div>
                <div className="flex items-center gap-2"><div className="h-px w-6 bg-current" /><span>Whiskers</span></div>
            </div>
        </div>
    )
}

function BoxStats({ data, label, color }: { data: BoxPlotData; label: string; color: string }) {
    return (
        <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
                <Battery className="h-4 w-4" style={{ color }} />
                {label} Statistics
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Min:</span> <strong>{data.whiskerLow.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Q1:</span> <strong>{data.q1.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Median:</span> <strong className="text-foreground">{data.median.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Q3:</span> <strong>{data.q3.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Max:</span> <strong>{data.whiskerHigh.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Mean:</span> <strong>{data.mean.toFixed(1)}%</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Sample size:</span> <strong>{data.count.toLocaleString()}</strong></div>
            </div>
        </div>
    )
}

function BoxPlotChart({ data, label, unit = '', color = 'var(--chart-1)', domainMax }: {
    data: BoxPlotData; label: string; unit?: string; color?: string; domainMax?: number;
}) {
    const { whiskerLow, q1, median, q3, whiskerHigh, mean, outliersBelow, outliersAbove, count } = data
    const max = domainMax ?? Math.ceil(whiskerHigh * 1.1)
    const scale = (v: number) => (v / max) * 100
    return (
        <div className="space-y-2">
            <div className="text-sm font-medium">{label}</div>
            <svg viewBox="0 0 400 80" className="w-full" style={{ maxHeight: 80 }}>
                <line x1={scale(whiskerLow) * 3.6 + 20} y1={40} x2={scale(whiskerHigh) * 3.6 + 20} y2={40} stroke={color} strokeWidth={1.5} />
                <line x1={scale(whiskerLow) * 3.6 + 20} y1={30} x2={scale(whiskerLow) * 3.6 + 20} y2={50} stroke={color} strokeWidth={1.5} />
                <line x1={scale(whiskerHigh) * 3.6 + 20} y1={30} x2={scale(whiskerHigh) * 3.6 + 20} y2={50} stroke={color} strokeWidth={1.5} />
                <rect x={scale(q1) * 3.6 + 20} y={22} width={(scale(q3) - scale(q1)) * 3.6} height={36} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} rx={3} />
                <line x1={scale(median) * 3.6 + 20} y1={20} x2={scale(median) * 3.6 + 20} y2={60} stroke={color} strokeWidth={2.5} />
                <polygon points={`${scale(mean) * 3.6 + 20},32 ${scale(mean) * 3.6 + 24},40 ${scale(mean) * 3.6 + 20},48 ${scale(mean) * 3.6 + 16},40`} fill="white" stroke={color} strokeWidth={1} />
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Min: <strong>{whiskerLow.toFixed(1)}{unit}</strong></span>
                <span>Q1: <strong>{q1.toFixed(1)}{unit}</strong></span>
                <span>Median: <strong className="text-foreground">{median.toFixed(1)}{unit}</strong></span>
                <span>Q3: <strong>{q3.toFixed(1)}{unit}</strong></span>
                <span>Max: <strong>{whiskerHigh.toFixed(1)}{unit}</strong></span>
                <span>Mean: <strong>{mean.toFixed(1)}{unit}</strong></span>
                <span>n={count.toLocaleString()}</span>
            </div>
            {(outliersBelow > 0 || outliersAbove > 0) && (
                <div className="text-xs text-amber-500">
                    Outliers: {outliersBelow > 0 && `${outliersBelow} below`}{outliersBelow > 0 && outliersAbove > 0 && ' • '}{outliersAbove > 0 && `${outliersAbove} above`}
                </div>
            )}
        </div>
    )
}

function HeatmapGrid({ data }: { data: { day_of_week: number; hour: number; session_count: number }[] }) {
    const maxCount = Math.max(...data.map(d => Number(d.session_count)), 1)
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const grid = new Map<string, number>()
    data.forEach(d => grid.set(`${d.day_of_week}-${d.hour}`, Number(d.session_count)))

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[700px]">
                <div className="flex mb-1">
                    <div className="w-12" />
                    {hours.map(h => (
                        <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">{h}</div>
                    ))}
                </div>
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                    <div key={day} className="flex items-center">
                        <div className="w-12 text-xs text-muted-foreground">{DAY_NAMES[day]}</div>
                        {hours.map(hour => {
                            const count = grid.get(`${day}-${hour}`) || 0
                            const intensity = count / maxCount
                            return (
                                <div key={hour} className="flex-1 aspect-square m-[1px] rounded-sm" title={`${DAY_NAMES[day]} ${hour}:00 — ${count} sessions`}
                                    style={{ backgroundColor: `rgba(59, 130, 246, ${Math.max(0.05, intensity)})` }} />
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ──────────────────────────────────────────────────────────────────
//  Full Dataset Analysis Tab
// ──────────────────────────────────────────────────────────────────

export function FullDatasetTab() {
    const { data, isLoading, isError, error } = useFullDatasetAnalysis()

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
                <div className="grid gap-6 lg:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
            </div>
        )
    }

    if (isError || !data) {
        return (
            <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                    <div className="text-center space-y-1">
                        <h3 className="font-semibold text-destructive">Could not load Full Dataset Analysis</h3>
                        <p className="text-sm text-muted-foreground max-w-md">{error instanceof Error ? error.message : 'Failed to load'}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const s = data.summary

    return (
        <div className="space-y-6">
            {/* Badge */}
            <div className="flex items-center gap-2">
                <div className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500">
                    Full Dataset — {n(s.total_users)} users • {n(s.total_events).toLocaleString()} events • {n(s.total_sessions).toLocaleString()} sessions
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">{n(s.total_users)}</div>
                        <p className="text-xs text-muted-foreground">{n(s.total_sessions).toLocaleString()} sessions ({n(s.complete_sessions).toLocaleString()} complete)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{n(s.total_events).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Charging connect + disconnect</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{n(s.avg_duration).toFixed(0)} min</div>
                        <p className="text-xs text-muted-foreground">Median: {n(s.median_duration).toFixed(0)} min • σ: {n(s.stddev_duration).toFixed(0)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Charge Gained</CardTitle>
                        <Battery className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{n(s.avg_charge_gained).toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">Connect: {n(s.avg_connect_level).toFixed(0)}% → Disconnect: {n(s.avg_disconnect_level).toFixed(0)}%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Combined Battery Level Box Plot */}
            <Card>
                <CardHeader>
                    <CardTitle>Battery Level — Connect vs Disconnect</CardTitle>
                    <CardDescription>Box plots showing the distribution of battery levels when users plug in and unplug</CardDescription>
                </CardHeader>
                <CardContent>
                    <CombinedBoxPlot connectData={data.boxPlots.connectLevel} disconnectData={data.boxPlots.disconnectLevel} />
                </CardContent>
            </Card>

            {/* Duration & Charge Gained Box Plots */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" /> Charging Duration</CardTitle>
                        <CardDescription>How long users leave their phone charging (minutes)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BoxPlotChart data={data.boxPlots.duration} label="Duration (min)" unit=" min" color="#3b82f6" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-purple-500" /> Charge Gained</CardTitle>
                        <CardDescription>How much battery % is gained per session</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BoxPlotChart data={data.boxPlots.chargeGained} label="Charge Gained (%)" unit="%" color="#a855f7" domainMax={100} />
                    </CardContent>
                </Card>
            </div>

            {/* CDF Charts */}
            <div className="grid gap-6 lg:grid-cols-3">
                {data.cdfs.levelCdf.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>CDF — Battery Level at Charge Start</CardTitle>
                            <CardDescription>What % of sessions start below a given battery level</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={data.cdfs.levelCdf.map(d => ({ x: n(d.x), cdf: n(d.cdf) }))}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="x" type="number" domain={[0, 100]} tickCount={6} className="text-xs" label={{ value: 'Battery %', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis className="text-xs" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} label={{ value: 'F(x)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(4), 'F(x)']} />
                                    <Line type="monotone" dataKey="cdf" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
                {data.cdfs.durationCdf.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>CDF — Charging Duration</CardTitle>
                            <CardDescription>What % of sessions are shorter than a given duration</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={data.cdfs.durationCdf.map(d => ({ x: n(d.x), cdf: n(d.cdf) }))}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="x" type="number" domain={[0, 150]} tickCount={7} className="text-xs" label={{ value: 'Duration (min)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis className="text-xs" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} label={{ value: 'F(x)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(4), 'F(x)']} />
                                    <Line type="monotone" dataKey="cdf" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
                {data.cdfs.chargeCdf.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>CDF — Charge Gained</CardTitle>
                            <CardDescription>What % of sessions gain less than a given charge %</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={data.cdfs.chargeCdf.map(d => ({ x: n(d.x), cdf: n(d.cdf) }))}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="x" type="number" domain={[0, 100]} tickCount={6} className="text-xs" label={{ value: 'Charge Gained %', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis className="text-xs" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} label={{ value: 'F(x)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(4), 'F(x)']} />
                                    <Line type="monotone" dataKey="cdf" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Histograms */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Duration Distribution</CardTitle>
                        <CardDescription>How long charging sessions last</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={data.histograms.duration}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Bar dataKey="count" name="Sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Charge Gained Distribution (5-min Merged Sessions)</CardTitle>
                        <CardDescription>Sessions within 5 min are merged • Negative values excluded • Clean 10% bins</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={data.histograms.chargeGained}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} label={{ value: 'Charge Gained (%)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                <YAxis className="text-xs" label={{ value: 'Number of Sessions', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), 'Sessions']} />
                                <Bar dataKey="count" name="Sessions" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        {data.histograms.chargeGainedMergeStats && (() => {
                            const ms = data.histograms.chargeGainedMergeStats;
                            return (
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
                                    <span>Original sessions: <strong>{n(ms.original_sessions).toLocaleString()}</strong></span>
                                    <span>After merge: <strong>{n(ms.merged_sessions).toLocaleString()}</strong></span>
                                    <span>Sessions merged: <strong>{n(ms.sessions_merged_away).toLocaleString()}</strong></span>
                                    <span>Negative excluded: <strong className="text-amber-500">{n(ms.negative_excluded)}</strong></span>
                                    <span>In chart: <strong className="text-green-500">{n(ms.sessions_in_chart).toLocaleString()}</strong></span>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            {/* Connect vs Disconnect Level Distribution */}
            <Card>
                <CardHeader>
                    <CardTitle>Connect vs Disconnect Battery Level Distribution</CardTitle>
                    <CardDescription>Battery level when users plug in vs when they unplug (10% buckets)</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={(() => {
                            const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                            const connectMap = new Map(data.histograms.connectLevel.map(d => [n(d.level_bucket), n(d.count)]))
                            const disconnectMap = new Map(data.histograms.disconnectLevel.map(d => [n(d.level_bucket), n(d.count)]))
                            return buckets.map(b => ({ level: `${b}%`, connect: connectMap.get(b) || 0, disconnect: disconnectMap.get(b) || 0 }))
                        })()}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="level" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                            <Legend />
                            <Bar dataKey="connect" name="Plug In" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="disconnect" name="Unplug" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Daily Charging Frequency */}
            {data.dailyFrequency.distribution.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Charging Frequency</CardTitle>
                        <CardDescription>
                            How many times users charge per day • Median: <strong>{n(data.dailyFrequency.stats.median)} charges/day</strong> • Mean: <strong>{n(data.dailyFrequency.stats.mean).toFixed(1)}</strong> • σ: <strong>{n(data.dailyFrequency.stats.stddev).toFixed(2)}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.dailyFrequency.distribution.map(d => ({ charges: n(d.charges_per_day), frequency: n(d.frequency) }))}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="charges" className="text-xs" label={{ value: 'Charges per Day', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                <YAxis className="text-xs" label={{ value: 'User-Days', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), 'User-Days']} labelFormatter={(v) => `${v} charges/day`} />
                                <Bar dataKey="frequency" name="User-Days" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Hourly Patterns */}
            {data.hourlyPattern.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Charging by Hour of Day</CardTitle>
                            <CardDescription>When do users plug in?</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={data.hourlyPattern}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} labelFormatter={(v) => `${v}:00 - ${v}:59`} />
                                    <Bar dataKey="session_count" name="Sessions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Avg Battery Level at Charge Start by Hour</CardTitle>
                            <CardDescription>Lower = users wait until battery is low</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={data.hourlyPattern}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} />
                                    <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} labelFormatter={(v) => `${v}:00`} formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}%`, '']} />
                                    <Legend />
                                    <Line type="monotone" dataKey="avg_start_level" name="Avg Start Level" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="avg_charge_gained" name="Avg Charge Gained" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Heatmap */}
            {data.heatmap.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Charging Heatmap</CardTitle>
                        <CardDescription>Day of week × hour of day • Darker = more sessions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <HeatmapGrid data={data.heatmap} />
                    </CardContent>
                </Card>
            )}

            {/* Battery Tide — avg battery level across 24h */}
            {data.batteryTide && data.batteryTide.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Battery Tide — Population Average Across 24 Hours</CardTitle>
                        <CardDescription>Average battery level when users plug in, by hour of day. Shows "energy crisis" hours (valleys) and "recovery" hours (peaks).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={data.batteryTide.map(d => ({ hour: n(d.hour), level: n(d.avg_battery_level), users: n(d.user_count) }))}>
                                <defs>
                                    <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} label={{ value: 'Avg Battery Level at Plug-in (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    labelFormatter={(v) => `${v}:00`}
                                    formatter={(v: number | undefined, name?: string) => {
                                        if (name === 'level') return [`${(v ?? 0).toFixed(1)}%`, 'Avg Battery Level'];
                                        return [v, 'Users contributing'];
                                    }} />
                                <Line type="monotone" dataKey="level" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} fill="url(#tideFill)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Transition Matrix — Start % vs End % heatmap */}
            {data.transitionMatrix && data.transitionMatrix.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Battery className="h-4 w-4 text-cyan-500" /> Charge Transition Matrix — Start % vs End %</CardTitle>
                        <CardDescription>Each cell shows how many sessions started in a given battery range and ended in another. Bright horizontal line at top = users charge to 100%.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
                            const grid = new Map<string, number>()
                            let maxCount = 0
                            data.transitionMatrix.forEach(d => {
                                const key = `${n(d.start_bucket)}-${n(d.end_bucket)}`
                                const count = n(d.count)
                                grid.set(key, count)
                                if (count > maxCount) maxCount = count
                            })
                            return (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[600px]">
                                        {/* Header row */}
                                        <div className="flex mb-1">
                                            <div className="w-20 text-xs text-muted-foreground text-right pr-2 flex items-end justify-end pb-1">Start ↓ End →</div>
                                            {buckets.map(b => (
                                                <div key={b} className="flex-1 text-center text-[10px] text-muted-foreground">{b}%</div>
                                            ))}
                                        </div>
                                        {/* Data rows */}
                                        {buckets.map(startB => (
                                            <div key={startB} className="flex items-center">
                                                <div className="w-20 text-xs text-muted-foreground text-right pr-2">{startB}-{startB + 10}%</div>
                                                {buckets.map(endB => {
                                                    const count = grid.get(`${startB}-${endB}`) || 0
                                                    const intensity = maxCount > 0 ? count / maxCount : 0
                                                    // Only show cells where end >= start (valid transitions)
                                                    const isValid = endB >= startB
                                                    return (
                                                        <div key={endB} className="flex-1 aspect-square m-[1px] rounded-sm flex items-center justify-center"
                                                            title={`Start: ${startB}-${startB + 10}% → End: ${endB}-${endB + 10}% — ${count} sessions`}
                                                            style={{
                                                                backgroundColor: isValid && count > 0
                                                                    ? `rgba(6, 182, 212, ${Math.max(0.08, intensity)})`
                                                                    : 'rgba(255,255,255,0.02)'
                                                            }}>
                                                            {count > 0 && <span className="text-[8px] text-foreground/70">{count}</span>}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                        <div className="mt-2 text-xs text-muted-foreground text-center">
                                            Y-axis: Battery level at plug-in • X-axis: Battery level at unplug • Darker = more sessions
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </CardContent>
                </Card>
            )}

            {/* Scatter Plots */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Start Level vs Charge Gained</CardTitle>
                        <CardDescription>Lower start level → more charge gained</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="start_percentage" type="number" name="Start Level" domain={[0, 100]} className="text-xs" label={{ value: 'Start Level (%)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                <YAxis dataKey="charge_gained" type="number" name="Charge Gained" className="text-xs" label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                <ZAxis range={[15, 15]} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Scatter data={data.scatterPlots.startVsCharge.map(d => ({ start_percentage: n(d.start_percentage), charge_gained: n(d.charge_gained) }))} fill="#22c55e" fillOpacity={0.4} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Duration vs Charge Gained</CardTitle>
                        <CardDescription>Longer sessions → more charge gained</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="duration_minutes" type="number" name="Duration" className="text-xs" label={{ value: 'Duration (min)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                <YAxis dataKey="charge_gained" type="number" name="Charge Gained" className="text-xs" label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                <ZAxis range={[15, 15]} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Scatter data={data.scatterPlots.durationVsCharge.map(d => ({ duration_minutes: n(d.duration_minutes), charge_gained: n(d.charge_gained) }))} fill="#f59e0b" fillOpacity={0.4} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
