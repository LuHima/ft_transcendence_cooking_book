function Contacts() {
	return (
		<div className="mx-auto max-w-2xl px-4 py-16">
			<h1 className="font-display text-4xl text-[var(--wc-saffron)]">Contatti</h1>
			<p className="mt-4 text-[var(--wc-text-muted)]">
				Hai domande, suggerimenti o hai trovato un problema? Scrivici, ti rispondiamo il prima possibile.
			</p>

			<div className="mt-8 space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-6">
				<div>
					<dt className="text-xs uppercase tracking-wide text-[var(--wc-text-muted)]">Email</dt>
					<dd className="text-[var(--wc-text)]">supporto@wecook.example</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wide text-[var(--wc-text-muted)]">Community</dt>
					<dd className="text-[var(--wc-text)]">discord.gg/wecook</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wide text-[var(--wc-text-muted)]">Sede</dt>
					<dd className="text-[var(--wc-text)]">Bologna, Italia</dd>
				</div>
			</div>
		</div>
	)
}

export default Contacts
