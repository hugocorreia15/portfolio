import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { doiUrl, profile } from "@/data/profile";
import { Authors, Chips } from "@/components/ui/Sections";

export const metadata: Metadata = {
  title: "CV",
  description: `${profile.name} — ${profile.title}. Research, publications, projects and education.`,
  alternates: { canonical: "/cv" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cv-section grid gap-3 border-t border-ink/10 py-8 md:grid-cols-[150px_1fr] md:gap-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50 md:pt-1">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Entry({
  title,
  meta,
  sub,
  children,
}: {
  title: React.ReactNode;
  meta: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="cv-entry">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-display text-[17px] leading-snug text-ink">{title}</h3>
        <span className="font-mono text-[11px] text-ink/50">{meta}</span>
      </div>
      {sub && <p className="mt-0.5 text-[13.5px] text-ink/60">{sub}</p>}
      {children && <div className="mt-1.5 text-[14.5px] leading-relaxed text-ink/80">{children}</div>}
    </div>
  );
}

const ext = { target: "_blank", rel: "noreferrer" } as const;

export default function CvPage() {
  const featured = profile.projects.filter((p) => p.featured);
  const more = profile.projects.filter((p) => !p.featured);

  return (
    <main className="cv-page h-screen overflow-y-auto bg-salt text-ink">
      <div className="mx-auto w-full max-w-3xl px-5 pb-20 pt-8 md:px-8">
        <nav className="cv-noprint flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-azulejo"
          >
            ← sail the ria instead
          </Link>
          <div className="flex gap-2 font-mono text-[11px]">
            {profile.cv.map((doc) => (
              <a
                key={doc.href}
                href={doc.href}
                download
                className="rounded-full bg-azulejo px-3.5 py-1.5 text-salt transition-transform hover:-translate-y-0.5"
              >
                {doc.label} PDF ↓
              </a>
            ))}
          </div>
        </nav>

        <header className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center">
          <Image
            src="/images/hugo-portrait.webp"
            alt="Portrait of Hugo Correia"
            width={112}
            height={112}
            priority
            className="size-28 shrink-0 rounded-full object-cover ring-4 ring-foam"
          />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/50">
              {profile.location}
            </p>
            <h1 className="mt-1 font-display text-4xl leading-none md:text-5xl">{profile.name}</h1>
            <p className="mt-2 text-[17px] text-ink/70">{profile.title}</p>
            <p className="mt-1 text-[14px] text-azulejo">{profile.status}</p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-ink/65">
              <a href={`mailto:${profile.email}`} className="hover:text-azulejo">
                {profile.email}
              </a>
              <a href={`mailto:${profile.emailAlt}`} className="hover:text-azulejo">
                {profile.emailAlt}
              </a>
              <a href={profile.github} {...ext} className="hover:text-azulejo">
                github/hugocorreia15
              </a>
              <a href={profile.linkedin} {...ext} className="hover:text-azulejo">
                linkedin/hugo-correia
              </a>
              <a href={profile.orcid} {...ext} className="hover:text-azulejo">
                orcid/{profile.orcidId}
              </a>
            </p>
          </div>
        </header>

        <Section title="About">
          {profile.about.map((p) => (
            <p key={p.slice(0, 24)} className="text-[15px] leading-relaxed text-ink/80">
              {p}
            </p>
          ))}
          <Chips items={profile.researchInterests} />
        </Section>

        <Section title="Research">
          {profile.experience.map((e) => (
            <Entry key={e.role} title={e.role} meta={e.period} sub={e.org}>
              {e.context && <p className="text-[13px] text-ink/50">{e.context}</p>}
              <ul className="mt-1 list-disc space-y-1 pl-4 marker:text-ink/30">
                {e.points.map((pt) => (
                  <li key={pt.slice(0, 24)}>{pt}</li>
                ))}
              </ul>
            </Entry>
          ))}
        </Section>

        <Section title="Publications">
          <ol className="space-y-4">
            {profile.publications.map((pub) => (
              <li key={pub.title} className="cv-entry text-[14.5px] leading-relaxed text-ink/80">
                {pub.authors.length > 0 && (
                  <>
                    <Authors authors={pub.authors} /> ({pub.year}).{" "}
                  </>
                )}
                {pub.doi ? (
                  <a href={doiUrl(pub.doi)} {...ext} className="font-medium text-ink hover:text-azulejo">
                    {pub.title}
                  </a>
                ) : (
                  <span className="font-medium text-ink">{pub.title}</span>
                )}
                . <em className="text-ink/60">{pub.venue}</em>.
                {pub.status !== "published" && (
                  <span className="ml-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10.5px] text-amber-800">
                    {pub.status}
                  </span>
                )}
                {pub.doi && (
                  <span className="block font-mono text-[11px] text-ink/45">doi.org/{pub.doi}</span>
                )}
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Projects">
          {featured.map((p) => (
            <Entry
              key={p.name}
              title={
                <>
                  {p.name} <span className="font-sans text-[13px] text-ink/50">— {p.tagline}</span>
                </>
              }
              meta={String(p.year)}
              sub={p.role}
            >
              <p>{p.description}</p>
              <p className="mt-1 font-mono text-[11.5px] text-ink/50">
                {p.tech.join(" · ")}
                {p.link && (
                  <>
                    {" · "}
                    <a href={p.link} {...ext} className="text-azulejo hover:underline">
                      live
                    </a>
                  </>
                )}
                {p.paper && (
                  <>
                    {" · "}
                    <a href={doiUrl(p.paper)} {...ext} className="text-azulejo hover:underline">
                      paper
                    </a>
                  </>
                )}
                {p.repo && (
                  <>
                    {" · "}
                    <a href={p.repo} {...ext} className="text-azulejo hover:underline">
                      code
                    </a>
                  </>
                )}
              </p>
            </Entry>
          ))}
          <ul className="space-y-1 text-[13.5px] text-ink/70">
            {more.map((p) => (
              <li key={p.name}>
                <span className="font-medium text-ink">{p.name}</span> — {p.description}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Leadership">
          <Entry
            title={profile.leadership.org}
            meta={profile.leadership.period}
            sub={profile.leadership.place}
          >
            <ul className="space-y-1">
              {profile.leadership.roles.map((r) => (
                <li key={r.title}>
                  <span className="font-medium text-ink">{r.title}</span>{" "}
                  <span className="font-mono text-[11px] text-ink/45">({r.period})</span> — {r.text}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-ink/65">{profile.leadership.note}</p>
          </Entry>
          <ul className="space-y-1.5 text-[14px] leading-relaxed text-ink/75">
            {profile.community.map((c) => (
              <li key={c.name}>
                <span className="font-medium text-ink">{c.name}</span>{" "}
                <span className="font-mono text-[11px] text-ink/45">({c.when})</span> — {c.text}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Education">
          {profile.education.map((e) => (
            <Entry key={e.degree} title={e.degree} meta={e.period} sub={e.grade ? `${e.school} · ${e.grade}` : e.school}>
              {e.thesis && (
                <p>
                  Dissertation <em>“{e.thesis.title}”</em> — {e.thesis.grade}. Supervised by{" "}
                  {e.thesis.supervisors}.
                </p>
              )}
              {e.highlights && <p className="text-ink/65">{e.highlights.join(" · ")}</p>}
              {e.coursework && <p className="text-ink/55">Coursework: {e.coursework}.</p>}
            </Entry>
          ))}
        </Section>

        <Section title="Skills">
          {Object.entries(profile.skills).map(([category, items]) => (
            <p key={category} className="text-[14.5px] leading-relaxed text-ink/80">
              <span className="font-medium text-ink">{category}:</span> {items.join(", ")}.
            </p>
          ))}
          <p className="text-[14.5px] leading-relaxed text-ink/80">
            <span className="font-medium text-ink">Languages:</span>{" "}
            {profile.languages.map((l) => `${l.name} (${l.level.toLowerCase()})`).join(", ")}.
          </p>
        </Section>

        <footer className="cv-noprint border-t border-ink/10 pt-8 font-mono text-[11px] text-ink/45">
          This page mirrors the interactive portfolio.{" "}
          <Link href="/" className="text-azulejo hover:underline">
            Take the moliceiro →
          </Link>
        </footer>
      </div>
    </main>
  );
}
