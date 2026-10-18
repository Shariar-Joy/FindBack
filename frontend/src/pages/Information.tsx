import { Link } from 'react-router-dom'
import { ArrowRight, HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Empty, PageHeading } from '../components/ui'
const content: Record<
  string,
  { eyebrow: string; title: string; intro: string; sections: { title: string; text: string }[] }
> = {
  about: {
    eyebrow: 'CONNECTIONS THAT MATTER',
    title: 'A community built around finding the way home.',
    intro:
      'FindBack is a university cloud computing project: a missing-person and community alert network designed around thoughtful sharing and privacy.',
    sections: [
      {
        title: 'A clear path from report to community',
        text: 'Registered reporters submit private cases. Authorized moderators review information for publication. Public cases can then be found in the directory and on a general-area map. People can share possible sightings privately.',
      },
      {
        title: 'Approval means safe to publish',
        text: 'Publication approval does not mean a report has been independently verified, and FindBack is not an official missing-person database. Reviewers focus on information appropriate for community awareness.',
      },
      {
        title: 'The right information, in the right hands',
        text: 'Personal contact details, sightings, and review notes remain private. Email alerts go to people who choose to follow the case’s district. Cases can be hidden or resolved while preserving an audit history.',
      },
    ],
  },
  privacy: {
    eyebrow: 'PRIVACY BY DESIGN',
    title: 'People first. Personal information protected.',
    intro:
      'FindBack collects only the information needed to manage reports, review sightings, and deliver the district alerts you request.',
    sections: [
      {
        title: 'What becomes public',
        text: 'Only approved case information is published: name, approximate age, a general area, approximate date, reviewed descriptive text, and an explicitly approved photograph. Exact times and private contact details are excluded. Map points represent districts.',
      },
      {
        title: 'What stays restricted',
        text: 'Reporter contact methods, private sightings, supporting attachments, reviewer notes, and internal record identifiers are restricted by backend permissions. Your account email is used for sign-in, password recovery, and your chosen alerts.',
      },
      {
        title: 'Control and removal',
        text: 'Manage district subscriptions and email preferences from your dashboard. Remove your case photograph or request case removal from your private report view. Deactivate your account in Settings. Records needed for moderation and audit may be retained; this prototype has no automatic retention schedule.',
      },
      {
        title: 'Service providers and local development',
        text: 'Deployments can use managed PostgreSQL, private S3-compatible object storage, and SMTP. Local development uses PostgreSQL, local image storage, and Mailpit. OpenStreetMap receives map tile requests, including your browser’s network address. No advertising trackers are included.',
      },
    ],
  },
  terms: {
    eyebrow: 'A SHARED RESPONSIBILITY',
    title: 'Use FindBack with care.',
    intro: 'By using FindBack, you agree to support safe, lawful, good-faith community reporting.',
    sections: [
      {
        title: 'Responsible reporting',
        text: 'Submit information only when you have appropriate authority or a legitimate basis. Do not submit harassment, stalking, malicious allegations, fabricated evidence, or personal information unrelated to a case.',
      },
      {
        title: 'Publication and review',
        text: 'Reports stay private until a moderator approves publication. Moderators may request corrections, reject, hide, or resolve reports. Approval does not certify truth or create an official investigation.',
      },
      {
        title: 'Community safety',
        text: 'Do not confront, follow, detain, or publicly expose someone based on a case. Submit sightings privately and contact appropriate authorities when someone may be in danger. FindBack does not guarantee an outcome or response time.',
      },
      {
        title: 'Project scope',
        text: 'FindBack is an educational project and a community assistance platform, not an emergency response service. Development data is fictional and clearly marked. Deployment operators must publish their real contact and retention arrangements before collecting real reports.',
      },
    ],
  },
  safety: {
    eyebrow: 'CARE BEFORE ACTION',
    title: 'Helping should always be safe.',
    intro: 'A useful observation can be shared without putting anyone at risk.',
    sections: [
      {
        title: 'Start with the appropriate authorities',
        text: 'If someone is missing or in immediate danger, contact the appropriate local authorities first. FindBack supports community awareness and cannot dispatch responders or conduct an official investigation.',
      },
      {
        title: 'Share a sighting privately',
        text: 'Use the case’s Submit a sighting form. Describe the approximate time, general location, and what you observed. Do not post the sighting publicly or contact strangers claiming to represent a family.',
      },
      {
        title: 'Do not approach or follow',
        text: 'Do not confront, follow, photograph someone intrusively, or attempt to detain anyone. A resemblance is not identification. Respect everyone’s privacy, dignity, and safety.',
      },
      {
        title: 'Flag concerns',
        text: 'Use Report a concern on a public case page if you suspect abuse, incorrect information, or a privacy issue. Reporters can request removal through their private report view. Authorized reviewers record decisions in the audit trail.',
      },
    ],
  },
  contact: {
    eyebrow: 'HERE TO HELP YOU NAVIGATE',
    title: 'Reach the right people.',
    intro: 'Use the secure case workflows to get sensitive information to authorized reviewers.',
    sections: [
      {
        title: 'Have information about a case?',
        text: 'Open its public page and choose Submit a sighting. Your submission goes privately to the review team. An optional safe contact method lets authorized reviewers follow up.',
      },
      {
        title: 'Need to update your report?',
        text: 'Open My Reports in your dashboard. You can correct pending or rejected reports and request removal of any report you own. Reviewer feedback appears in your private report view.',
      },
      {
        title: 'Concerned about published information?',
        text: 'Choose Report a concern on the public case page. Explain the concern without posting sensitive information elsewhere. The moderation team can review and hide inappropriate content.',
      },
      {
        title: 'Project support',
        text: 'This local educational build has no staffed support mailbox. Deployment operators should configure and publish an actual support contact before using real reports. For urgent help, contact appropriate local authorities.',
      },
    ],
  },
}
export default function Information({ page }: { page: string }) {
  const c = content[page]
  if (!c)
    return (
      <Empty
        title="We couldn’t find that page"
        description="Use the navigation to return to FindBack."
        action={
          <Link className="button primary" to="/">
            Go home
          </Link>
        }
      />
    )
  return (
    <>
      <PageHeading eyebrow={c.eyebrow} title={c.title} description={c.intro} />
      {page === 'about' && (
        <div className="about-banner">
          <HeartHandshake size={55} strokeWidth={1.2} />
          <h2>
            Connecting communities.
            <br />
            Bringing people home.
          </h2>
          <div>
            <ShieldCheck size={22} />
            <LockKeyhole size={22} />
          </div>
        </div>
      )}
      <div className="information-layout">
        <article className="panel information-content">
          {c.sections.map((s) => (
            <section key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </section>
          ))}
        </article>
        <aside className="panel padded-panel">
          <span className="mini-icon red">
            <ShieldCheck size={25} />
          </span>
          <h3>A safer community starts with us.</h3>
          <p className="muted">
            Use thoughtful reporting, respect privacy, and share observations through the right
            channels.
          </p>
          <Link className="text-link" to="/cases">
            Explore published cases <ArrowRight size={15} />
          </Link>
          <Link className="text-link" to="/dashboard?tab=reports">
            Manage my reports <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
    </>
  )
}
