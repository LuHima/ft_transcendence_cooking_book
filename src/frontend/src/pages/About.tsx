function About() {
	return (
		<div className="mx-auto max-w-2xl px-4 py-16">
			<h1 className="font-display text-4xl text-[var(--wc-saffron)]">Chi siamo</h1>
			<p className="mt-4 text-[var(--wc-text-muted)]">
				WeCook nasce dall'idea di raccogliere in un unico posto le ricette di tutti i giorni: quelle di famiglia,
				quelle improvvisate e quelle scoperte per caso. Qui puoi salvare le tue ricette, organizzare la
				settimana con il meal plan e tenere traccia di quelle che ti sono piaciute di più.
			</p>
			<p className="mt-4 text-[var(--wc-text-muted)]">
				Il progetto è sviluppato come esercizio didattico: il codice del frontend e del backend sono gestiti
				separatamente dal team.
			</p>
		</div>
	)
}

export default About
