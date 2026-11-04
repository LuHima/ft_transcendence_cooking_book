import { useTranslation } from 'react-i18next'

// pallino verde = online, rosso = offline
function OnlineDot({ online }: { online: boolean }) {
	const { t } = useTranslation()
	const label = online ? t('friends.online') : t('friends.offline')
	return (
		<span
			role="img"
			aria-label={label}
			title={label}
			className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
		/>
	)
}

export default OnlineDot
