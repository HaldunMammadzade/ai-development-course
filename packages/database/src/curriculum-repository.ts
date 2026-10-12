import { PrismaPg } from "@prisma/adapter-pg";
import type { PublishStatus } from "@platform/types";
import { PrismaClient } from "./generated/prisma/client";

export interface StoredLessonBlock {
  position: number;
  type: "reading" | "check_question" | "recap";
  body: unknown;
}

export interface StoredLesson {
  id: string;
  slug: string;
  title: string;
  objective: string;
  position: number;
  estimatedMinutes: number;
  status: PublishStatus;
  primaryConceptSlugs: string[];
  supportingConceptSlugs: string[];
  blocks: StoredLessonBlock[];
}

export interface StoredModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  lessons: StoredLesson[];
}

export interface StoredLearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  track: "frontend" | "backend" | "fullstack" | "skill";
  status: PublishStatus;
  modules: StoredModule[];
}

export interface CurriculumRepository {
  findPathBySlug(slug: string): Promise<StoredLearningPath | null>;
  findDirectPrerequisiteSlugs(conceptSlug: string): Promise<string[]>;
  disconnect(): Promise<void>;
}

export function createCurriculumRepository(databaseUrl: string): CurriculumRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaCurriculumRepository(prisma);
}

class PrismaCurriculumRepository implements CurriculumRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPathBySlug(slug: string): Promise<StoredLearningPath | null> {
    const path = await this.prisma.learningPath.findUnique({
      where: { slug },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
              include: {
                blocks: { orderBy: { position: "asc" } },
                concepts: { include: { concept: { select: { slug: true } } } },
              },
            },
          },
        },
      },
    });
    if (path === null) {
      return null;
    }
    return {
      id: path.id,
      slug: path.slug,
      title: path.title,
      description: path.description,
      track: path.track,
      status: path.status,
      modules: path.modules.map((module) => ({
        id: module.id,
        slug: module.slug,
        title: module.title,
        description: module.description,
        position: module.position,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          objective: lesson.objective,
          position: lesson.position,
          estimatedMinutes: lesson.estimatedMinutes,
          status: lesson.status,
          primaryConceptSlugs: lesson.concepts
            .filter((link) => link.role === "primary")
            .map((link) => link.concept.slug),
          supportingConceptSlugs: lesson.concepts
            .filter((link) => link.role === "supporting")
            .map((link) => link.concept.slug),
          blocks:
            lesson.status === "published"
              ? lesson.blocks.map((block) => ({
                  position: block.position,
                  type: block.type,
                  body: block.body,
                }))
              : [],
        })),
      })),
    };
  }

  async findDirectPrerequisiteSlugs(conceptSlug: string): Promise<string[]> {
    const concept = await this.prisma.concept.findUnique({
      where: { slug: conceptSlug },
      include: { prerequisites: { include: { prerequisite: { select: { slug: true } } } } },
    });
    if (concept === null) {
      return [];
    }
    return concept.prerequisites.map((edge) => edge.prerequisite.slug);
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
