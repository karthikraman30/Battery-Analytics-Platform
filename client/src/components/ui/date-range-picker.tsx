export interface DateRange {
  startDate: string | null
  endDate: string | null
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  minDate?: string
  maxDate?: string
  className?: string
}

export function DateRangePicker({ 
  value, 
  onChange, 
  minDate, 
  maxDate,
  className = ''
}: DateRangePickerProps) {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value || null
    onChange({
      startDate: newStart,
      endDate: value.endDate && newStart && newStart > value.endDate ? newStart : value.endDate
    })
  }

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value || null
    onChange({
      startDate: value.startDate && newEnd && newEnd < value.startDate ? newEnd : value.startDate,
      endDate: newEnd
    })
  }

  const handleClear = () => {
    onChange({ startDate: null, endDate: null })
  }

  const hasRange = value.startDate || value.endDate

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
        <input
          type="date"
          value={value.startDate || ''}
          onChange={handleStartChange}
          min={minDate}
          max={value.endDate || maxDate}
          className="bg-transparent text-sm outline-none w-28"
          aria-label="Start date"
        />
        <span className="text-muted-foreground">-</span>
        <input
          type="date"
          value={value.endDate || ''}
          onChange={handleEndChange}
          min={value.startDate || minDate}
          max={maxDate}
          className="bg-transparent text-sm outline-none w-28"
          aria-label="End date"
        />
      </div>
      {hasRange && (
        <button
          onClick={handleClear}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Clear date range"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export function formatDateForApi(date: string | null): string | undefined {
  return date || undefined
}
