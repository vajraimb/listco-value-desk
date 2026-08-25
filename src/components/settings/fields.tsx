import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fromNumberInput,
  fromPercentInput,
  toNumberInput,
  toPercentInput,
} from '@/lib/format'

interface FieldShellProps {
  label: string
  hint?: string
  children: React.ReactNode
}

export function FieldShell({ label, hint, children }: FieldShellProps) {
  return (
    <div className="space-y-1">
      <Label className="text-[0.6875rem] font-normal text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-muted-foreground/70">{hint}</span>}
      </Label>
      {children}
    </div>
  )
}

interface TextFieldProps {
  label: string
  hint?: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

export function TextField({ label, hint, value, placeholder, onChange }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint}>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 text-[0.8125rem]"
      />
    </FieldShell>
  )
}

interface NumericFieldProps {
  label: string
  hint?: string
  value: number | null
  placeholder?: string
  /** Percent fields store decimals but are typed as 18.7 rather than 0.187. */
  percent?: boolean
  onChange: (value: number | null) => void
}

export function NumericField({
  label,
  hint,
  value,
  placeholder,
  percent = false,
  onChange,
}: NumericFieldProps) {
  const toText = percent ? toPercentInput : toNumberInput
  const fromText = percent ? fromPercentInput : fromNumberInput
  const [text, setText] = useState(() => toText(value))
  const [seen, setSeen] = useState(value)

  // Keep half-typed text intact locally, but follow imports and resets from
  // outside: only rewrite the box when the incoming value really changed.
  if (value !== seen) {
    setSeen(value)
    if (fromText(text) !== value) setText(toText(value))
  }

  return (
    <FieldShell label={label} hint={hint}>
      <Input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value)
          onChange(fromText(event.target.value))
        }}
        className="num h-8 text-[0.8125rem]"
      />
    </FieldShell>
  )
}
