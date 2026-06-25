import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/shared/primitives/Avatar'
import { Switch } from '@/shared/primitives/Switch/Switch'
import {
  ArrowRightStartOnRectangleIcon,
  PencilSquareIcon,
  // Cog6ToothIcon,
  MoonIcon,
  SunIcon,
  AdjustmentsHorizontalIcon,
  LockClosedIcon,
  // UserCircleIcon,
  // ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useTheme } from '@/shared/theme'
import { Button } from '@/shared/primitives/Button'
import { useToast } from '@/hooks/useToast'

export interface AvatarMenuProps {
  name: string

  src?: string

  onEditProfile?: () => void

  onPreferences?: () => void

  onSecurity?: () => void

  onLogout?: () => void | Promise<void | boolean>
}

export function AvatarMenu({
  name,
  src,

  onEditProfile = () => {},
  onPreferences = () => {},
  onSecurity = () => {},
  onLogout = () => {},
}: AvatarMenuProps) {
  const [open, setOpen] = useState(false)
  const { themeName, setTheme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger */}
      <Button
        onClick={() => setOpen((prev) => !prev)}
        className="m-0 cursor-pointer rounded-lg p-0 focus:outline-none"
        size="sd"
        variant={'ghost'}
      >
        <Avatar name={name} src={src} className={'rounded-md'} />
      </Button>

      {/* Dropdown */}
      {open && (
        <div className="border-border-primary bg-bg-secondary absolute right-0 z-50 mt-2 w-56 rounded-lg border p-1 shadow-md">
          {/* Header */}
          <div className="border-border-tertiary mb-1 border-b px-3 py-2">
            <div className="text-text-primary text-sm font-medium">{name}</div>

            <div className="text-text-secondary text-xs">Moderator account</div>
          </div>
          {/* Items */}
          <Button
            onClick={onEditProfile}
            className="text-text-primary hover:bg-bg-tertiary w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition"
            variant={'ghost'}
            leftIcon={<PencilSquareIcon className="h-5 w-5" />}
          >
            Edit profile
          </Button>
          <Button
            onClick={onSecurity}
            className="text-text-primary hover:bg-bg-tertiary w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition"
            variant={'ghost'}
            leftIcon={<LockClosedIcon className="h-5 w-5" />}
          >
            Security settings
          </Button>
          <div className="bg-border-tertiary my-1 h-px" />
          <Button
            onClick={onPreferences}
            className="text-text-primary hover:bg-bg-tertiary w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition"
            textAlign={'left'}
            variant={'ghost'}
            leftIcon={<AdjustmentsHorizontalIcon className="h-5 w-5" />}
          >
            Preferences
          </Button>
          <Button
            variant={'ghost'}
            type="button"
            onClick={() => {
              const newTheme = themeName === 'dark' ? 'light' : 'dark'

              setTheme(newTheme)

              toast.info(`Theme changed to ${newTheme}`)
            }}
            className="hover:bg-bg-tertiary flex w-full items-center gap-3 rounded-md px-3 py-2 transition"
          >
            <div className="text-text-primary flex items-center gap-3 text-sm">
              {themeName === 'dark' ? (
                <SunIcon className="size-4" />
              ) : (
                <MoonIcon className="size-4" />
              )}

              <span className="text-text-secondary">
                {themeName === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
            </div>

            <Switch
              size="sm"
              className="ml-auto"
              checked={themeName === 'dark'}
              onChange={() => {}}
            />
          </Button>
          <div className="bg-border-tertiary my-1 h-px" />
          <NavLink to="/login">
            <Button
              onClick={onLogout}
              className="contents-center text-text-danger hover:bg-bg-danger flex w-full cursor-pointer flex-row items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition"
              variant={'danger'}
              leftIcon={<ArrowRightStartOnRectangleIcon className="h-5 w-5" />}
            >
              <div>Logout</div>
            </Button>
          </NavLink>
        </div>
      )}
    </div>
  )
}

export default AvatarMenu
