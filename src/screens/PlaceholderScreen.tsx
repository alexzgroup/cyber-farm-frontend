interface Props {
  title: string
  description: string
  icon: string
}

export function PlaceholderScreen({ title, description, icon }: Props) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      color: '#8b949e',
      fontFamily: 'monospace',
    }}>
      <span style={{ fontSize: 56 }}>{icon}</span>
      <h2 style={{ color: '#c9d1d9', fontSize: 20 }}>{title}</h2>
      <p style={{ fontSize: 14, opacity: 0.7 }}>{description}</p>
    </div>
  )
}
