import { useState } from 'react'
import {
    Battery, Clock, Users, AlertTriangle, TrendingUp, Zap,
    ChevronUp, ChevronDown, ArrowUpDown,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import {
    useChargingStats,
    useChargingUsers,
    useChargingTimePatterns,
    useChargingDurationDist,
    useChargingLevelDist,
    useChargingAnomalousUsers,
    useChargingAnomalyImpact,
    useChargingChargeGainedDist,
    useChargingDailySessions,
} from '@/hooks/useChargingData'
import { ComparisonTab } from './ComparisonTab'
import { DeepAnalysisTab } from './DeepAnalysisTab'

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'patterns', label: 'Time Patterns' },
    { id: 'users', label: 'User Behavior' },
    { id: 'anomalies', label: 'Anomalies' },
    { id: 'comparison', label: 'Comparison' },
    { id: 'deep', label: 'Deep Analysis' },
]


const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function ChargingDataDashboard() {
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Battery Charging Data</h2>
                <p className="text-muted-foreground">
                    Analysis of collaborator-provided battery charging events • Separate database
                </p>
            </div>
            <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'sessions' && <SessionsTab />}
            {activeTab === 'patterns' && <PatternsTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'anomalies' && <AnomaliesTab />}
            {activeTab === 'comparison' && <ComparisonTab />}
            {activeTab === 'deep' && <DeepAnalysisTab />}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab() {
    const { data: stats, isLoading: statsLoading } = useChargingStats()
    const { data: dailySessions } = useChargingDailySessions()
    const { data: durationDist } = useChargingDurationDist()
    const { data: levelDist } = useChargingLevelDist()

    if (statsLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Number(stats?.total_users ?? 0)}</div>
                        <p className="text-xs text-muted-foreground">
                            {Number(stats?.anomalous_users ?? 0)} anomalous
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Number(stats?.total_events ?? 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            {Number(stats?.total_sessions ?? 0).toLocaleString()} sessions ({Number(stats?.complete_sessions ?? 0).toLocaleString()} complete)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Number(stats?.avg_duration_minutes ?? 0).toFixed(0)} min</div>
                        <p className="text-xs text-muted-foreground">
                            Per complete session
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Charge Gained</CardTitle>
                        <Battery className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Number(stats?.avg_charge_gained ?? 0).toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            Connect avg: {Number(stats?.avg_connect_level ?? 0).toFixed(0)}% → Disconnect: {Number(stats?.avg_disconnect_level ?? 0).toFixed(0)}%
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Daily sessions timeline */}
            {dailySessions && dailySessions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Charging Activity</CardTitle>
                        <CardDescription>Sessions and active users per day</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={dailySessions}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="session_count" name="Sessions" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.2} />
                                <Area type="monotone" dataKey="active_users" name="Active Users" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Duration distribution */}
                {durationDist && durationDist.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Session Duration Distribution</CardTitle>
                            <CardDescription>How long users typically charge</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={durationDist}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Bar dataKey="count" name="Sessions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Battery level at connect vs disconnect */}
                {levelDist && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Battery Level at Connect vs Disconnect</CardTitle>
                            <CardDescription>Where users plug in and unplug</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={mergeLevelDist(levelDist)}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="level" className="text-xs" tickFormatter={(v) => `${v}%`} />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Legend />
                                    <Bar dataKey="connect" name="Connect" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="disconnect" name="Disconnect" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSIONS TAB
// ═══════════════════════════════════════════════════════════════════════════

function SessionsTab() {
    const { data: durationDist } = useChargingDurationDist()
    const { data: chargeGainedDist } = useChargingChargeGainedDist()
    const { data: levelDist } = useChargingLevelDist()

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
                {durationDist && durationDist.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Duration Distribution</CardTitle>
                            <CardDescription>Session length breakdown with average charge gained</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={durationDist}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Bar dataKey="count" name="Sessions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {chargeGainedDist && chargeGainedDist.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Charge Gained Distribution</CardTitle>
                            <CardDescription>How much battery is typically gained per session</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chargeGainedDist}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="bucket" className="text-xs" angle={-20} textAnchor="end" height={50} />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Bar dataKey="count" name="Sessions" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>

            {levelDist && (
                <Card>
                    <CardHeader>
                        <CardTitle>Connect vs Disconnect Battery Levels</CardTitle>
                        <CardDescription>Connect levels show when users decide to charge; disconnect levels show when they decide to stop</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={mergeLevelDist(levelDist)}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="level" className="text-xs" tickFormatter={(v) => `${v}%`} />
                                <YAxis className="text-xs" />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Legend />
                                <Bar dataKey="connect" name="Plug In" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="disconnect" name="Unplug" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME PATTERNS TAB
// ═══════════════════════════════════════════════════════════════════════════

function PatternsTab() {
    const { data: patterns, isLoading } = useChargingTimePatterns()

    if (isLoading) {
        return <Skeleton className="h-[500px]" />
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Hourly pattern */}
                {patterns?.hourly && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Charging by Hour of Day</CardTitle>
                            <CardDescription>When do users plug in their phones?</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={patterns.hourly}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} />
                                    <YAxis className="text-xs" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        labelFormatter={(v) => `${v}:00 - ${v}:59`}
                                    />
                                    <Bar dataKey="session_count" name="Sessions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Day of week */}
                {patterns?.daily && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Charging by Day of Week</CardTitle>
                            <CardDescription>Weekend vs weekday charging behavior</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={patterns.daily.map(d => ({ ...d, day: DAY_NAMES[Number(d.day_of_week)] }))}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="day" className="text-xs" />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Bar dataKey="session_count" name="Sessions" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Avg start level by hour */}
            {patterns?.hourly && (
                <Card>
                    <CardHeader>
                        <CardTitle>Average Battery Level at Charge Start by Hour</CardTitle>
                        <CardDescription>Lower values = users wait until battery is very low before charging</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={patterns.hourly}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="hour" className="text-xs" tickFormatter={(v) => `${v}:00`} />
                                <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    labelFormatter={(v) => `${v}:00`}
                                    formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}%`, 'Avg Start Level']}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="avg_start_level" name="Avg Start Level" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="avg_charge_gained" name="Avg Charge Gained" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Heatmap */}
            {patterns?.heatmap && patterns.heatmap.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Charging Heatmap</CardTitle>
                        <CardDescription>Day of week × hour of day • Darker = more sessions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <HeatmapGrid data={patterns.heatmap} />
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════════════════════════════════════════

type UserSortField = 'user_id' | 'total_events' | 'total_sessions' | 'avg_duration' | 'avg_charge' | 'mismatch'
type SortDirection = 'asc' | 'desc'

function UsersTab() {
    const [sortField, setSortField] = useState<UserSortField>('total_sessions')
    const [sortDir, setSortDir] = useState<SortDirection>('desc')
    const { data: users, isLoading } = useChargingUsers(sortField, sortDir)

    const handleSort = (field: UserSortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('desc')
        }
    }

    const SortIcon = ({ field }: { field: UserSortField }) => {
        if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
        return sortDir === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
    }

    if (isLoading) return <Skeleton className="h-[600px]" />

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>User Behavior Summary</CardTitle>
                    <CardDescription>Click column headers to sort • {users?.length ?? 0} users</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card z-10">
                                <tr className="border-b">
                                    <th className="cursor-pointer px-3 py-3 text-left font-medium hover:bg-muted/50" onClick={() => handleSort('user_id')}>
                                        <span className="flex items-center">User <SortIcon field="user_id" /></span>
                                    </th>
                                    <th className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50" onClick={() => handleSort('total_events')}>
                                        <span className="flex items-center justify-end">Events <SortIcon field="total_events" /></span>
                                    </th>
                                    <th className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50" onClick={() => handleSort('total_sessions')}>
                                        <span className="flex items-center justify-end">Sessions <SortIcon field="total_sessions" /></span>
                                    </th>
                                    <th className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50" onClick={() => handleSort('avg_duration')}>
                                        <span className="flex items-center justify-end">Avg Duration <SortIcon field="avg_duration" /></span>
                                    </th>
                                    <th className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50" onClick={() => handleSort('avg_charge')}>
                                        <span className="flex items-center justify-end">Avg Charge <SortIcon field="avg_charge" /></span>
                                    </th>
                                    <th className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50" onClick={() => handleSort('mismatch')}>
                                        <span className="flex items-center justify-end">Mismatch <SortIcon field="mismatch" /></span>
                                    </th>
                                    <th className="px-3 py-3 text-right font-medium">Status</th>
                                    <th className="px-3 py-3 text-right font-medium">Period</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users?.map((user, idx) => (
                                    <tr key={user.user_id} className={`border-b transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                                        <td className="px-3 py-2 font-medium">User {user.user_id}</td>
                                        <td className="px-3 py-2 text-right">{Number(user.total_events)}</td>
                                        <td className="px-3 py-2 text-right">{Number(user.total_sessions)} <span className="text-xs text-muted-foreground">({Number(user.complete_sessions)} ✓)</span></td>
                                        <td className="px-3 py-2 text-right">{user.avg_duration_minutes ? `${Number(user.avg_duration_minutes).toFixed(0)} min` : '—'}</td>
                                        <td className="px-3 py-2 text-right">{user.avg_charge_gained ? `${Number(user.avg_charge_gained).toFixed(1)}%` : '—'}</td>
                                        <td className="px-3 py-2 text-right">
                                            <span className={Number(user.event_mismatch) > 1 ? 'text-red-500 font-semibold' : ''}>
                                                {Number(user.event_mismatch)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {user.is_anomalous
                                                ? <span className="inline-flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="h-3 w-3" /> Anomalous</span>
                                                : <span className="text-xs text-green-600">Clean</span>
                                            }
                                        </td>
                                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                                            {new Date(user.first_event).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            {' - '}
                                            {new Date(user.last_event).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// ANOMALIES TAB
// ═══════════════════════════════════════════════════════════════════════════

function AnomaliesTab() {
    const { data: anomalousUsers, isLoading: usersLoading } = useChargingAnomalousUsers()
    const { data: impact, isLoading: impactLoading } = useChargingAnomalyImpact()

    if (usersLoading || impactLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32" />
                <Skeleton className="h-[400px]" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Impact summary */}
            {impact && (
                <>
                    <Card className="border-red-500/30 bg-red-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                94-User Anomaly — Impact Analysis
                            </CardTitle>
                            <CardDescription>
                                Users where |connected_count − disconnected_count| &gt; 1
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm text-muted-foreground">% of Users</div>
                                    <div className="text-2xl font-bold text-red-500">{Number(impact.pct_users).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">{Number(impact.anomalous_users)} of {Number(impact.total_users)}</div>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm text-muted-foreground">% of Events</div>
                                    <div className="text-2xl font-bold text-red-500">{Number(impact.pct_events).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">{Number(impact.anomalous_events).toLocaleString()} of {Number(impact.total_events).toLocaleString()}</div>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm text-muted-foreground">% of Sessions</div>
                                    <div className="text-2xl font-bold text-red-500">{Number(impact.pct_sessions).toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">{Number(impact.anomalous_sessions).toLocaleString()} of {Number(impact.total_sessions).toLocaleString()}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Comparison table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Before vs After Removal — Comparison</CardTitle>
                            <CardDescription>How metrics change if anomalous users are excluded</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">Metric</th>
                                            <th className="px-4 py-3 text-right font-medium">All Users</th>
                                            <th className="px-4 py-3 text-right font-medium text-red-500">Anomalous (94)</th>
                                            <th className="px-4 py-3 text-right font-medium text-green-600">Clean ({Number(impact.clean_users)})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b hover:bg-muted/50">
                                            <td className="px-4 py-2">Users</td>
                                            <td className="px-4 py-2 text-right">{Number(impact.total_users)}</td>
                                            <td className="px-4 py-2 text-right text-red-500">{Number(impact.anomalous_users)}</td>
                                            <td className="px-4 py-2 text-right text-green-600">{Number(impact.clean_users)}</td>
                                        </tr>
                                        <tr className="border-b hover:bg-muted/50 bg-muted/20">
                                            <td className="px-4 py-2">Events</td>
                                            <td className="px-4 py-2 text-right">{Number(impact.total_events).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right text-red-500">{Number(impact.anomalous_events).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right text-green-600">{Number(impact.clean_events).toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b hover:bg-muted/50">
                                            <td className="px-4 py-2">Sessions</td>
                                            <td className="px-4 py-2 text-right">{Number(impact.total_sessions).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right text-red-500">{Number(impact.anomalous_sessions).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right text-green-600">{Number(impact.clean_sessions).toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-b hover:bg-muted/50 bg-muted/20">
                                            <td className="px-4 py-2">Avg Duration (min)</td>
                                            <td className="px-4 py-2 text-right">{Number(impact.avg_duration).toFixed(1)}</td>
                                            <td className="px-4 py-2 text-right text-red-500">{Number(impact.anomalous_avg_duration).toFixed(1)}</td>
                                            <td className="px-4 py-2 text-right text-green-600">{Number(impact.clean_avg_duration).toFixed(1)}</td>
                                        </tr>
                                        <tr className="border-b hover:bg-muted/50">
                                            <td className="px-4 py-2">Avg Charge Gained (%)</td>
                                            <td className="px-4 py-2 text-right">{Number(impact.avg_charge).toFixed(1)}</td>
                                            <td className="px-4 py-2 text-right text-red-500">{Number(impact.anomalous_avg_charge).toFixed(1)}</td>
                                            <td className="px-4 py-2 text-right text-green-600">{Number(impact.clean_avg_charge).toFixed(1)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recommendation */}
                    <Card className="border-amber-500/30 bg-amber-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-amber-600" />
                                Recommendation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <p><strong>Do NOT outright remove</strong> these 94 users. They represent {Number(impact.pct_events).toFixed(1)}% of events — removing them loses significant data.</p>
                            <p><strong>Better approach — Flag &amp; Filter:</strong></p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>The <code className="rounded bg-muted px-1">is_anomalous</code> flag is already in the database</li>
                                <li>For session-based analysis, use only <strong>complete sessions</strong> (paired connect→disconnect)</li>
                                <li>For per-user statistics, the mismatch mostly affects session <em>counts</em>, not session <em>quality</em></li>
                                <li>Run any critical analysis both with and without these users to check if results change materially</li>
                            </ul>
                            <p className="text-muted-foreground">If avg duration or avg charge differ significantly between groups, consider capping the mismatch users' incomplete sessions rather than removing all their data.</p>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Anomalous users table */}
            <Card>
                <CardHeader>
                    <CardTitle>Anomalous Users ({anomalousUsers?.length ?? 0})</CardTitle>
                    <CardDescription>Sorted by event mismatch (highest first)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card z-10">
                                <tr className="border-b">
                                    <th className="px-3 py-2 text-left font-medium">User</th>
                                    <th className="px-3 py-2 text-right font-medium">Connected</th>
                                    <th className="px-3 py-2 text-right font-medium">Disconnected</th>
                                    <th className="px-3 py-2 text-right font-medium">Mismatch</th>
                                    <th className="px-3 py-2 text-right font-medium">Sessions</th>
                                    <th className="px-3 py-2 text-right font-medium">Avg Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {anomalousUsers?.map((u, idx) => (
                                    <tr key={u.user_id} className={`border-b hover:bg-muted/50 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                                        <td className="px-3 py-2 font-medium">User {u.user_id}</td>
                                        <td className="px-3 py-2 text-right">{Number(u.connect_count)}</td>
                                        <td className="px-3 py-2 text-right">{Number(u.disconnect_count)}</td>
                                        <td className="px-3 py-2 text-right font-bold text-red-500">{Number(u.event_mismatch)}</td>
                                        <td className="px-3 py-2 text-right">{Number(u.total_sessions)}</td>
                                        <td className="px-3 py-2 text-right">{u.avg_duration_minutes ? `${Number(u.avg_duration_minutes).toFixed(0)} min` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function mergeLevelDist(levelDist: { connect: { level_bucket: number; count: number }[], disconnect: { level_bucket: number; count: number }[] }) {
    const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const connectMap = new Map(levelDist.connect.map(d => [Number(d.level_bucket), Number(d.count)]))
    const disconnectMap = new Map(levelDist.disconnect.map(d => [Number(d.level_bucket), Number(d.count)]))
    return buckets.map(b => ({
        level: b,
        connect: connectMap.get(b) || 0,
        disconnect: disconnectMap.get(b) || 0,
    }))
}

function HeatmapGrid({ data }: { data: { day_of_week: number; hour: number; session_count: number }[] }) {
    const maxCount = Math.max(...data.map(d => Number(d.session_count)))
    const grid = new Map<string, number>()
    data.forEach(d => grid.set(`${d.day_of_week}-${d.hour}`, Number(d.session_count)))

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[600px]">
                <div className="flex gap-0.5">
                    <div className="w-12" />
                    {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">{h}</div>
                    ))}
                </div>
                {DAY_NAMES.map((day, dayIdx) => (
                    <div key={dayIdx} className="flex gap-0.5 mt-0.5">
                        <div className="w-12 text-xs text-muted-foreground flex items-center">{day}</div>
                        {Array.from({ length: 24 }).map((_, h) => {
                            const count = grid.get(`${dayIdx}-${h}`) || 0
                            const intensity = maxCount > 0 ? count / maxCount : 0
                            return (
                                <div
                                    key={h}
                                    className="flex-1 aspect-square rounded-sm transition-colors cursor-default"
                                    style={{
                                        backgroundColor: intensity > 0
                                            ? `oklch(0.65 0.15 145 / ${0.15 + intensity * 0.85})`
                                            : 'var(--muted)',
                                    }}
                                    title={`${day} ${h}:00 — ${count} sessions`}
                                />
                            )
                        })}
                    </div>
                ))}
                <div className="flex items-center gap-2 mt-3 justify-end text-xs text-muted-foreground">
                    <span>Less</span>
                    {[0.1, 0.3, 0.5, 0.7, 1.0].map((intensity, i) => (
                        <div
                            key={i}
                            className="w-4 h-4 rounded-sm"
                            style={{ backgroundColor: `oklch(0.65 0.15 145 / ${0.15 + intensity * 0.85})` }}
                        />
                    ))}
                    <span>More</span>
                </div>
            </div>
        </div>
    )
}
