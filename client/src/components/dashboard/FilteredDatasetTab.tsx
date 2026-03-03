import {
    Battery, Clock, Users, Zap, TrendingUp, BarChart3, AlertCircle,
    Filter, ArrowDownRight,
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, Legend,
    ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilteredDatasetAnalysis } from '@/hooks/useChargingData'
import type { BoxPlotData } from '@/lib/api'

function n(v: unknown) { return Number(v ?? 0) }

// ──────────────────────────────────────────────────────────────────
//  Reusable Box Plot SVG
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
                <text x={width / 2} y={25} textAnchor="middle" className="text-base font-semibold fill-foreground" style={{ fontSize: 16 }}>Battery Level Distribution: Connect vs Disconnect (Filtered Data)</text>
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
                <div><span className="text-muted-foreground">Median:</span> <strong>{data.median.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Q3:</span> <strong>{data.q3.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Max:</span> <strong>{data.whiskerHigh.toFixed(1)}%</strong></div>
                <div><span className="text-muted-foreground">Mean:</span> <strong>{data.mean.toFixed(1)}%</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">n:</span> <strong>{data.count.toLocaleString()}</strong></div>
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

// ──────────────────────────────────────────────────────────────────
//  Filtered Dataset Analysis Tab
// ──────────────────────────────────────────────────────────────────

export function FilteredDatasetTab() {
    const { data, isLoading, isError, error } = useFilteredDatasetAnalysis()

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
                        <h3 className="font-semibold text-destructive">Could not load Filtered Dataset Analysis</h3>
                        <p className="text-sm text-muted-foreground max-w-md">{error instanceof Error ? error.message : 'Failed to load'}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const funnel = data.filterFunnel
    const c = data.comparison
    const fa = data.filteredAnalysis

    return (
        <div className="space-y-6">
            {/* Section 1: Data Quality Filtering */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-500">
                        <Filter className="inline h-3 w-3 mr-1" /> Data Quality Filtering
                    </div>
                </div>

                <p className="text-sm text-muted-foreground max-w-2xl">
                    Before analysis, we filter users to ensure data quality. We remove users with <strong>high event mismatch</strong> (more than 10 disconnect/connect imbalances) and <strong>insufficient observation period</strong> (fewer than 8 distinct days of data).
                </p>

                {/* Filter Funnel */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-orange-500" /> Filtering Pipeline</CardTitle>
                        <CardDescription>How many users pass each filter criterion</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            {[
                                { label: 'All Users', value: n(funnel.all_users), pct: '100%', color: 'bg-blue-500' },
                                { label: 'Mismatch ≤ 10', value: n(funnel.mismatch_pass), pct: `${((n(funnel.mismatch_pass) / n(funnel.all_users)) * 100).toFixed(0)}%`, color: 'bg-amber-500' },
                                { label: 'Obs Days ≥ 8', value: n(funnel.obs_pass), pct: `${((n(funnel.obs_pass) / n(funnel.all_users)) * 100).toFixed(0)}%`, color: 'bg-green-500' },
                                { label: 'Both Filters', value: n(funnel.both_pass), pct: `${((n(funnel.both_pass) / n(funnel.all_users)) * 100).toFixed(0)}%`, color: 'bg-emerald-500' },
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    {i > 0 && <ArrowDownRight className="h-4 w-4 text-muted-foreground hidden sm:block" />}
                                    <div className="rounded-lg border p-4 min-w-[140px] text-center hover:border-primary/50 transition-colors">
                                        <div className="text-xs text-muted-foreground mb-1">{step.label}</div>
                                        <div className="text-2xl font-bold">{step.value}</div>
                                        <div className={`text-xs mt-1 text-white rounded-full px-2 py-0.5 inline-block ${step.color}`}>{step.pct}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Mismatch + Observation Period Distributions */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Event Mismatch Distribution</CardTitle>
                            <CardDescription>Number of users by their connect/disconnect event mismatch level</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={data.mismatchDist}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="bucket" className="text-xs" />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Bar dataKey="user_count" name="Users" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="mt-2 text-xs text-muted-foreground">
                                Users with mismatch ≤ 10 are kept (threshold shown by dashed line)
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Observation Period Distribution</CardTitle>
                            <CardDescription>
                                How many distinct days of data each user has • Avg: {n(data.obsStats.avg_days).toFixed(1)} • Median: {n(data.obsStats.median_days)} • Range: {n(data.obsStats.min_days)}-{n(data.obsStats.max_days)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={data.obsDist}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="bucket" className="text-xs" />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        formatter={(val: number | undefined, name?: string) => {
                                            if (name === 'avg_days') return [`${(val ?? 0).toFixed(1)} days`, 'Avg Days']
                                            return [(val ?? 0), 'Users']
                                        }} />
                                    <Bar dataKey="user_count" name="Users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="mt-2 text-xs text-muted-foreground">
                                Users with ≥ 8 observation days are kept
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Section 2: Comparison */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Full Dataset vs Filtered Dataset Comparison</CardTitle>
                    <CardDescription>Side-by-side metrics comparing all users vs the filtered subset</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 pr-4 font-medium">Metric</th>
                                    <th className="text-right py-2 px-4 font-medium">Full Dataset</th>
                                    <th className="text-right py-2 px-4 font-medium">Filtered</th>
                                    <th className="text-right py-2 pl-4 font-medium">Difference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { label: 'Users', full: n(c.full_users), filt: n(c.filt_users), format: 'int' },
                                    { label: 'Total Sessions', full: n(c.full_sessions), filt: n(c.filt_sessions), format: 'int' },
                                    { label: 'Complete Sessions', full: n(c.full_complete), filt: n(c.filt_complete), format: 'int' },
                                    { label: 'Avg Duration (min)', full: n(c.full_avg_duration), filt: n(c.filt_avg_duration), format: 'float' },
                                    { label: 'Median Duration (min)', full: n(c.full_median_duration), filt: n(c.filt_median_duration), format: 'float' },
                                    { label: 'Avg Charge Gained (%)', full: n(c.full_avg_charge), filt: n(c.filt_avg_charge), format: 'float' },
                                    { label: 'Avg Connect Level (%)', full: n(c.full_avg_connect), filt: n(c.filt_avg_connect), format: 'float' },
                                    { label: 'Avg Disconnect Level (%)', full: n(c.full_avg_disconnect), filt: n(c.filt_avg_disconnect), format: 'float' },
                                ].map(({ label, full, filt, format }) => {
                                    const diff = filt - full
                                    const pctDiff = full > 0 ? ((diff / full) * 100) : 0
                                    const fmt = (v: number) => format === 'int' ? v.toLocaleString() : v.toFixed(1)
                                    return (
                                        <tr key={label} className="border-b border-border/50">
                                            <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                                            <td className="text-right py-2 px-4 font-medium">{fmt(full)}</td>
                                            <td className="text-right py-2 px-4 font-medium">{fmt(filt)}</td>
                                            <td className={`text-right py-2 pl-4 text-xs font-medium ${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                {diff > 0 ? '+' : ''}{fmt(diff)} ({pctDiff > 0 ? '+' : ''}{pctDiff.toFixed(1)}%)
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Section 3: Filtered Dataset Visualizations */}
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-500">
                        Filtered Dataset Results — {n(c.filt_users)} users • {n(c.filt_sessions).toLocaleString()} sessions
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Filtered Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-500">{n(c.filt_users)}</div>
                            <p className="text-xs text-muted-foreground">from {n(c.full_users)} total ({((n(c.filt_users) / n(c.full_users)) * 100).toFixed(0)}%)</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{n(c.filt_sessions).toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">{n(c.filt_complete).toLocaleString()} complete</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{n(c.filt_avg_duration).toFixed(0)} min</div>
                            <p className="text-xs text-muted-foreground">Median: {n(c.filt_median_duration).toFixed(0)} min</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg Charge Gained</CardTitle>
                            <Battery className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{n(c.filt_avg_charge).toFixed(1)}%</div>
                            <p className="text-xs text-muted-foreground">Connect: {n(c.filt_avg_connect).toFixed(0)}% → {n(c.filt_avg_disconnect).toFixed(0)}%</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Battery Level Box Plot for Filtered */}
                <Card>
                    <CardHeader>
                        <CardTitle>Battery Level — Connect vs Disconnect (Filtered)</CardTitle>
                        <CardDescription>Box plots for the filtered dataset</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CombinedBoxPlot connectData={fa.boxPlots.connectLevel} disconnectData={fa.boxPlots.disconnectLevel} />
                    </CardContent>
                </Card>

                {/* Duration & Charge Box Plots */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" /> Duration (Filtered)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BoxPlotChart data={fa.boxPlots.duration} label="Duration (min)" unit=" min" color="#3b82f6" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-purple-500" /> Charge Gained (Filtered)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BoxPlotChart data={fa.boxPlots.chargeGained} label="Charge Gained (%)" unit="%" color="#a855f7" domainMax={100} />
                        </CardContent>
                    </Card>
                </div>

                {/* CDF Charts (3-col) */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {fa.cdfs.levelCdf.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>CDF — Start Level (Filtered)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={fa.cdfs.levelCdf.map(d => ({ x: n(d.x), cdf: n(d.cdf) }))}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="x" type="number" domain={[0, 100]} className="text-xs" label={{ value: 'Battery %', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                        <YAxis className="text-xs" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(4), 'F(x)']} />
                                        <Line type="monotone" dataKey="cdf" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}
                    {fa.cdfs.durationCdf.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>CDF — Duration (Filtered)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={fa.cdfs.durationCdf.map(d => ({ x: n(d.x), cdf: n(d.cdf) }))}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="x" type="number" domain={[0, 150]} className="text-xs" label={{ value: 'Min', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                        <YAxis className="text-xs" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(4), 'F(x)']} />
                                        <Line type="monotone" dataKey="cdf" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}
                    {fa.cdfs.chargeCdf.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>CDF — Charge Gained (Filtered)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={fa.cdfs.chargeCdf.map(d => ({ x: n(d.x), cdf: n(d.cdf) }))}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="x" type="number" domain={[0, 100]} className="text-xs" label={{ value: 'Charge Gained %', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                        <YAxis className="text-xs" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
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
                            <CardTitle>Duration Distribution (Filtered)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={fa.histograms.duration}>
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
                            <CardTitle>Charge Gained Distribution — Filtered (5-min Merged)</CardTitle>
                            <CardDescription>Sessions within 5 min merged • Negative excluded • 10% bins</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={fa.histograms.chargeGained}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} label={{ value: 'Charge Gained (%)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis className="text-xs" label={{ value: 'Number of Sessions', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), 'Sessions']} />
                                    <Bar dataKey="count" name="Sessions" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            {fa.histograms.chargeGainedMergeStats && (() => {
                                const ms = fa.histograms.chargeGainedMergeStats;
                                return (
                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
                                        <span>Original: <strong>{n(ms.original_sessions).toLocaleString()}</strong></span>
                                        <span>After merge: <strong>{n(ms.merged_sessions).toLocaleString()}</strong></span>
                                        <span>Merged: <strong>{n(ms.sessions_merged_away).toLocaleString()}</strong></span>
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
                        <CardTitle>Connect vs Disconnect Battery Level (Filtered)</CardTitle>
                        <CardDescription>Battery level when users plug in vs unplug — filtered subset</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={(() => {
                                const bkts = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                                const cMap = new Map(fa.histograms.connectLevel.map(d => [n(d.level_bucket), n(d.count)]))
                                const dMap = new Map(fa.histograms.disconnectLevel.map(d => [n(d.level_bucket), n(d.count)]))
                                return bkts.map(b => ({ level: `${b}%`, connect: cMap.get(b) || 0, disconnect: dMap.get(b) || 0 }))
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

                {/* Daily Frequency */}
                {fa.dailyFrequency.distribution.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Daily Charging Frequency (Filtered)</CardTitle>
                            <CardDescription>Median: {n(fa.dailyFrequency.stats.median)} charges/day • Mean: {n(fa.dailyFrequency.stats.mean).toFixed(1)} • σ: {n(fa.dailyFrequency.stats.stddev).toFixed(2)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={fa.dailyFrequency.distribution.map(d => ({ charges: n(d.charges_per_day), frequency: n(d.frequency) }))}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="charges" className="text-xs" label={{ value: 'Charges per Day', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), 'User-Days']} />
                                    <Bar dataKey="frequency" name="User-Days" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Hourly Pattern */}
                {fa.hourlyPattern.length > 0 && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Charging by Hour (Filtered)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={fa.hourlyPattern}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} />
                                        <YAxis className="text-xs" />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} labelFormatter={(v) => `${v}:00`} />
                                        <Bar dataKey="session_count" name="Sessions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Avg Battery Level by Hour (Filtered)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={fa.hourlyPattern}>
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

                {/* Battery Tide — filtered */}
                {fa.batteryTide && fa.batteryTide.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Battery Tide — Filtered (24-Hour Cycle)</CardTitle>
                            <CardDescription>Average battery level at plug-in by hour — filtered dataset</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={fa.batteryTide.map(d => ({ hour: n(d.hour), level: n(d.avg_battery_level) }))}>
                                    <defs>
                                        <linearGradient id="tideFillF" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} label={{ value: 'Avg Battery Level (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        labelFormatter={(v) => `${v}:00`}
                                        formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}%`, 'Avg Battery Level']} />
                                    <Line type="monotone" dataKey="level" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} fill="url(#tideFillF)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Transition Matrix — filtered */}
                {fa.transitionMatrix && fa.transitionMatrix.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Battery className="h-4 w-4 text-cyan-500" /> Charge Transition Matrix (Filtered)</CardTitle>
                            <CardDescription>Start % vs End % — how charging sessions transition across battery levels</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {(() => {
                                const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
                                const grid = new Map<string, number>()
                                let maxCount = 0
                                fa.transitionMatrix.forEach(d => {
                                    const key = `${n(d.start_bucket)}-${n(d.end_bucket)}`
                                    const count = n(d.count)
                                    grid.set(key, count)
                                    if (count > maxCount) maxCount = count
                                })
                                return (
                                    <div className="overflow-x-auto">
                                        <div className="min-w-[600px]">
                                            <div className="flex mb-1">
                                                <div className="w-20 text-xs text-muted-foreground text-right pr-2 flex items-end justify-end pb-1">Start ↓ End →</div>
                                                {buckets.map(b => (
                                                    <div key={b} className="flex-1 text-center text-[10px] text-muted-foreground">{b}%</div>
                                                ))}
                                            </div>
                                            {buckets.map(startB => (
                                                <div key={startB} className="flex items-center">
                                                    <div className="w-20 text-xs text-muted-foreground text-right pr-2">{startB}-{startB + 10}%</div>
                                                    {buckets.map(endB => {
                                                        const count = grid.get(`${startB}-${endB}`) || 0
                                                        const intensity = maxCount > 0 ? count / maxCount : 0
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

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Start Level vs Charge Gained (Filtered)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={320}>
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="start_percentage" type="number" name="Start Level" domain={[0, 100]} className="text-xs" label={{ value: 'Start Level (%)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis dataKey="charge_gained" type="number" name="Charge Gained" className="text-xs" label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                    <ZAxis range={[15, 15]} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Scatter data={fa.scatterPlots.startVsCharge.map(d => ({ start_percentage: n(d.start_percentage), charge_gained: n(d.charge_gained) }))} fill="#22c55e" fillOpacity={0.4} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Duration vs Charge Gained (Filtered)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={320}>
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="duration_minutes" type="number" name="Duration" className="text-xs" label={{ value: 'Duration (min)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }} />
                                    <YAxis dataKey="charge_gained" type="number" name="Charge Gained" className="text-xs" label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }} />
                                    <ZAxis range={[15, 15]} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Scatter data={fa.scatterPlots.durationVsCharge.map(d => ({ duration_minutes: n(d.duration_minutes), charge_gained: n(d.charge_gained) }))} fill="#f59e0b" fillOpacity={0.4} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
