export function setCookie(name: string, value: string, time: number, path?: string): void {
  const expires = new Date()
  expires.setTime(new Date().getTime() + (time || 365 * 24 * 60 * 60 * 1000))
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=${path || '/'}`
}

export function getCookie(name: string): string {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`) ?? []
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() ?? ''
  }
  else {
    return ''
  }
}
