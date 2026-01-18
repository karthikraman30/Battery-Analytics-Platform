import { DashboardLayout } from '@/components/dashboard'
import { DataSourceProvider } from '@/contexts/DataSourceContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <DataSourceProvider>
        <DashboardLayout />
      </DataSourceProvider>
    </ThemeProvider>
  )
}

export default App
