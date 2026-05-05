type FakeTextBlockProps = {
  lineWidths: number[]
}

export function FakeTextBlock({ lineWidths }: FakeTextBlockProps) {
  return (
    <div className="space-y-2.5">
      {lineWidths.map((width, index) => (
        <div
          key={`${width}-${index}`}
          className="h-2.5 rounded-full bg-[linear-gradient(90deg,rgba(148,163,184,0.34),rgba(226,232,240,0.88))]"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  )
}
