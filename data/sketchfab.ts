import type { SectionId } from "@/data/profile";

export interface SketchfabModel {
  title: string;
  author: string;
  authorHref: string;
  href: string;
  /** sketchfab.com/models/<id>/embed */
  embed: string;
}

/** Real 3D captures of the region, shown in the matching port's panel. */
export const SKETCHFAB_GALLERY: Partial<Record<SectionId, SketchfabModel[]>> = {
  about: [
    {
      title: "Igreja das Barrocas — Aveiro",
      author: "ricardo.turmas",
      authorHref: "https://sketchfab.com/ricardo.turmas",
      href: "https://sketchfab.com/3d-models/igreja-das-barrocas-aveiro-3813b360676244ac89879f6b922e1df4",
      embed: "https://sketchfab.com/models/3813b360676244ac89879f6b922e1df4/embed",
    },
  ],
  experience: [
    {
      title: "Ponte de Carcavelos — Aveiro",
      author: "ricardo.turmas",
      authorHref: "https://sketchfab.com/ricardo.turmas",
      href: "https://sketchfab.com/3d-models/ponte-de-carcavelos-aveiro-4a504e3b7df541f0a2f489aed2b7d63c",
      embed: "https://sketchfab.com/models/4a504e3b7df541f0a2f489aed2b7d63c/embed",
    },
  ],
  projects: [
    {
      title: "Costa Nova Haystacks",
      author: "rawkusperhaps",
      authorHref: "https://sketchfab.com/rawkusperhaps",
      href: "https://sketchfab.com/3d-models/costa-nova-haystacks-b89822f23b434dc0a2827e8624fd56c3",
      embed: "https://sketchfab.com/models/b89822f23b434dc0a2827e8624fd56c3/embed",
    },
  ],
  education: [
    {
      title: "T17 3D Regional",
      author: "ANPRI",
      authorHref: "https://sketchfab.com/anpri",
      href: "https://sketchfab.com/3d-models/t17-3d-regional-3c36a1bd11134c46b8a651cb6c1ec5f3",
      embed: "https://sketchfab.com/models/3c36a1bd11134c46b8a651cb6c1ec5f3/embed",
    },
  ],
  contact: [
    {
      title: "Igreja da Trofa — Jacinta",
      author: "ricardo.turmas",
      authorHref: "https://sketchfab.com/ricardo.turmas",
      href: "https://sketchfab.com/3d-models/igreja-da-trofa-jacinta-c9a65f6a206344cd8c51461ca7a260c1",
      embed: "https://sketchfab.com/models/c9a65f6a206344cd8c51461ca7a260c1/embed",
    },
  ],
};
