import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  Course,
  IngredientCategory,
  Prisma,
  RecipeDifficulty,
  UnitOfMeasure,
} from '@prisma/client';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory/casl-ability.factory';
import { Action } from '../auth/casl/action.enum';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { createHttpException, errors } from '../common/config/error.config';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import {
  IngredientDetailResponseDto,
  IngredientResponseDto,
  PaginatedAdminIngredientsResponseDto,
  PaginatedAdminTagsResponseDto,
  PaginatedIngredientsResponseDto,
  PaginatedTagsResponseDto,
  TagDetailResponseDto,
  TagResponseDto,
} from './dto/catalog-response.dto';
import { AdminIngredientQueryDto } from './dto/admin-ingredient-query.dto';
import { AdminTagQueryDto } from './dto/admin-tag-query.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';
import { FilterTagDto } from './dto/filter-tag.dto';
import { SupportedLocale } from '../common/dto/locale-query.dto';
import { buildPaginatedResponse } from '../common/dto/pagination-query.dto';
import { SortOrder } from '../common/dto/sort-order.enum';

const TAG_CATALOG_SELECT = {
  id: true,
  slug: true,
  translations: { select: { locale: true, name: true } },
} satisfies Prisma.TagSelect;

const INGREDIENT_CATALOG_SELECT = {
  id: true,
  slug: true,
  category: true,
  translations: { select: { locale: true, name: true } },
} satisfies Prisma.IngredientSelect;

type CatalogTagRow = Prisma.TagGetPayload<{
  select: typeof TAG_CATALOG_SELECT;
}>;
type CatalogIngredientRow = Prisma.IngredientGetPayload<{
  select: typeof INGREDIENT_CATALOG_SELECT;
}>;

const CATALOG_SQL_META = {
  tags: {
    tableName: 'tags',
    translationTable: 'tag_translations',
    foreignKey: 'tag_id',
  },
  ingredients: {
    tableName: 'ingredients',
    translationTable: 'ingredient_translations',
    foreignKey: 'ingredient_id',
  },
} as const;

type CatalogEntityKind = keyof typeof CATALOG_SQL_META;

/**
 * Shared helper formatting an array of translation rows into a canonical multilingual dictionary.
 */
export function toTranslationDictionary(
  translations: { locale: string; name: string }[],
) {
  const nameOf = (locale: string) =>
    translations.find((t) => t.locale === locale)?.name ?? '';
  return {
    it: nameOf('it'),
    en: nameOf('en'),
    fr: nameOf('fr'),
  };
}

/**
 * Normalizes a given string locale to a supported platform locale ('it', 'fr', 'en'), defaulting to 'en'.
 */
export function normalizeSupportedLocale(lang?: string): SupportedLocale {
  if (lang === 'it' || lang === 'fr' || lang === 'en') {
    return lang;
  }
  return 'en';
}

/**
 * Resolves a localized catalog entity name and resolved locale following ADR 0031 4-tier fallback:
 * 1. Requested language (lang)
 * 2. English (en)
 * 3. First available translation found in entity translations
 * 4. Canonical entity slug
 */
export function resolveCatalogTranslation<
  T extends { locale: string; name: string },
