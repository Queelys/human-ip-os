import { Link } from 'react-router'
import { focusRing } from './Layout.jsx'

const base =
  'inline-flex items-center justify-center rounded-lg bg-primary font-semibold text-white ' +
  'transition-colors duration-150 hover:bg-primary-hover active:translate-y-px ' +
  focusRing

const sizes = {
  md: 'h-11 px-6 text-[15px]',
  lg: 'h-13 px-8 text-base',
}

// 页面跳转用 Link 渲染，语义上是导航；以后需要提交等行为时再传 onClick 渲染 <button>
export default function Button({ to, size = 'md', className = '', children, ...rest }) {
  const classes = `${base} ${sizes[size]} ${className}`
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  )
}
