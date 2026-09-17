const styles = {
  popular: 'bg-gold text-ink',
  unavailable: 'bg-ink/80 text-cream',
  info: 'bg-burgundy/10 text-burgundy',
}

function Badge({ variant = 'info', children }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${styles[variant]}`}>
      {children}
    </span>
  )
}

export default Badge
