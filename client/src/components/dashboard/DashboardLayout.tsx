import { useState } from 'react'
import { Battery, Sun, Moon } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { OverviewDashboard } from './OverviewDashboard'
import { DeviceDetailView } from './DeviceDetailView'
import { InsightsDashboard } from './InsightsDashboard'
import { CarbonDashboard } from './CarbonDashboard'
import { GroupAnalyticsDashboard } from './GroupAnalyticsDashboard'
import { GroupCarbonDashboard } from './GroupCarbonDashboard'
import { ChargingDataDashboard } from './ChargingDataDashboard'
import { useDataSource } from '@/contexts/DataSourceContext'
import { useTheme } from '@/contexts/ThemeContext'

const CONSOLIDATED_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'device', label: 'Device Detail' },
  { id: 'insights', label: 'Insights' },
  { id: 'carbon', label: 'Carbon' },
]

const GROUPED_TABS = [
  { id: 'groups', label: 'Group Analysis' },
  { id: 'carbon', label: 'Carbon Footprint' },
  { id: 'insights', label: 'Insights' },
]

export function DashboardLayout() {
  const [consolidatedTab, setConsolidatedTab] = useState('overview')
  const [groupedTab, setGroupedTab] = useState('groups')
  const { dataSource, setDataSource } = useDataSource()
  const { theme, toggleTheme } = useTheme()

  const isGrouped = dataSource === 'grouped'
  const isCharging = dataSource === 'charging'
  const tabs = isGrouped ? GROUPED_TABS : CONSOLIDATED_TABS
  const activeTab = isGrouped ? groupedTab : consolidatedTab
  const setActiveTab = isGrouped ? setGroupedTab : setConsolidatedTab

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center gap-4">
            <div className="flex items-center gap-2">
              <Battery className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Battery Analytics</h1>
            </div>
            <div className="ml-4 flex items-center rounded-lg border bg-muted p-0.5">
              <button
                onClick={() => setDataSource('grouped')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dataSource === 'grouped'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Group Analysis
              </button>
              <button
                onClick={() => setDataSource('consolidated')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dataSource === 'consolidated'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Individual Analysis
              </button>
              <button
                onClick={() => setDataSource('charging')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dataSource === 'charging'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Battery Data
              </button>
            </div>
            <button
              onClick={toggleTheme}
              className="ml-4 flex items-center justify-center rounded-md border bg-muted p-2 hover:bg-muted/80 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <div className="ml-auto text-sm text-muted-foreground">
              {isCharging ? '272 Users • Battery Charging Events' : isGrouped ? '35 Research Groups • Comparative Analysis' : 'Individual User Analysis'}
            </div>
          </div>
          {!isCharging && (
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isCharging ? (
          <ChargingDataDashboard />
        ) : isGrouped ? (
          <>
            {groupedTab === 'groups' && <GroupAnalyticsDashboard />}
            {groupedTab === 'carbon' && <GroupCarbonDashboard />}
            {groupedTab === 'insights' && <InsightsDashboard />}
          </>
        ) : (
          <>
            {consolidatedTab === 'overview' && <OverviewDashboard />}
            {consolidatedTab === 'device' && <DeviceDetailView />}
            {consolidatedTab === 'insights' && <InsightsDashboard />}
            {consolidatedTab === 'carbon' && <CarbonDashboard />}
          </>
        )}
      </main>

      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Battery Analytics Platform • {isCharging ? '272 Users • Charging Events' : isGrouped ? '35 Research Groups' : '~300 Users'} • {isCharging ? 'Oct-Nov 2025' : '7-14 Days Data Collection'}
        </div>
      </footer>
    </div>
  )
}

