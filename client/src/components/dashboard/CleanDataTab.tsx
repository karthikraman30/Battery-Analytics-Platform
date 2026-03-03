import {
    Battery, Clock, Users, Zap, TrendingUp, BarChart3, AlertCircle,
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCleanDataAnalysis } from '@/hooks/useChargingData'
import type { BoxPlotData } from '@/lib/api'

function n(v: unknown) { return Number(v ?? 0) }

// ──────────────────────────────────────────────────────────────────
//  Combined horizontal box plot for Connect vs Disconnect comparison
// ──────────────────────────────────────────────────────────────────

function CombinedBatteryLevelBoxPlot({
    connectData,
    disconnectData,
}: {
    connectData: BoxPlotData;
    disconnectData: BoxPlotData;
}) {
    // Chart dimensions
    const width = 800
    const height = 280
    const marginLeft = 120
    const marginRight = 40
    const marginTop = 50
    const marginBottom = 60
    const plotWidth = width - marginLeft - marginRight
    const plotHeight = height - marginTop - marginBottom
    const rowHeight = plotHeight / 2
    const boxHeight = 40

    // Scale function: 0-100% battery maps to SVG x coordinates
    const scale = (value: number) => marginLeft + (value / 100) * plotWidth

    // Render a single horizontal box plot row
    const renderBoxPlot = (data: BoxPlotData, rowIndex: number, color: string) => {
        const centerY = marginTop + rowIndex * rowHeight + rowHeight / 2
        const boxTop = centerY - boxHeight / 2
        const boxBottom = centerY + boxHeight / 2

        return (
            <g key={rowIndex}>
                {/* Whisker line */}
                <line
                    x1={scale(data.whiskerLow)}
                    y1={centerY}
                    x2={scale(data.whiskerHigh)}
                    y2={centerY}
                    stroke={color}
                    strokeWidth={2}
                />
                {/* Whisker caps */}
                <line
                    x1={scale(data.whiskerLow)}
                    y1={boxTop}
                    x2={scale(data.whiskerLow)}
                    y2={boxBottom}
                    stroke={color}
                    strokeWidth={2}
                />
                <line
                    x1={scale(data.whiskerHigh)}
                    y1={boxTop}
                    x2={scale(data.whiskerHigh)}
                    y2={boxBottom}
                    stroke={color}
                    strokeWidth={2}
                />
                {/* Box (Q1 to Q3) */}
                <rect
                    x={scale(data.q1)}
                    y={boxTop}
                    width={scale(data.q3) - scale(data.q1)}
                    height={boxHeight}
                    fill={color}
                    fillOpacity={0.3}
                    stroke={color}
                    strokeWidth={2}
                    rx={4}
                />
                {/* Median line (solid, thicker) */}
                <line
                    x1={scale(data.median)}
                    y1={boxTop}
                    x2={scale(data.median)}
                    y2={boxBottom}
                    stroke={color}
                    strokeWidth={3}
                />
                {/* Mean marker (dashed vertical line + diamond) */}
                <line
                    x1={scale(data.mean)}
                    y1={boxTop}
                    x2={scale(data.mean)}
                    y2={boxBottom}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    opacity={0.8}
                />
                <circle
                    cx={scale(data.mean)}
                    cy={centerY}
                    r={5}
                    fill="white"
                    stroke={color}
                    strokeWidth={2}
                />
            </g>
        )
    }

    const connectColor = '#22c55e'
    const disconnectColor = '#f59e0b'

    // Tick marks for x-axis
    const xTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    return (
        <div className="space-y-4">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
                {/* Title */}
                <text
                    x={width / 2}
                    y={25}
                    textAnchor="middle"
                    className="text-base font-semibold fill-foreground"
                    style={{ fontSize: 16 }}
                >
                    Battery Level Distribution: Connect vs Disconnect
                </text>

                {/* Y-axis labels */}
                <text
                    x={marginLeft - 15}
                    y={marginTop + rowHeight / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-sm font-medium fill-foreground"
                    style={{ fontSize: 14 }}
                >
                    Connect
                </text>
                <text
                    x={marginLeft - 15}
                    y={marginTop + rowHeight * 1.5}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-sm font-medium fill-foreground"
                    style={{ fontSize: 14 }}
                >
                    Disconnect
                </text>

                {/* X-axis */}
                <line
                    x1={marginLeft}
                    y1={height - marginBottom}
                    x2={width - marginRight}
                    y2={height - marginBottom}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="stroke-border"
                />

                {/* X-axis ticks and labels */}
                {xTicks.map((tick) => (
                    <g key={tick}>
                        <line
                            x1={scale(tick)}
                            y1={height - marginBottom}
                            x2={scale(tick)}
                            y2={height - marginBottom + 6}
                            stroke="currentColor"
                            strokeWidth={1}
                            className="stroke-border"
                        />
                        <text
                            x={scale(tick)}
                            y={height - marginBottom + 20}
                            textAnchor="middle"
                            className="text-xs fill-muted-foreground"
                            style={{ fontSize: 11 }}
                        >
                            {tick}
                        </text>
                    </g>
                ))}

                {/* X-axis label */}
                <text
                    x={width / 2}
                    y={height - 10}
                    textAnchor="middle"
                    className="text-sm font-medium fill-foreground"
                    style={{ fontSize: 13 }}
                >
                    Battery Percentage (%)
                </text>

                {/* Grid lines (vertical) */}
                {xTicks.map((tick) => (
                    <line
                        key={tick}
                        x1={scale(tick)}
                        y1={marginTop}
                        x2={scale(tick)}
                        y2={height - marginBottom}
                        stroke="currentColor"
                        strokeWidth={1}
                        className="stroke-border"
                        opacity={0.1}
                    />
                ))}

                {/* Box plots */}
                {renderBoxPlot(connectData, 0, connectColor)}
                {renderBoxPlot(disconnectData, 1, disconnectColor)}
            </svg>

            {/* Legend and Statistics Tables */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Connect Statistics */}
                <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <Battery className="h-4 w-4" style={{ color: connectColor }} />
                        Connect Level Statistics
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Min:</span> <strong>{connectData.whiskerLow.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Q1:</span> <strong>{connectData.q1.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Median:</span> <strong className="text-foreground">{connectData.median.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Q3:</span> <strong>{connectData.q3.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Max:</span> <strong>{connectData.whiskerHigh.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Mean:</span> <strong>{connectData.mean.toFixed(1)}%</strong></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Sample size:</span> <strong>{connectData.count.toLocaleString()}</strong></div>
                        {(connectData.outliersBelow > 0 || connectData.outliersAbove > 0) && (
                            <div className="col-span-2 text-amber-500">
                                Outliers: {connectData.outliersBelow > 0 && `${connectData.outliersBelow} below`}
                                {connectData.outliersBelow > 0 && connectData.outliersAbove > 0 && ' • '}
                                {connectData.outliersAbove > 0 && `${connectData.outliersAbove} above`}
                            </div>
                        )}
                    </div>
                </div>

                {/* Disconnect Statistics */}
                <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <Battery className="h-4 w-4" style={{ color: disconnectColor }} />
                        Disconnect Level Statistics
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Min:</span> <strong>{disconnectData.whiskerLow.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Q1:</span> <strong>{disconnectData.q1.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Median:</span> <strong className="text-foreground">{disconnectData.median.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Q3:</span> <strong>{disconnectData.q3.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Max:</span> <strong>{disconnectData.whiskerHigh.toFixed(1)}%</strong></div>
                        <div><span className="text-muted-foreground">Mean:</span> <strong>{disconnectData.mean.toFixed(1)}%</strong></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Sample size:</span> <strong>{disconnectData.count.toLocaleString()}</strong></div>
                        {(disconnectData.outliersBelow > 0 || disconnectData.outliersAbove > 0) && (
                            <div className="col-span-2 text-amber-500">
                                Outliers: {disconnectData.outliersBelow > 0 && `${disconnectData.outliersBelow} below`}
                                {disconnectData.outliersBelow > 0 && disconnectData.outliersAbove > 0 && ' • '}
                                {disconnectData.outliersAbove > 0 && `${disconnectData.outliersAbove} above`}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 border-2 border-current" />
                    <span>Box (Q1-Q3)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-px w-6 bg-current" style={{ height: 3 }} />
                    <span>Median (solid)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-px w-6 border-t-2 border-dashed border-current" />
                    <span>Mean (dashed)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-px w-6 bg-current" />
                    <span>Whiskers (min/max)</span>
                </div>
            </div>
        </div>
    )
}

// ──────────────────────────────────────────────────────────────────
//  Reusable SVG box-plot renderer (for Duration & Charge Gained)
// ──────────────────────────────────────────────────────────────────

function BoxPlotChart({
    data, label, unit = '', color = 'var(--chart-1)', domainMax,
}: {
    data: BoxPlotData; label: string; unit?: string; color?: string; domainMax?: number;
}) {
    const { whiskerLow, q1, median, q3, whiskerHigh, mean, outliersBelow, outliersAbove, count } = data
    const max = domainMax ?? Math.ceil(whiskerHigh * 1.1)
    const min = 0

    const scale = (v: number) => ((v - min) / (max - min)) * 100

    return (
        <div className="space-y-2">
            <div className="text-sm font-medium">{label}</div>
            <svg viewBox="0 0 400 80" className="w-full" style={{ maxHeight: 80 }}>
                {/* Whisker line */}
                <line
                    x1={scale(whiskerLow) * 3.6 + 20} y1={40}
                    x2={scale(whiskerHigh) * 3.6 + 20} y2={40}
                    stroke={color} strokeWidth={1.5}
                />
                {/* Whisker caps */}
                <line x1={scale(whiskerLow) * 3.6 + 20} y1={30} x2={scale(whiskerLow) * 3.6 + 20} y2={50} stroke={color} strokeWidth={1.5} />
                <line x1={scale(whiskerHigh) * 3.6 + 20} y1={30} x2={scale(whiskerHigh) * 3.6 + 20} y2={50} stroke={color} strokeWidth={1.5} />
                {/* Box (Q1 to Q3) */}
                <rect
                    x={scale(q1) * 3.6 + 20} y={22}
                    width={(scale(q3) - scale(q1)) * 3.6}
                    height={36}
                    fill={color} fillOpacity={0.2}
                    stroke={color} strokeWidth={1.5}
                    rx={3}
                />
                {/* Median line */}
                <line
                    x1={scale(median) * 3.6 + 20} y1={20}
                    x2={scale(median) * 3.6 + 20} y2={60}
                    stroke={color} strokeWidth={2.5}
                />
                {/* Mean diamond */}
                <polygon
                    points={`${scale(mean) * 3.6 + 20},32 ${scale(mean) * 3.6 + 24},40 ${scale(mean) * 3.6 + 20},48 ${scale(mean) * 3.6 + 16},40`}
                    fill="white" stroke={color} strokeWidth={1}
                />
            </svg>
            {/* Labels */}
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
//  Clean Data Analysis Tab
// ──────────────────────────────────────────────────────────────────

export function CleanDataTab() {
    const { data, isLoading, isError, error } = useCleanDataAnalysis()

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}
                </div>
            </div>
        )
    }

    if (isError || !data) {
        const errMsg = error instanceof Error ? error.message : 'Failed to load clean data'
        return (
            <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                    <div className="text-center space-y-1">
                        <h3 className="font-semibold text-destructive">Could not load Clean Data</h3>
                        <p className="text-sm text-muted-foreground max-w-md">{errMsg}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                            The charging API may be unavailable or the clean-analysis endpoint may not be deployed yet.
                            Check that the backend at battery-analytics-api.onrender.com is running.
                        </p>
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
                <div className="rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500">
                    Clean data — mismatch ≤ 10 • ≥ 8 observation days • {n(s.total_users)} users
                </div>
            </div>

            {/* KPI summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">{n(s.total_users)}</div>
                        <p className="text-xs text-muted-foreground">{n(s.total_sessions).toLocaleString()} sessions ({n(s.complete_sessions).toLocaleString()} complete)</p>
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
                        <p className="text-xs text-muted-foreground">Median: {n(s.median_charge_gained).toFixed(1)}% • σ: {n(s.stddev_charge_gained).toFixed(1)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Levels</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{n(s.avg_connect_level).toFixed(0)}% → {n(s.avg_disconnect_level).toFixed(0)}%</div>
                        <p className="text-xs text-muted-foreground">Connect → Disconnect</p>
                    </CardContent>
                </Card>
            </div>

            {/* Combined Battery Level Box Plot */}
            <Card>
                <CardHeader>
                    <CardDescription>Comparison of battery levels when users plug in vs unplug their phones</CardDescription>
                </CardHeader>
                <CardContent>
                    <CombinedBatteryLevelBoxPlot
                        connectData={data.boxPlots.connectLevel}
                        disconnectData={data.boxPlots.disconnectLevel}
                    />
                </CardContent>
            </Card>

            {/* Remaining Box Plots (Duration & Charge Gained) */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            Charging Duration
                        </CardTitle>
                        <CardDescription>How long users leave their phone charging (minutes)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BoxPlotChart data={data.boxPlots.duration} label="Duration (min)" unit=" min" color="#3b82f6" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-500" />
                            Charge Gained
                        </CardTitle>
                        <CardDescription>How much battery % is gained per session</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BoxPlotChart data={data.boxPlots.chargeGained} label="Charge Gained (%)" unit="%" color="#a855f7" domainMax={100} />
                    </CardContent>
                </Card>
            </div>

            {/* Histograms */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Duration Distribution</CardTitle>
                        <CardDescription>How long charging sessions last (clean users only)</CardDescription>
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
                        <CardTitle>Charge Gained Distribution</CardTitle>
                        <CardDescription>How much battery is typically gained (clean users only)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={data.histograms.chargeGained}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Bar dataKey="count" name="Sessions" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Connect Level Histogram */}
            <Card>
                <CardHeader>
                    <CardTitle>Connect Battery Level Distribution</CardTitle>
                    <CardDescription>Battery level when users decided to charge (clean users, 10% buckets)</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data.histograms.connectLevel}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="level_bucket" className="text-xs" tickFormatter={(v) => `${v}%`} />
                            <YAxis className="text-xs" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                labelFormatter={(v) => `${v}% – ${Number(v) + 9}%`}
                            />
                            <Bar dataKey="count" name="Sessions" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Scatter Plots */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Start Level vs Charge Gained
                        </CardTitle>
                        <CardDescription>
                            Lower start level → more charge gained (each dot = one session)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis
                                    dataKey="start_percentage" type="number" name="Start Level"
                                    domain={[0, 100]} className="text-xs"
                                    label={{ value: 'Start Level (%)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }}
                                />
                                <YAxis
                                    dataKey="charge_gained" type="number" name="Charge Gained"
                                    className="text-xs"
                                    label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }}
                                />
                                <ZAxis range={[15, 15]} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    formatter={(v: number | undefined, name: string | undefined) => [
                                        name === 'Start Level' ? `${v ?? 0}%` : name === 'Charge Gained' ? `${v ?? 0}%` : `${Number(v ?? 0).toFixed(0)} min`,
                                        name,
                                    ]}
                                />
                                <Scatter
                                    data={data.scatterPlots.startVsCharge.map(d => ({
                                        start_percentage: n(d.start_percentage),
                                        charge_gained: n(d.charge_gained),
                                        duration_minutes: n(d.duration_minutes),
                                    }))}
                                    fill="#22c55e" fillOpacity={0.4}
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Duration vs Charge Gained
                        </CardTitle>
                        <CardDescription>
                            Longer sessions → more charge gained (each dot = one session)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis
                                    dataKey="duration_minutes" type="number" name="Duration"
                                    className="text-xs"
                                    label={{ value: 'Duration (min)', position: 'insideBottom', offset: -5, className: 'text-xs fill-muted-foreground' }}
                                />
                                <YAxis
                                    dataKey="charge_gained" type="number" name="Charge Gained"
                                    className="text-xs"
                                    label={{ value: 'Charge Gained (%)', angle: -90, position: 'insideLeft', className: 'text-xs fill-muted-foreground' }}
                                />
                                <ZAxis range={[15, 15]} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    formatter={(v: number | undefined, name: string | undefined) => [
                                        name === 'Duration' ? `${Number(v ?? 0).toFixed(0)} min` : `${v ?? 0}%`,
                                        name,
                                    ]}
                                />
                                <Scatter
                                    data={data.scatterPlots.durationVsCharge.map(d => ({
                                        duration_minutes: n(d.duration_minutes),
                                        charge_gained: n(d.charge_gained),
                                        start_percentage: n(d.start_percentage),
                                    }))}
                                    fill="#f59e0b" fillOpacity={0.4}
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
