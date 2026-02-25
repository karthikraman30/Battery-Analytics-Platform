import { createContext, useContext, useState, type ReactNode } from 'react'

type DataSource = 'grouped' | 'consolidated' | 'charging'

interface DataSourceContextType {
  dataSource: DataSource
  setDataSource: (source: DataSource) => void
}

const DataSourceContext = createContext<DataSourceContextType | undefined>(undefined)

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [dataSource, setDataSource] = useState<DataSource>('grouped')

  return (
    <DataSourceContext.Provider value={{ dataSource, setDataSource }}>
      {children}
    </DataSourceContext.Provider>
  )
}

export function useDataSource() {
  const context = useContext(DataSourceContext)
  if (context === undefined) {
    throw new Error('useDataSource must be used within a DataSourceProvider')
  }
  return context
}