>(
  translations: T[] | undefined,
  requestedLocale: SupportedLocale,
  slug: string,
): { name: string; resolved_lang: SupportedLocale } {
  if (!translations || translations.length === 0) {
    return { name: slug, resolved_lang: 'en' };
  }
  const matchRequested = translations.find(
    (tr) => tr.locale === requestedLocale,
  );
  if (matchRequested) {
    return {
      name: matchRequested.name,
      resolved_lang: matchRequested.locale as SupportedLocale,
    };
  }
  const matchEn = translations.find((tr) => tr.locale === 'en');
  if (matchEn) {
    return {
      name: matchEn.name,
      resolved_lang: matchEn.locale as SupportedLocale,
    };
  }
  const firstFound = translations[0];
  if (firstFound) {
    return {
      name: firstFound.name,
      resolved_lang: (firstFound.locale as SupportedLocale) ?? 'en',
    };
  }
  return { name: slug, resolved_lang: 'en' };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /*
  GET /api/recipes/metadata
  Provides client applications (frontend) with all static enum dictionaries
  in a single HTTP call.
  */
  getMetadata() {
    return {
      courses: Object.values(Course),
      difficulties: Object.values(RecipeDifficulty),
      units: Object.values(UnitOfMeasure),
      categories: Object.values(IngredientCategory),
    };
  }

  /**
   * Builds a shared Prisma search filter across canonical `slug` and any locale translation `name`.
   */
  private buildCatalogSearchFilter(search?: string): {
    OR?: Array<
      | { slug: { contains: string; mode: 'insensitive' } }
      | {
          translations: {
            some: { name: { contains: string; mode: 'insensitive' } };
          };
        }
    >;
  } {
    if (!search || !search.trim()) {
      return {};
    }
    const term = search.trim();
    return {
      OR: [
        { slug: { contains: term, mode: 'insensitive' } },
        {
          translations: {
            some: {
              name: { contains: term, mode: 'insensitive' },
            },
          },
        },
      ],
    };
  }

  private buildIngredientWhere(
    search?: string,
    category?: IngredientCategory,
  ): Prisma.IngredientWhereInput {
    return {
      ...this.buildCatalogSearchFilter(search),
      ...(category ? { category } : {}),
    };
  }

  /*
  GET /api/admin/catalog/ingredients
  Returns paginated curated ingredients with full multilingual dictionaries (it, en, fr).
  Restricted to administrators.
  */
  async getAdminIngredients(
    query: AdminIngredientQueryDto = {},
  ): Promise<PaginatedAdminIngredientsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sort_by ?? 'id';
    const sortOrder = query.sort_order ?? SortOrder.asc;
    const where = this.buildIngredientWhere(query.search, query.category);

    const [rows, total] = await Promise.all([
      this.prisma.ingredient.findMany({
        where,
        select: INGREDIENT_CATALOG_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ingredient.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => this.toIngredientDetail(row)),
      total,
      page,
      limit,
    );
  }

  /*
  GET /api/admin/catalog/tags
  Returns paginated curated tags with full multilingual dictionaries (it, en, fr).
  Restricted to administrators.
  */
  async getAdminTags(
    query: AdminTagQueryDto = {},
  ): Promise<PaginatedAdminTagsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sort_by ?? 'id';
    const sortOrder = query.sort_order ?? SortOrder.asc;
    const where: Prisma.TagWhereInput = this.buildCatalogSearchFilter(
      query.search,
    );

    const [rows, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        select: TAG_CATALOG_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tag.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => this.toTagDetail(row)),
      total,
      page,
      limit,
    );
  }

  /**
   * Executes DB-level localized name sorting with 4-tier translation fallback
   * and returns only the requested page's entity IDs in sorted order.
   */
  private async querySortedCatalogIds(params: {
    entity: CatalogEntityKind;
    locale: SupportedLocale;
    sortOrder: SortOrder;
    search?: string;
    category?: IngredientCategory;
    skip: number;
    limit: number;
  }): Promise<number[]> {
    const meta = CATALOG_SQL_META[params.entity];
    const tableSql = Prisma.raw(`"${meta.tableName}"`);
    const trTableSql = Prisma.raw(`"${meta.translationTable}"`);
    const fkSql = Prisma.raw(`"${meta.foreignKey}"`);
    const orderSql = Prisma.raw(
      params.sortOrder === SortOrder.desc ? 'DESC' : 'ASC',
    );

    const conditions: Prisma.Sql[] = [];
    if (params.category) {
      conditions.push(
        Prisma.sql`e."category" = ${params.category}::"IngredientCategory"`,
      );
    }
    const term = params.search?.trim();
    if (term) {
      const pattern = `%${term}%`;
      conditions.push(
        Prisma.sql`(
          e."slug" ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM ${trTableSql} tr_s
            WHERE tr_s.${fkSql} = e."id" AND tr_s."name" ILIKE ${pattern}
          )
        )`,
      );
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    const sql = Prisma.sql`
      SELECT e."id"
      FROM ${tableSql} e
      LEFT JOIN ${trTableSql} t_req
        ON t_req.${fkSql} = e."id" AND t_req."locale" = ${params.locale}
      LEFT JOIN ${trTableSql} t_en
        ON t_en.${fkSql} = e."id" AND t_en."locale" = 'en'
      LEFT JOIN LATERAL (
        SELECT tr."name"
        FROM ${trTableSql} tr
        WHERE tr.${fkSql} = e."id"
        ORDER BY tr."locale" ASC
        LIMIT 1
      ) t_any ON TRUE
      ${whereClause}
      ORDER BY LOWER(COALESCE(t_req."name", t_en."name", t_any."name", e."slug")) ${orderSql}, e."id" ASC
      LIMIT ${params.limit} OFFSET ${params.skip}
    `;

    const rows = await this.prisma.$queryRaw<{ id: number }[]>(sql);
    return rows.map((row) => row.id);
  }

  /**
   * Shared DB-level pagination path for public localized catalogs (`tags` and `ingredients`),
   * sorting either by `slug` directly or by localized `name` via SQL `LIMIT`/`OFFSET` + `Map` hydration.
   */
  private async paginateLocalizedCatalog<
    TRow extends { id: number },
    TDto,
  >(options: {
    entity: CatalogEntityKind;
    locale: SupportedLocale;
    page: number;
    limit: number;
    sortBy: 'name' | 'slug';
    sortOrder: SortOrder;
    search?: string;
    category?: IngredientCategory;
    count: () => Promise<number>;
    findPageBySlug: (
      skip: number,
      take: number,
      order: SortOrder,
    ) => Promise<TRow[]>;
    findByIds: (ids: number[]) => Promise<TRow[]>;
    toDto: (row: TRow, locale: SupportedLocale) => TDto;
  }) {
    const { locale, page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;

    if (sortBy === 'slug') {
      const [rows, total] = await Promise.all([
        options.findPageBySlug(skip, limit, sortOrder),
        options.count(),
      ]);
      return buildPaginatedResponse(
        rows.map((row) => options.toDto(row, locale)),
        total,
        page,
        limit,
      );
    }

    const [ids, total] = await Promise.all([
      this.querySortedCatalogIds({
        entity: options.entity,
        locale,
        sortOrder,
        search: options.search,
        category: options.category,
        skip,
        limit,
      }),
      options.count(),
    ]);

    if (ids.length === 0) {
      return buildPaginatedResponse<TDto>([], total, page, limit);
    }

    const rows = await options.findByIds(ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const orderedDtos = ids
      .map((id) => byId.get(id))
      .filter((row): row is TRow => Boolean(row))
      .map((row) => options.toDto(row, locale));

    return buildPaginatedResponse(orderedDtos, total, page, limit);
  }

  /*
  GET /api/tags
  Returns paginated tags for a recipe (vegetarian, vegan, etc.),
  supporting search, localized name sorting, or DB-level slug sorting.
  */
  async getTags(
    filterDto: FilterTagDto = {},
  ): Promise<PaginatedTagsResponseDto> {
    const locale = normalizeSupportedLocale(filterDto.lang);
    const page = filterDto.page ?? 1;
    const limit = filterDto.limit ?? 20;
    const sortBy = filterDto.sort_by ?? 'name';
    const sortOrder = filterDto.sort_order ?? SortOrder.asc;
    const where: Prisma.TagWhereInput = this.buildCatalogSearchFilter(
      filterDto.search,
    );

    const toTagDto = (
      t: CatalogTagRow,
      loc: SupportedLocale,
    ): TagResponseDto => {
      const resolved = resolveCatalogTranslation(t.translations, loc, t.slug);
      return {
        id: t.id,
        slug: t.slug,
        name: resolved.name,
        resolved_lang: resolved.resolved_lang,
      };
    };

    return this.paginateLocalizedCatalog({
      entity: 'tags',
      locale,
      page,
      limit,
      sortBy,
      sortOrder,
      search: filterDto.search,
      count: () => this.prisma.tag.count({ where }),
      findPageBySlug: (skip, take, order) =>
        this.prisma.tag.findMany({
          where,
          select: TAG_CATALOG_SELECT,
          orderBy: { slug: order },
          skip,
          take,
        }),
      findByIds: (ids) =>
        this.prisma.tag.findMany({
          where: { id: { in: ids } },
          select: TAG_CATALOG_SELECT,
        }),
      toDto: toTagDto,
    });
  }

  /*
  GET /api/tags/:id
  Retrieves a single curated tag by ID, localized to the requested language (default 'en').
  Public read access without authentication.
  Throws 404 if not found.
  */
  async getTagById(
    id: number,
    params: { lang?: SupportedLocale } = {},
  ): Promise<TagResponseDto> {
    const locale = normalizeSupportedLocale(params.lang);
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!tag) {
      throw createHttpException(errors.tags.notFound);
    }
    const resolved = resolveCatalogTranslation(
      tag.translations,
      locale,
      tag.slug,
    );
    return {
      id: tag.id,
      slug: tag.slug,
      name: resolved.name,
      resolved_lang: resolved.resolved_lang,
    };
  }

  /*
  GET /api/admin/catalog/tags/:id
  Retrieves a single curated tag by ID with all its translations (it, en, fr).
  Restricted to administrators.
  Throws 404 if not found.
  */
  async getTagDetail(id: number): Promise<TagDetailResponseDto> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!tag) {
      throw createHttpException(errors.tags.notFound);
    }
    return this.toTagDetail(tag);
  }

  /*
  GET /api/ingredients
  Returns paginated ingredients for a recipe, supporting category filtering,
  search, localized name sorting, or DB-level slug sorting.
  */
  async getIngredients(
    filterDto: FilterIngredientDto = {},
  ): Promise<PaginatedIngredientsResponseDto> {
    const locale = normalizeSupportedLocale(filterDto.lang);
    const page = filterDto.page ?? 1;
    const limit = filterDto.limit ?? 20;
    const sortBy = filterDto.sort_by ?? 'name';
    const sortOrder = filterDto.sort_order ?? SortOrder.asc;
    const where = this.buildIngredientWhere(
      filterDto.search,
      filterDto.category,
    );

    const toIngredientDto = (
      i: CatalogIngredientRow,
      loc: SupportedLocale,
    ): IngredientResponseDto => {
      const resolved = resolveCatalogTranslation(i.translations, loc, i.slug);
      return {
        id: i.id,
        slug: i.slug,
        category: i.category,
        name: resolved.name,
        resolved_lang: resolved.resolved_lang,
      };
    };

    return this.paginateLocalizedCatalog({
      entity: 'ingredients',
      locale,
      page,
      limit,
      sortBy,
      sortOrder,
      search: filterDto.search,
      category: filterDto.category,
      count: () => this.prisma.ingredient.count({ where }),
      findPageBySlug: (skip, take, order) =>
        this.prisma.ingredient.findMany({
          where,
          select: INGREDIENT_CATALOG_SELECT,
          orderBy: { slug: order },
          skip,
          take,
        }),
      findByIds: (ids) =>
        this.prisma.ingredient.findMany({
          where: { id: { in: ids } },
          select: INGREDIENT_CATALOG_SELECT,
        }),
      toDto: toIngredientDto,
    });
  }

  /*
  GET /api/ingredients/:id
  Retrieves a single curated ingredient by ID, localized to the requested language (default 'en').
  Public read access without authentication.
  Throws 404 if not found.
  */
  async getIngredientById(
    id: number,
    params: { lang?: SupportedLocale } = {},
  ): Promise<IngredientResponseDto> {
    const locale = normalizeSupportedLocale(params.lang);
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!ingredient) {
      throw createHttpException(errors.ingredients.notFound);
    }
    const resolved = resolveCatalogTranslation(
      ingredient.translations,
      locale,
      ingredient.slug,
    );
    return {
      id: ingredient.id,
      slug: ingredient.slug,
      category: ingredient.category,
      name: resolved.name,
      resolved_lang: resolved.resolved_lang,
    };
  }

  /*
  GET /api/admin/catalog/ingredients/:id
  Retrieves a single curated ingredient by ID with all its translations (it, en, fr).
  Restricted to administrators.
  Throws 404 if not found.
  */
  async getIngredientDetail(id: number): Promise<IngredientDetailResponseDto> {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!ingredient) {
      throw createHttpException(errors.ingredients.notFound);
    }
    return this.toIngredientDetail(ingredient);
  }

  /*
  POST /api/ingredients
  Adds a new ingredient to the curated catalog (admin only, enforced by CASL).
  The ingredient row and its three translation rows (it, en, fr) are created
  in a single nested write, so either everything is saved or nothing is.
  @param user: Authenticated user performing the request.
  @param dto: Slug, category and the name in each supported language.
  */
  async createIngredient(user: ActiveUserData, dto: CreateIngredientDto) {
    // Only roles allowed to create Ingredients pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Create, 'Ingredient');

    // Friendly 409 if the slug is already taken. A concurrent request that
    // slips through is still caught by the DB unique constraint (P2002),
    // which the global exception filter turns into a 409 as well.
    const existing = await this.prisma.ingredient.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw createHttpException(
        errors.ingredients.alreadyExists,
        `Ingredient with slug '${dto.slug}' already exists`,
      );
    }

    // Creates the ingredient together with its translations
    const created = await this.prisma.ingredient.create({
      data: {
        slug: dto.slug,
        category: dto.category,
        translations: {
          create: [
            { locale: 'it', name: dto.translations.it },
            { locale: 'en', name: dto.translations.en },
            { locale: 'fr', name: dto.translations.fr },
          ],
        },
      },
      include: { translations: true },
    });

    return this.toIngredientDetail(created);
  }
  /*
  POST /api/tags
  Adds a new tag to the curated catalog (admin only, enforced by CASL).
  The tag row and its three translation rows (it, en, fr) are created in a
  single nested write, so either everything is saved or nothing is.
  @param user: Authenticated user performing the request.
  @param dto: Slug and the display name in each supported language.
  */
  async createTag(user: ActiveUserData, dto: CreateTagDto) {
    // Only roles allowed to create Tags pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Create, 'Tag');

    // Friendly 409 if the slug is already taken. A concurrent request that
    // slips through is still caught by the DB unique constraint (P2002),
    // which the global exception filter turns into a 409 as well.
    const existing = await this.prisma.tag.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw createHttpException(
        errors.tags.alreadyExists,
        `Tag with slug '${dto.slug}' already exists`,
      );
    }

    // Creates the tag together with its translations
    const created = await this.prisma.tag.create({
      data: {
        slug: dto.slug,
        translations: {
          create: [
            { locale: 'it', name: dto.translations.it },
            { locale: 'en', name: dto.translations.en },
            { locale: 'fr', name: dto.translations.fr },
          ],
        },
      },
      include: { translations: true },
    });

    return this.toTagDetail(created);
  }
  /*
  PATCH /api/tags/:id
  Updates the Italian, English and French names of an existing tag
  (admin only, enforced by CASL). The slug is immutable: it is the stable
  key used by seeds, filters and references, so it cannot be changed here.
  @param user: Authenticated user performing the request.
  @param id: Primary key of the tag to update.
  @param dto: The new display name in each supported language.
  */
  async updateTag(user: ActiveUserData, id: number, dto: UpdateTagDto) {
    // Only roles allowed to update Tags pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Update, 'Tag');

    // 404 if the tag does not exist
    const existing = await this.prisma.tag.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw createHttpException(errors.tags.notFound);
    }

    // Upserts the three translations in a single nested write, so a missing
    // translation row (edge case) is created instead of failing the update.
    const updated = await this.prisma.tag.update({
      where: { id },
      data: {
        translations: {
          upsert: [
            {
              where: { tag_id_locale: { tag_id: id, locale: 'it' } },
              create: { locale: 'it', name: dto.translations.it },
              update: { name: dto.translations.it },
            },
            {
              where: { tag_id_locale: { tag_id: id, locale: 'en' } },
              create: { locale: 'en', name: dto.translations.en },
              update: { name: dto.translations.en },
            },
            {
              where: { tag_id_locale: { tag_id: id, locale: 'fr' } },
              create: { locale: 'fr', name: dto.translations.fr },
              update: { name: dto.translations.fr },
            },
          ],
        },
      },
      include: { translations: true },
    });

    return this.toTagDetail(updated);
  }

  /*
  PATCH /api/ingredients/:id
  Updates the Italian, English and French names of an existing ingredient
  (admin only, enforced by CASL). The slug and category are immutable: they
  are the stable keys used by seeds, filters and references, so they cannot
  be changed here.
  @param user: Authenticated user performing the request.
  @param id: Primary key of the ingredient to update.
  @param dto: The new display name in each supported language.
  */
  async updateIngredient(
    user: ActiveUserData,
    id: number,
    dto: UpdateIngredientDto,
  ) {
    // Only roles allowed to update Ingredients pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Update, 'Ingredient');

    // 404 if the ingredient does not exist
    const existing = await this.prisma.ingredient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw createHttpException(errors.ingredients.notFound);
    }

    // Upserts the three translations in a single nested write, so a missing
    // translation row (edge case) is created instead of failing the update.
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        translations: {
          upsert: [
            {
              where: {
                ingredient_id_locale: { ingredient_id: id, locale: 'it' },
              },
              create: { locale: 'it', name: dto.translations.it },
              update: { name: dto.translations.it },
            },
            {
              where: {
                ingredient_id_locale: { ingredient_id: id, locale: 'en' },
              },
              create: { locale: 'en', name: dto.translations.en },
              update: { name: dto.translations.en },
            },
            {
              where: {
                ingredient_id_locale: { ingredient_id: id, locale: 'fr' },
              },
              create: { locale: 'fr', name: dto.translations.fr },
              update: { name: dto.translations.fr },
            },
          ],
        },
      },
      include: { translations: true },
    });

    return this.toIngredientDetail(updated);
  }

  /*
  Maps a stored Ingredient (with its translations) to the public response
  shape { id, slug, category, translations: { it, en, fr } }.
  */
  private toIngredientDetail(ingredient: {
    id: number;
    slug: string;
    category: IngredientCategory;
    translations: { locale: string; name: string }[];
  }): IngredientDetailResponseDto {
    return {
      id: ingredient.id,
      slug: ingredient.slug,
      category: ingredient.category,
      translations: toTranslationDictionary(ingredient.translations),
    };
  }

  /*
  Maps a stored Tag (with its translations) to the public response shape
  { id, slug, translations: { it, en, fr } }.
  */
  private toTagDetail(tag: {
    id: number;
    slug: string;
    translations: { locale: string; name: string }[];
  }): TagDetailResponseDto {
    return {
      id: tag.id,
      slug: tag.slug,
      translations: toTranslationDictionary(tag.translations),
    };
  }

  /*
  DELETE /api/ingredients/:id
  Deletes a curated ingredient (admin only, enforced by CASL).
  Refuses with 409 if the ingredient is referenced by at least one recipe,
  so recipes are never left with dangling ingredient references.
  @param user: Authenticated user performing the request.
  @param id: Primary key of the ingredient to delete.
  */
  async deleteIngredient(user: ActiveUserData, id: number) {
    // Only roles allowed to delete Ingredients pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Delete, 'Ingredient');

    // 404 if the ingredient does not exist
    const existing = await this.prisma.ingredient.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      throw createHttpException(errors.ingredients.notFound);
    }

    // 409 if the ingredient is referenced by at least one recipe
    const usageCount = await this.prisma.recipeIngredient.count({
      where: { ingredient_id: id },
    });
    if (usageCount > 0) {
      throw createHttpException(
        errors.ingredients.inUse,
        `Ingredient '${existing.slug}' is used in ${usageCount} recipe(s) and cannot be deleted`,
      );
    }

    // Deletes the ingredient; translations are removed by cascade
    await this.prisma.ingredient.delete({ where: { id } });

    return { message: `Ingredient '${existing.slug}' deleted successfully` };
  }

  /*
  DELETE /api/tags/:id
  Deletes a curated tag (admin only, enforced by CASL).
  Refuses with 409 if the tag is referenced by at least one recipe, so
  recipes are never silently stripped of a tag they use.
  @param user: Authenticated user performing the request.
  @param id: Primary key of the tag to delete.
  */
  async deleteTag(user: ActiveUserData, id: number) {
    // Only roles allowed to delete Tags pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Delete, 'Tag');

    // 404 if the tag does not exist
    const existing = await this.prisma.tag.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      throw createHttpException(errors.tags.notFound);
    }

    // 409 if the tag is referenced by at least one recipe
    const usageCount = await this.prisma.recipeTag.count({
      where: { tag_id: id },
    });
    if (usageCount > 0) {
      throw createHttpException(
        errors.tags.inUse,
        `Tag '${existing.slug}' is used in ${usageCount} recipe(s) and cannot be deleted`,
      );
    }

    // Deletes the tag; translations are removed by cascade
    await this.prisma.tag.delete({ where: { id } });

    return { message: `Tag '${existing.slug}' deleted successfully` };
  }
}
