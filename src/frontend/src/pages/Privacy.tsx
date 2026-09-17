function Privacy() {
	return (
		<div className="mx-auto max-w-2xl px-4 py-16">
			<h1 className="font-display text-4xl text-[var(--wc-saffron)]">Privacy</h1>
			<div className="mt-6 space-y-6 text-[var(--wc-text-muted)]">
				<section>
					<h2 className="mb-1 text-lg font-semibold text-[var(--wc-text)]">Dati raccolti</h2>
					<p>
						Per creare un account raccogliamo username, email e password (salvata in forma cifrata). I dati
						anagrafici (nome, cognome, indirizzo, telefono) sono facoltativi e servono solo a personalizzare il
						tuo profilo.
					</p>
				</section>
				<section>
					<h2 className="mb-1 text-lg font-semibold text-[var(--wc-text)]">Uso dei dati</h2>
					<p>
						Le ricette, i preferiti e i meal plan che crei sono visibili solo a te, salvo le ricette che scegli
						di rendere pubbliche.
					</p>
				</section>
				<section>
					<h2 className="mb-1 text-lg font-semibold text-[var(--wc-text)]">I tuoi diritti</h2>
					<p>
						Puoi in qualsiasi momento aggiornare i tuoi dati dalla pagina Profilo o richiedere la cancellazione
						dell'account scrivendo a wecook.support@gmail.com
					</p>
				</section>
			</div>
		</div>
	)
}

export default Privacy
