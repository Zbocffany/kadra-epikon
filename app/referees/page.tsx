import { getPublicPeople } from '@/lib/db/people'
import PublicPeopleSearchTable from '@/app/admin/people/PublicPeopleSearchTable'

export const dynamic = 'force-dynamic'

export default async function PublicRefereesPage() {
	const people = await getPublicPeople()
	const referees = people.filter((person) => person.roles.includes('REFEREE'))

	return (
		<div className="public-theme">
			<main className="min-h-screen px-4 py-10 sm:px-8">
				<div className="mx-auto max-w-[74rem]">
					<section className="relative overflow-hidden rounded-xl border border-emerald-800/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_18%,#087531_40%,#0f8a3d_58%,#0a6f31_78%,#0a5a2a_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.2),0_8px_18px_rgba(0,0,0,0.2)] sm:p-6">
						<span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_30%,rgba(0,0,0,0.12)_100%)]" />
						<div className="relative z-10">
							<PublicPeopleSearchTable
								people={referees}
								basePath="/people"
								variant="referees"
							/>
						</div>
					</section>
				</div>
			</main>
		</div>
	)
}
