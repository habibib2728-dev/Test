type AvatarProps = {
  username: string
}

const colors = [
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-purple-500',
]

const getColorClass = (username: string) => {
  let hash = 0
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash + username.charCodeAt(i)) % colors.length
  }
  return colors[hash] ?? colors[0]
}

const Avatar = ({ username }: AvatarProps) => {
  const initial = username.slice(0, 1).toUpperCase()
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${getColorClass(
        username,
      )}`}
      title={username}
    >
      {initial}
    </div>
  )
}

export default Avatar
