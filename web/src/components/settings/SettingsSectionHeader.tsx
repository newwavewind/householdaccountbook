import { Link } from 'react-router-dom'

type Props = {
  title: string
  description?: string
  showBack?: boolean
}

export function SettingsSectionHeader({ title, description, showBack = true }: Props) {
  return (
    <div className="mb-6">
      {showBack ? (
        <Link
          to="/settings"
          className="text-xs font-semibold text-green-accent underline-offset-2 hover:underline"
        >
          ← 설정
        </Link>
      ) : null}
      <h1
        className={`text-xl font-semibold text-starbucks-green md:text-2xl ${showBack ? 'mt-2' : ''}`}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-text-soft">{description}</p>
      ) : null}
    </div>
  )
}
