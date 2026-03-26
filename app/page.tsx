import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-6 py-10">
      <div className="absolute right-6 top-6 z-20">
        <Link
          href="/login"
          className="rounded-lg border border-neutral-700/80 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-200 backdrop-blur transition hover:border-neutral-500 hover:bg-neutral-900/80"
        >
          Zaloguj sie
        </Link>
      </div>

      <div className="pl-flag-scene">
        <div className="pl-flag" aria-label="Polish flag waving animation" role="img">
          <div className="pl-flag-half pl-flag-white" />
          <div className="pl-flag-half pl-flag-red" />
        </div>
      </div>
    </main>
  );
}