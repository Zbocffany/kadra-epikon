export default function Home() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">
          Kadra Polski — mecze reprezentacji
        </h1>

        <p className="mt-4 text-lg text-neutral-300">
          Prosta aplikacja do katalogowania meczów reprezentacji Polski. Dane
          dodaję ręcznie (na razie). W kolejnych krokach dojdą: lista meczów,
          filtrowanie oraz panel admina.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="text-lg font-semibold">Co już działa</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-300">
              <li>Projekt Next.js uruchamia się lokalnie</li>
              <li>Deploy na Vercel działa</li>
              <li>Repozytorium na GitHub jest skonfigurowane</li>
            </ul>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="text-lg font-semibold">Następne kroki</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-300">
              <li>Model bazy: Team i Match</li>
              <li>Widok listy meczów</li>
              <li>Formularz dodawania meczu (panel admina)</li>
            </ul>
          </div>
        </div>

        <p className="mt-10 text-sm text-neutral-400">
          Status: MVP w budowie.
        </p>
      </div>
    </main>
  );
}