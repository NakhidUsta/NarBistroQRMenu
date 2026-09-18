import { Link } from 'react-router-dom'

const variants = {
  primary: 'bg-btn text-cream hover:bg-burgundy-dark',
  accent: 'bg-burgundy text-cream hover:bg-burgundy-dark',
  outline: 'border-[1.5px] border-ink/70 text-ink hover:border-ink',
  ghost: 'text-ink/70 hover:text-ink',
}

function Button({ to, href, variant = 'primary', className = '', children, disabled, ...props }) {
  const classes = `inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] tracking-wide transition-all duration-150 hover:-translate-y-px disabled:opacity-40 disabled:pointer-events-none disabled:translate-y-0 ${variants[variant]} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  )
}

export default Button
