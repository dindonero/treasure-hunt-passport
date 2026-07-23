import { readSnapshot } from "@/lib/report"
import { HeroBlock } from "./_components/hero-block"
import { SectionEngagement } from "./_components/section-engagement"
import { SectionKPIs } from "./_components/section-kpis"
import { SectionMerch } from "./_components/section-merch"
import { SectionTags } from "./_components/section-tags"
import { SectionVenue } from "./_components/section-venue"
import { SiteFooter } from "./_components/site-footer"
import { SiteHeader } from "./_components/site-header"

// Static-rendered. Snapshot file is checked into the repo and only
// changes when the operator runs a regen script.
export const dynamic = "force-static"
export const revalidate = 86400

export default async function ReportPage() {
  const snapshot = await readSnapshot()
  return (
    <>
      <SiteHeader />
      <main>
        <HeroBlock snapshot={snapshot} />
        <SectionKPIs snapshot={snapshot} />
        <SectionVenue snapshot={snapshot} />
        <SectionTags snapshot={snapshot} />
        <SectionMerch snapshot={snapshot} />
        <SectionEngagement snapshot={snapshot} />
      </main>
      <SiteFooter snapshot={snapshot} />
    </>
  )
}
