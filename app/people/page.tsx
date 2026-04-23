
import { getPublicPeople } from '@/lib/db/people'
import AdminListLayout from '@/components/admin/AdminListLayout'
import PeopleSearchTable from '@/app/admin/people/PeopleSearchTable'

export const revalidate = 3600

type PublicPeopleSearchTableProps = {
  people: Awaited<ReturnType<typeof getPublicPeople>>
}

function PublicPeopleSearchTable({ people }: PublicPeopleSearchTableProps) {
	return <PeopleSearchTable people={people} basePath="/people" />
}

export default async function PublicPeopleListPage() {
	const people = await getPublicPeople()
	return (
		<AdminListLayout
			title="Ludzie"
			breadcrumb="Publiczne"
			recordCount={people.length}
			recordLabel={people.length === 1 ? 'osoba' : people.length < 5 ? 'osoby' : 'osób'}
		>
			<PublicPeopleSearchTable people={people} />
		</AdminListLayout>
	)
}
