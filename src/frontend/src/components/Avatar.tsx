interface AvatarProps {
	username: string
	url?: string | null
	className?: string
}

// avatar tondo: immagine se presente, altrimenti iniziale dello username
function Avatar({ username, url, className = 'h-8 w-8 text-sm' }: AvatarProps) {
	if (url) {
		return <img src={url} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
	}
	return (
		<span
			className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[var(--wc-basil)] font-semibold text-[var(--wc-bg)]`}
		>
			{username.charAt(0).toUpperCase()}
		</span>
	)
}

export default Avatar
