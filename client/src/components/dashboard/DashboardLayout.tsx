import { useState } from 'react'
import { Battery } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { OverviewDashboard } from './OverviewDashboard'
import { DeviceDetailView } from './DeviceDetailView'
import { InsightsDashboard } from './InsightsDashboard'
import { CarbonDashboard } from './CarbonDashboard'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'device', label: 'Device Detail' },
  { id: 'insights', label: 'Insights' },
  { id: 'carbon', label: 'Carbon' },
]

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center gap-4">
            <div className="flex items-center gap-2">
              <Battery className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Battery Analytics</h1>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              Smartphone Usage & Battery Research Platform
            </div>
          </div>
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'device' && <DeviceDetailView />}
        {activeTab === 'insights' && <InsightsDashboard />}
        {activeTab === 'carbon' && <CarbonDashboard />}
      </main>

      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Battery Analytics Platform • Data from ~300 users over 7-14 days
        </div>
      </footer>
    </div>
  )
}
