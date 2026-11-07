export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-3xl font-extrabold text-balance sm:text-4xl" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-pretty" style={{ color: 'var(--text-2)' }}>
        {subtitle}
      </p>
    </div>
  )
}
