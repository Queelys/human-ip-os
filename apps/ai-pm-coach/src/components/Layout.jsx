import { Link } from 'react-router'

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export default function Layout({ children, footer }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Link
          to="/"
          className={`rounded-sm text-[15px] font-semibold tracking-tight text-ink ${focusRing}`}
        >
          AI PM Coach
        </Link>
      </header>
      <main className="flex flex-1 flex-col px-5 sm:px-8">{children}</main>
      {footer && <footer className="px-5 pb-6 pt-8 text-center sm:px-8">{footer}</footer>}
    </div>
  )
}
