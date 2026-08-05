

async function paolo() {
  const out = document.getElementById('out');
  //prende l'elemento con id out e lo mette in una variabile
  const API_BASE = 'http://localhost:3000';
//  const response = await fetch(`${API_BASE}/api/ricette`);
  const response = await fetch(`${API_BASE}/api/ricette`);
  const data = await response.json();

  out.textContent = JSON.stringify(data, null, 2);
  //out.textContent = object;
}

// fetch() è asincrono
// object non è il risultato finale
// out.textContent = object mostra solo un oggetto di tipo Promise, non i dati reali
// In poche parole
// fetch() = “avvia la richiesta”
// await = “aspetta che arrivi la risposta”
// res.json() = “trasforma la risposta in JSON”
// strinify() = “trasforma l’oggetto JSON in stringa” 

document.getElementById('load').addEventListener('click', paolo);
// addEventListener('click', load) dice: “quando clicchi il bottone, esegui la funzione load”